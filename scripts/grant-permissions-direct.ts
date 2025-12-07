/**
 * Direct script to grant HR permissions using Fillout API directly
 * Usage: npx tsx scripts/grant-permissions-direct.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1/bases';
const FILLOUT_BASE_ID = process.env.FILLOUT_BASE_ID || 'aa7a307dc0a191a5';
const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';

const USER_APP_ACCESS_TABLE_ID = process.env.USER_APP_ACCESS_TABLE_ID || 'tpwLPMUfiwS';
const USER_PERMISSIONS_TABLE_ID = process.env.USER_PERMISSIONS_TABLE_ID || 't8bkw75uxCC';

const HR_VIEWS = ['employees', 'time-tracking', 'punch-alterations', 'pay-periods'];

async function filloutRequest(method: string, endpoint: string, body?: any) {
  // FILLOUT_BASE_URL already includes /bases, so we need: /bases/{baseId}/tables/{tableId}/...
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}${endpoint}`;
  console.log(`   🔍 ${method} ${url}`);
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fillout API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function getUserByEmail(email: string): Promise<string | null> {
  try {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ User not found: ${email}`);
      return null;
    }
    throw error;
  }
}

async function checkExistingAccess(userId: string, appId: string): Promise<boolean> {
  try {
    const result = await filloutRequest('POST', `/tables/${USER_APP_ACCESS_TABLE_ID}/records/list`, {
      filters: {
        user_id: { eq: userId },
        app_id: { eq: appId },
      },
      limit: 1,
    });
    return result.records && result.records.length > 0;
  } catch (error) {
    return false;
  }
}

async function grantAppAccess(userId: string, appId: string) {
  const exists = await checkExistingAccess(userId, appId);
  if (exists) {
    console.log(`   ℹ️  HR app access already granted`);
    return;
  }

  await filloutRequest('POST', `/tables/${USER_APP_ACCESS_TABLE_ID}/records`, {
    fields: {
      user_id: userId,
      app_id: appId,
      granted_at: new Date().toISOString(),
    },
  });
  console.log(`   ✅ Granted HR app access`);
}

async function checkExistingPermission(userId: string, appId: string, viewId: string): Promise<boolean> {
  try {
    const result = await filloutRequest('POST', `/tables/${USER_PERMISSIONS_TABLE_ID}/records/list`, {
      filters: {
        user_id: { eq: userId },
        app_id: { eq: appId },
        view_id: { eq: viewId },
      },
      limit: 1,
    });
    return result.records && result.records.length > 0;
  } catch (error) {
    return false;
  }
}

async function grantViewPermission(userId: string, appId: string, viewId: string) {
  const exists = await checkExistingPermission(userId, appId, viewId);
  if (exists) {
    console.log(`   ℹ️  Permissions already exist for view: ${viewId}`);
    return;
  }

  await filloutRequest('POST', `/tables/${USER_PERMISSIONS_TABLE_ID}/records`, {
    fields: {
      user_id: userId,
      app_id: appId,
      view_id: viewId,
      resource_type: null,
      resource_id: null,
      actions: ['read', 'write'],
    },
  });
  console.log(`   ✅ Granted permissions for view: ${viewId}`);
}

async function grantHRPermissions(email: string) {
  console.log(`\n📧 Processing: ${email}`);
  
  const userId = await getUserByEmail(email);
  if (!userId) {
    console.log(`   ⏭️  Skipping - user not found`);
    return;
  }
  
  console.log(`   ✅ Found Firebase UID: ${userId}`);
  
  await grantAppAccess(userId, 'hr');
  
  for (const viewId of HR_VIEWS) {
    await grantViewPermission(userId, 'hr', viewId);
  }
  
  console.log(`   ✨ Complete!`);
}

async function main() {
  const emails = process.argv.slice(2);
  
  if (emails.length === 0) {
    console.error('Usage: npx tsx scripts/grant-permissions-direct.ts <email1> <email2> ...');
    console.error('Example: npx tsx scripts/grant-permissions-direct.ts rosson@discover-nocode.com andrea@discover-nocode.com');
    process.exit(1);
  }
  
  console.log('🚀 Granting HR permissions...');
  console.log(`📋 Users: ${emails.join(', ')}`);
  console.log(`🔑 Using API token: ${FILLOUT_API_TOKEN.substring(0, 20)}...`);
  
  for (const email of emails) {
    try {
      await grantHRPermissions(email);
    } catch (error: any) {
      console.error(`\n❌ Error processing ${email}:`, error.message);
    }
  }
  
  console.log('\n✅ All done!');
}

main().catch(console.error);

