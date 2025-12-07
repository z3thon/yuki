/**
 * Script to find users by name in Employees table
 * Usage: npx tsx scripts/find-users.ts rosson andrea
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { queryFillout } from '../lib/fillout';

const EMPLOYEES_TABLE_ID = 'tcNK2zZPcAR';

async function findUsers(names: string[]) {
  console.log('🔍 Searching for users...\n');
  
  for (const name of names) {
    try {
      const response = await queryFillout({
        tableId: EMPLOYEES_TABLE_ID,
        filters: {
          name: { contains: name },
        },
        limit: 10,
      });
      
      if (response.records && response.records.length > 0) {
        console.log(`✅ Found ${response.records.length} match(es) for "${name}":`);
        response.records.forEach((record: any) => {
          console.log(`   - Name: ${record.fields.name}`);
          console.log(`     Email: ${record.fields.email}`);
          console.log(`     Employee ID: ${record.id}`);
          console.log('');
        });
      } else {
        console.log(`❌ No matches found for "${name}"\n`);
      }
    } catch (error: any) {
      console.error(`❌ Error searching for "${name}":`, error.message);
    }
  }
}

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: npx tsx scripts/find-users.ts <name1> <name2> ...');
  process.exit(1);
}

findUsers(names).catch(console.error);

