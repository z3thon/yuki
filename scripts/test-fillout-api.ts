/**
 * Test script to verify Fillout API access and discover databases
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';
const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1';

async function testAPI() {
  console.log('🔍 Testing Fillout API Access...\n');
  console.log(`API Token: ${FILLOUT_API_TOKEN ? FILLOUT_API_TOKEN.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`Base URL: ${FILLOUT_BASE_URL}\n`);

  if (!FILLOUT_API_TOKEN) {
    console.error('❌ FILLOUT_API_TOKEN not found');
    process.exit(1);
  }

  // Test 1: List all databases
  console.log('📋 Test 1: Listing all databases...');
  try {
    const response = await fetch(`${FILLOUT_BASE_URL}/bases`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error: ${error}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Found ${Array.isArray(data) ? data.length : 0} database(s)\n`);
    
    if (Array.isArray(data) && data.length > 0) {
      console.log('Databases:');
      data.forEach((db: any, index: number) => {
        console.log(`  ${index + 1}. ${db.name || db.id}`);
        console.log(`     ID: ${db.id}`);
        console.log(`     Tables: ${db.tables?.length || 0}`);
        console.log('');
      });
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }

  // Test 2: Try to get specific database
  const dbId = process.env.FILLOUT_BASE_ID || 'aa7a307dc0a191a5';
  console.log(`\n📋 Test 2: Getting database ${dbId}...`);
  try {
    const response = await fetch(`${FILLOUT_BASE_URL}/bases/${dbId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`❌ Error: ${JSON.stringify(error, null, 2)}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Database found: ${data.name || data.id}`);
    console.log(`   Tables: ${data.tables?.length || 0}`);
    
    if (data.tables && data.tables.length > 0) {
      console.log('\nExisting tables:');
      data.tables.forEach((table: any) => {
        console.log(`  - ${table.name} (ID: ${table.id})`);
      });
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
}

testAPI().catch(console.error);

