/**
 * Script to grant HR app access and all default view permissions
 * Usage: npx tsx scripts/grant-hr-permissions.ts <email1> <email2> ...
 * 
 * Example: npx tsx scripts/grant-hr-permissions.ts rosson@example.com andrea@example.com
 */

// Load environment variables FIRST before importing any modules that use them
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import admin from 'firebase-admin';
import { grantAppAccess, createUserPermission } from '../lib/permission-tables';
import { getEmployeeIdForUser } from '../lib/employee-lookup';
import { clearPermissionCache } from '../lib/permissions';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    process.exit(1);
  }
}

const HR_VIEWS = [
  'employees',
  'time-tracking',
  'punch-alterations',
  'pay-periods',
] as const;

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

async function grantHRPermissions(email: string) {
  console.log(`\n📧 Processing: ${email}`);
  
  // Get Firebase UID
  const userId = await getUserByEmail(email);
  if (!userId) {
    console.log(`   ⏭️  Skipping - user not found`);
    return;
  }
  
  console.log(`   ✅ Found Firebase UID: ${userId}`);
  
  // Try to find employee ID
  let employeeId: string | null = null;
  try {
    employeeId = await getEmployeeIdForUser(email);
    if (employeeId) {
      console.log(`   ✅ Found Employee ID: ${employeeId}`);
    } else {
      console.log(`   ⚠️  No employee record found (will create permissions without employee_id)`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not lookup employee (will create permissions without employee_id)`);
  }
  
  // Grant HR app access
  try {
    await grantAppAccess(userId, 'hr', employeeId || undefined);
    console.log(`   ✅ Granted HR app access`);
  } catch (error: any) {
    if (error.message?.includes('Already granted')) {
      console.log(`   ℹ️  HR app access already granted`);
    } else {
      throw error;
    }
  }
  
  // Grant permissions for each view
  for (const viewId of HR_VIEWS) {
    try {
      await createUserPermission({
        userId,
        employeeId: employeeId || undefined,
        appId: 'hr',
        viewId,
        resourceType: null, // null = all resources
        resourceId: null,   // null = all resources
        actions: ['read', 'write'], // Full access
      });
      console.log(`   ✅ Granted permissions for view: ${viewId}`);
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log(`   ℹ️  Permissions already exist for view: ${viewId}`);
      } else {
        console.error(`   ❌ Error granting permissions for ${viewId}:`, error.message);
      }
    }
  }
  
  // Clear cache
  clearPermissionCache(userId);
  console.log(`   ✅ Cleared permission cache`);
  
  console.log(`   ✨ Complete!`);
}

async function main() {
  const emails = process.argv.slice(2);
  
  if (emails.length === 0) {
    console.error('Usage: tsx scripts/grant-hr-permissions.ts <email1> <email2> ...');
    console.error('Example: tsx scripts/grant-hr-permissions.ts rosson@example.com andrea@example.com');
    process.exit(1);
  }
  
  console.log('🚀 Granting HR permissions...');
  console.log(`📋 Users: ${emails.join(', ')}`);
  
  for (const email of emails) {
    try {
      await grantHRPermissions(email);
    } catch (error: any) {
      console.error(`\n❌ Error processing ${email}:`, error.message);
      console.error(error);
    }
  }
  
  console.log('\n✅ All done!');
}

main().catch(console.error);

