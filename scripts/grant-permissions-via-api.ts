/**
 * Grant permissions via the admin API route
 * This requires the server to be running and you to be authenticated
 * Usage: npx tsx scripts/grant-permissions-via-api.ts <email1> <email2> ...
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';

async function grantPermissionsViaAPI(email: string, firebaseToken: string) {
  const userId = email; // We'll need to get the actual UID
  
  // Grant app access
  const appAccessResponse = await fetch(`${API_URL}/api/admin/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firebaseToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'app_access',
      targetUserId: userId,
      targetUserEmail: email,
      appId: 'hr',
    }),
  });
  
  if (!appAccessResponse.ok) {
    throw new Error(`Failed to grant app access: ${appAccessResponse.statusText}`);
  }
  
  // Grant view permissions
  const views = ['employees', 'time-tracking', 'punch-alterations', 'pay-periods'];
  for (const viewId of views) {
    const permResponse = await fetch(`${API_URL}/api/admin/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        userEmail: email,
        appId: 'hr',
        viewId,
        actions: ['read', 'write'],
      }),
    });
    
    if (!permResponse.ok) {
      console.error(`Failed to grant permission for ${viewId}: ${permResponse.statusText}`);
    }
  }
}

// This approach requires authentication, so let's stick with direct Fillout API
// But we need to fix the API token issue first

console.log('This script requires authentication. Please use the direct Fillout API script instead.');
console.log('Or ensure your FILLOUT_API_TOKEN has access to base: aa7a307dc0a191a5');

