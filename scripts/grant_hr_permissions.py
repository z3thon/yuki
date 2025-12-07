#!/usr/bin/env python3
"""
One-time script to grant HR app access and all default view permissions
Queries existing records and creates missing ones
Usage: python scripts/grant_hr_permissions.py
"""

import os
import sys
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Fillout API configuration - use correct base ID
FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

# Table IDs - correct IDs from env
USER_APP_ACCESS_TABLE_ID = os.getenv('USER_APP_ACCESS_TABLE_ID', 'tpwLPMUfiwS')
USER_PERMISSIONS_TABLE_ID = os.getenv('USER_PERMISSIONS_TABLE_ID', 't8bkw75uxCC')

# Known Firebase UIDs
KNOWN_UIDS = {
    'rosson@discover-nocode.com': 'QIcvJl1MA3cMw26PwzkJVnmgaJu2',
    'andrea@discover-nocode.com': '6BoZDbgwDWhfdMGIGT6lXcPbaH62',
}

HR_VIEWS = ['employees', 'time-tracking', 'punch-alterations', 'pay-periods']

def fillout_request(method, endpoint, data=None):
    """Make a request to Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}{endpoint}"
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    print(f"   🔍 {method} {endpoint}")
    
    if method == 'POST':
        response = requests.post(url, headers=headers, json=data)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    if not response.ok:
        error_text = response.text
        raise Exception(f"Fillout API error ({response.status_code}): {error_text}")
    
    return response.json()

def query_records(table_id, filters=None, base_id=None):
    """Query records from a Fillout table"""
    base = base_id or FILLOUT_BASE_ID
    try:
        url = f"{FILLOUT_BASE_URL}/{base}/tables/{table_id}/records/list"
        headers = {
            'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
            'Content-Type': 'application/json',
        }
        response = requests.post(url, headers=headers, json={
            'filters': filters or {},
            'limit': 100,
        })
        if not response.ok:
            raise Exception(f"Fillout API error ({response.status_code}): {response.text}")
        result = response.json()
        return result.get('records', [])
    except Exception as e:
        print(f"   ⚠️  Query error: {e}")
        return []

def create_record(table_id, fields, base_id=None):
    """Create a record in a Fillout table
    According to docs: POST /bases/{databaseId}/tables/{tableId}/records
    Request body: {"fields": {...}}
    """
    base = base_id or FILLOUT_BASE_ID
    try:
        # According to docs: POST /bases/{databaseId}/tables/{tableId}/records
        url = f"{FILLOUT_BASE_URL}/{base}/tables/{table_id}/records"
        headers = {
            'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
            'Content-Type': 'application/json',
        }
        # Discovery: API expects {"record": {field_name: value, ...}} format
        # Fields go directly under "record", NOT nested in "fields"
        payload = {'record': fields}
        print(f"   🔍 POST {url}")
        print(f"   📤 Payload: {json.dumps(payload, indent=2, default=str)}")
        response = requests.post(url, headers=headers, json=payload)
        if not response.ok:
            error_text = response.text
            print(f"   ❌ Error response: {error_text}")
            # If base not found, suggest checking token access
            if 'NOT_FOUND' in error_text or 'Base not found' in error_text:
                print(f"   💡 Tip: API token may not have access to base {base}")
                print(f"      Verify token has access to this base in Fillout settings")
            raise Exception(f"Fillout API error ({response.status_code}): {error_text}")
        result = response.json()
        print(f"   ✅ Success: {result.get('id', 'record created')}")
        return result
    except Exception as e:
        print(f"   ❌ Create error: {e}")
        raise

def list_databases():
    """List all accessible databases"""
    try:
        # According to docs: GET /bases returns array of databases with tables
        url = f"{FILLOUT_BASE_URL.replace('/bases', '')}/bases"
        headers = {
            'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        }
        response = requests.get(url, headers=headers)
        if response.ok:
            databases = response.json()
            print(f"   ✅ Found {len(databases)} accessible database(s)")
            return databases
        else:
            print(f"   ⚠️  Could not list databases: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"   ⚠️  Error listing databases: {e}")
        return []

def find_base_with_table(databases, table_name):
    """Find which base contains a table by name"""
    for db in databases:
        db_id = db.get('id')
        db_name = db.get('name', 'Unknown')
        tables = db.get('tables', [])
        for table in tables:
            if table.get('name') == table_name:
                return db_id, db_name
    return None, None

def main():
    if not FILLOUT_API_TOKEN:
        print("❌ Error: FILLOUT_API_TOKEN not found in environment variables")
        sys.exit(1)
    
    print("🚀 Granting HR permissions...")
    print(f"📋 Users: {', '.join(KNOWN_UIDS.keys())}")
    print(f"🔑 Using API token: {FILLOUT_API_TOKEN[:20]}...")
    print(f"🌐 Target base: {FILLOUT_BASE_ID}")
    print(f"📋 Table IDs: User App Access={USER_APP_ACCESS_TABLE_ID}, User Permissions={USER_PERMISSIONS_TABLE_ID}")
    
    # Test base access first
    print(f"\n🔍 Testing access to base {FILLOUT_BASE_ID}...")
    test_url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}"
    test_headers = {'Authorization': f'Bearer {FILLOUT_API_TOKEN}'}
    test_resp = requests.get(test_url, headers=test_headers)
    
    if not test_resp.ok:
        print(f"   ⚠️  Cannot access base directly: {test_resp.status_code}")
        print(f"   Error: {test_resp.text[:200]}")
        print(f"\n   💡 The API token may need to be granted access to this base.")
        print(f"   Or the base may be in a different Fillout account.")
        print(f"\n   Continuing anyway - will try to create records...")
    else:
        print(f"   ✅ Base access confirmed!")
        db_info = test_resp.json()
        print(f"   Base name: {db_info.get('name', 'Unknown')}")
    
    working_base_id = FILLOUT_BASE_ID
    actual_app_access_table_id = USER_APP_ACCESS_TABLE_ID
    actual_perms_table_id = USER_PERMISSIONS_TABLE_ID
    
    # Test API access by querying existing records
    print("\n🔍 Querying existing records...")
    existing_access = query_records(actual_app_access_table_id, base_id=working_base_id)
    existing_perms = query_records(actual_perms_table_id, base_id=working_base_id)
    
    print(f"   Found {len(existing_access)} existing app access records")
    print(f"   Found {len(existing_perms)} existing permission records")
    
    # Process each user
    for email, user_id in KNOWN_UIDS.items():
        print(f"\n📧 Processing: {email}")
        print(f"   Firebase UID: {user_id}")
        
        # Check existing app access
        user_access = [r for r in existing_access 
                      if r.get('fields', {}).get('user_id') == user_id 
                      and r.get('fields', {}).get('app_id') == 'hr']
        
        if user_access:
            print(f"   ✅ HR app access already exists")
        else:
            print(f"   ➕ Creating HR app access...")
            try:
                # Only include fields that aren't auto-generated
                # granted_at, created_at, updated_at may be auto-generated
                record_fields = {
                    'user_id': user_id,
                    'app_id': 'hr',
                }
                # Try with granted_at first, if it fails try without
                try:
                    record_fields['granted_at'] = datetime.now().isoformat()
                    create_record(actual_app_access_table_id, record_fields, base_id=working_base_id)
                except Exception as e:
                    if 'granted_at' in str(e) or 'field' in str(e).lower():
                        print(f"   ⚠️  Retrying without granted_at (may be auto-generated)...")
                        record_fields.pop('granted_at', None)
                        create_record(actual_app_access_table_id, record_fields, base_id=working_base_id)
                    else:
                        raise
                print(f"   ✅ HR app access created")
            except Exception as e:
                print(f"   ❌ Failed: {e}")
                continue
        
        # Check and create view permissions
        user_perms = [r for r in existing_perms 
                     if r.get('fields', {}).get('user_id') == user_id 
                     and r.get('fields', {}).get('app_id') == 'hr']
        
        existing_view_ids = [r.get('fields', {}).get('view_id') for r in user_perms]
        missing_views = [v for v in HR_VIEWS if v not in existing_view_ids]
        
        if missing_views:
            print(f"   ➕ Creating permissions for: {', '.join(missing_views)}")
            for view_id in missing_views:
                try:
                    create_record(actual_perms_table_id, {
                        'user_id': user_id,
                        'app_id': 'hr',
                        'view_id': view_id,
                        'resource_type': None,
                        'resource_id': None,
                        'actions': ['read', 'write'],
                    }, base_id=working_base_id)
                    print(f"   ✅ Permission created for: {view_id}")
                except Exception as e:
                    print(f"   ❌ Failed to create permission for {view_id}: {e}")
        else:
            print(f"   ✅ All view permissions already exist")
        
        print(f"   ✨ Complete!")
    
    print("\n✅ All done!")

if __name__ == '__main__':
    main()
