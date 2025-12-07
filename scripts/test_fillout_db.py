#!/usr/bin/env python3
"""Test script to verify Fillout API access and find the correct database"""

import os
import json
from dotenv import load_dotenv

load_dotenv('.env.local')
load_dotenv()

FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')
TARGET_DB_ID = 'aa7a307dc0a191a5'

if not FILLOUT_API_TOKEN:
    print('❌ FILLOUT_API_TOKEN not found')
    exit(1)

try:
    import requests
except ImportError:
    print('❌ requests library not found. Install with: pip3 install requests python-dotenv')
    exit(1)

print('🔍 Testing Fillout API Access...\n')
print(f'API Token: {FILLOUT_API_TOKEN[:20]}...')
print(f'Target DB ID: {TARGET_DB_ID}\n')

# List all databases
print('📋 Listing all databases...')
response = requests.get(
    'https://tables.fillout.com/api/v1/bases',
    headers={'Authorization': f'Bearer {FILLOUT_API_TOKEN}'}
)

if not response.ok:
    print(f'❌ Error: {response.status_code} {response.text}')
    exit(1)

databases = response.json()
print(f'✅ Found {len(databases)} database(s)\n')

# Find target database
target_db = None
for db in databases:
    db_id = db.get('id', '')
    db_name = db.get('name', 'Unknown')
    if db_id == TARGET_DB_ID:
        target_db = db
        print(f'✅ Found target database: {db_name} (ID: {db_id})')
        break

if not target_db:
    print(f'❌ Database {TARGET_DB_ID} not found in your accessible databases')
    print('\nAvailable databases:')
    for db in databases:
        print(f'  - {db.get("name", "Unknown")} (ID: {db.get("id")})')
else:
    print(f'\n📊 Database details:')
    print(f'   Name: {target_db.get("name")}')
    print(f'   ID: {target_db.get("id")}')
    print(f'   Tables: {len(target_db.get("tables", []))}')
    
    # Try to get the database directly
    print(f'\n📋 Testing direct database access...')
    db_response = requests.get(
        f'https://tables.fillout.com/api/v1/bases/{TARGET_DB_ID}',
        headers={'Authorization': f'Bearer {FILLOUT_API_TOKEN}'}
    )
    
    if db_response.ok:
        print('✅ Direct access works!')
        db_data = db_response.json()
        print(f'   Tables: {len(db_data.get("tables", []))}')
    else:
        print(f'❌ Direct access failed: {db_response.status_code}')
        print(f'   Response: {db_response.text}')

