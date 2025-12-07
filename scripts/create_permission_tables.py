#!/usr/bin/env python3
"""
Script to create permission tables in Fillout Database

Usage:
    python scripts/create_permission_tables.py

Make sure .env.local has FILLOUT_API_TOKEN and FILLOUT_BASE_ID set
"""

import os
import json
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
load_dotenv()  # Also load .env if it exists

FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')  # Primary database ID
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    print('❌ FILLOUT_API_TOKEN or FILLOUT_API_KEY not found in environment variables')
    print('   Make sure .env.local exists and has FILLOUT_API_TOKEN set')
    sys.exit(1)

if not FILLOUT_BASE_ID:
    print('❌ FILLOUT_BASE_ID not found in environment variables')
    sys.exit(1)

# Verify database access before proceeding
def verify_database_access():
    """Verify that we can access the target database"""
    try:
        import requests
        response = requests.get(
            f'https://tables.fillout.com/api/v1/bases/{FILLOUT_BASE_ID}',
            headers={'Authorization': f'Bearer {FILLOUT_API_TOKEN}'}
        )
        
        if not response.ok:
            if response.status_code == 404:
                print(f'\n⚠️  WARNING: Database {FILLOUT_BASE_ID} not found or not accessible with current API token')
                print('   Please verify:')
                print('   1. The database ID is correct')
                print('   2. The API token has access to this database')
                print('   3. You may need to grant access in Fillout dashboard')
                return False
            else:
                print(f'\n⚠️  Error accessing database: {response.status_code}')
                return False
        
        db_data = response.json()
        print(f'✅ Database access verified: {db_data.get("name", "Unknown")}')
        return True
    except Exception as e:
        print(f'\n⚠️  Error verifying database access: {e}')
        return False


def find_table_by_name(table_name):
    """Find a table by name in the database"""
    # Try correct API endpoint format
    url = f'https://tables.fillout.com/api/v1/bases/{FILLOUT_BASE_ID}'
    
    try:
        import requests
        response = requests.get(
            url,
            headers={'Authorization': f'Bearer {FILLOUT_API_TOKEN}'}
        )
        
        if not response.ok:
            print(f'   ⚠️  Error fetching database: {response.status_code} {response.text}')
            return None
        
        data = response.json()
        tables = data.get('tables', [])
        
        for table in tables:
            if table.get('name', '').lower() == table_name.lower():
                return table
        
        return None
    except Exception as e:
        print(f'   ⚠️  Error finding table: {e}')
        return None


def create_table(table_name, fields):
    """Create a new table in Fillout"""
    # Use correct API endpoint format
    url = f'https://tables.fillout.com/api/v1/bases/{FILLOUT_BASE_ID}/tables'
    
    print(f'\n📋 Creating table: {table_name}...')
    print(f'   Fields: {", ".join([f["name"] for f in fields])}')
    
    try:
        import requests
        
        payload = {
            'name': table_name,
            'fields': [
                {
                    'name': field['name'],
                    'type': field['type'],
                    'template': field.get('options', {}),
                    'required': field.get('required', False)
                }
                for field in fields
            ]
        }
        
        response = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        if not response.ok:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {'message': response.text}
            
            # Check if table already exists
            if response.status_code == 400 and ('exists' in str(error_data).lower() or 'duplicate' in str(error_data).lower()):
                print(f'   ⚠️  Table "{table_name}" may already exist')
                return None
            
            raise Exception(f'Fillout API error ({response.status_code}): {json.dumps(error_data)}')
        
        data = response.json()
        table_id = data.get('id') or data.get('table', {}).get('id') or 'N/A'
        print(f'   ✅ Table created successfully!')
        print(f'   📍 Table ID: {table_id}')
        
        return data
    except Exception as e:
        print(f'   ❌ Error creating table: {e}')
        raise


def main():
    print('🚀 Creating Permission Tables in Fillout Database')
    print(f'📦 Database ID: {FILLOUT_BASE_ID}')
    print(f'🔗 Base URL: {FILLOUT_BASE_URL}\n')
    
    # Check if requests is installed
    try:
        import requests
    except ImportError:
        print('❌ requests library not found')
        print('   Install it with: pip3 install requests python-dotenv')
        sys.exit(1)
    
    # Verify database access
    if not verify_database_access():
        print('\n❌ Cannot proceed without database access')
        print('   Please grant API token access to the database in Fillout dashboard')
        sys.exit(1)
    
    results = {}
    
    # 1. User App Access Table
    user_app_access_table = find_table_by_name('User App Access')
    if user_app_access_table:
        print('✅ Table "User App Access" already exists')
        results['USER_APP_ACCESS_TABLE_ID'] = user_app_access_table['id']
    else:
        table = create_table('User App Access', [
            {'name': 'user_id', 'type': 'single_line_text', 'required': True},
            {'name': 'app_id', 'type': 'single_select', 'required': True, 'options': {
                'choices': [
                    {'name': 'hr', 'color': 'blue'},
                    {'name': 'crm', 'color': 'purple'},
                    {'name': 'billing', 'color': 'pink'}
                ]
            }},
            {'name': 'granted_at', 'type': 'datetime', 'required': True},
            {'name': 'created_at', 'type': 'datetime', 'required': True},
            {'name': 'updated_at', 'type': 'datetime', 'required': True},
        ])
        
        if table:
            results['USER_APP_ACCESS_TABLE_ID'] = table.get('id') or table.get('table', {}).get('id') or ''
    
    # 2. User Permissions Table
    user_permissions_table = find_table_by_name('User Permissions')
    if user_permissions_table:
        print('✅ Table "User Permissions" already exists')
        results['USER_PERMISSIONS_TABLE_ID'] = user_permissions_table['id']
    else:
        table = create_table('User Permissions', [
            {'name': 'user_id', 'type': 'single_line_text', 'required': True},
            {'name': 'app_id', 'type': 'single_select', 'required': True, 'options': {
                'choices': [
                    {'name': 'hr', 'color': 'blue'},
                    {'name': 'crm', 'color': 'purple'},
                    {'name': 'billing', 'color': 'pink'}
                ]
            }},
            {'name': 'view_id', 'type': 'single_line_text', 'required': False},
            {'name': 'resource_type', 'type': 'single_line_text', 'required': False},
            {'name': 'resource_id', 'type': 'single_line_text', 'required': False},
            {'name': 'actions', 'type': 'multiple_select', 'required': True, 'options': {
                'choices': [
                    {'name': 'read', 'color': 'blue'},
                    {'name': 'write', 'color': 'green'},
                    {'name': 'delete', 'color': 'red'},
                    {'name': 'approve', 'color': 'orange'}
                ]
            }},
            {'name': 'created_at', 'type': 'datetime', 'required': True},
            {'name': 'updated_at', 'type': 'datetime', 'required': True},
        ])
        
        if table:
            results['USER_PERMISSIONS_TABLE_ID'] = table.get('id') or table.get('table', {}).get('id') or ''
    
    # 3. Views Table (try different names - "Views" might be reserved)
    view_table_names = ['User Views', 'App Views', 'Dashboard Views', 'Custom Views', 'Views']
    views_table = None
    
    for name in view_table_names:
        views_table = find_table_by_name(name)
        if views_table:
            break
    
    if views_table:
        print(f'✅ Table "{views_table["name"]}" already exists')
        results['VIEWS_TABLE_ID'] = views_table['id']
    else:
        # Try creating with different names
        created = False
        for table_name in view_table_names:
            try:
                print(f'\n   Trying table name: {table_name}...')
                # Try with just essential fields
                table = create_table(table_name, [
                    {'name': 'app_id', 'type': 'single_select', 'required': True, 'options': {
                        'choices': [
                            {'name': 'hr', 'color': 'blue'},
                            {'name': 'crm', 'color': 'purple'},
                            {'name': 'billing', 'color': 'pink'}
                        ]
                    }},
                    {'name': 'name', 'type': 'single_line_text', 'required': True},
                    {'name': 'config', 'type': 'long_text', 'required': True},
                ])
                
                if table:
                    results['VIEWS_TABLE_ID'] = table.get('id') or table.get('table', {}).get('id') or ''
                    print(f'   ✅ Successfully created: {table_name}')
                    created = True
                    break
            except Exception as e:
                if table_name == view_table_names[-1]:
                    # Last attempt failed
                    print(f'   ⚠️  All table name attempts failed: {e}')
                    print('   💡 You need to create the Views table manually via Fillout UI')
                    print('   💡 Suggested name: "User Views" or "App Views"')
                    print('   💡 Suggested fields: app_id (select), name (text), config (long_text)')
                continue
        
        if not created and not results.get('VIEWS_TABLE_ID'):
            print('   ⚠️  Views table creation failed - create manually via Fillout UI')
    
    # Summary
    print('\n' + '=' * 60)
    print('📊 Summary')
    print('=' * 60)
    
    if results.get('USER_APP_ACCESS_TABLE_ID'):
        print(f'✅ USER_APP_ACCESS_TABLE_ID: {results["USER_APP_ACCESS_TABLE_ID"]}')
    if results.get('USER_PERMISSIONS_TABLE_ID'):
        print(f'✅ USER_PERMISSIONS_TABLE_ID: {results["USER_PERMISSIONS_TABLE_ID"]}')
    if results.get('VIEWS_TABLE_ID'):
        print(f'✅ VIEWS_TABLE_ID: {results["VIEWS_TABLE_ID"]}')
    
    print('\n💡 Add these to your .env.local file:')
    print(f'   FILLOUT_BASE_ID={FILLOUT_BASE_ID}')
    print(f'   USER_APP_ACCESS_TABLE_ID={results.get("USER_APP_ACCESS_TABLE_ID", "your_table_id")}')
    print(f'   USER_PERMISSIONS_TABLE_ID={results.get("USER_PERMISSIONS_TABLE_ID", "your_table_id")}')
    print(f'   VIEWS_TABLE_ID={results.get("VIEWS_TABLE_ID", "your_table_id")}')
    
    print('\n✨ Done! Tables are ready to use.')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n⚠️  Interrupted by user')
        sys.exit(1)
    except Exception as error:
        print(f'\n❌ Script failed: {error}')
        sys.exit(1)

