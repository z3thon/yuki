#!/usr/bin/env python3
"""
Test Fillout API sorting and filtering
Based on: https://www.fillout.com/help/database/list-records
"""

import os
import json
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables (try .env.local first, then .env)
load_dotenv('.env.local')
load_dotenv()  # Fallback to .env if .env.local doesn't exist

# Fillout API Configuration
FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    raise ValueError("FILLOUT_API_TOKEN or FILLOUT_API_KEY must be set in environment")

# Table and Field IDs (from fillout-config.generated.ts)
PUNCHES_TABLE_ID = 't3uPEDXn9wt'  # Punches table ID
PUNCHES_PUNCH_IN_TIME_FIELD_ID = 'f9ZJj4VR1mg'  # punch_in_time field ID

def test_fillout_query(table_id, filters=None, sort=None, limit=50, offset=0):
    """Test Fillout API query with various sort formats"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {
        'limit': limit,
        'offset': offset,
    }
    
    if filters:
        body['filters'] = filters
    
    if sort:
        body['sort'] = sort
    
    print(f"\n{'='*80}")
    print(f"Testing Fillout API Query")
    print(f"{'='*80}")
    print(f"URL: {url}")
    print(f"Request Body:")
    print(json.dumps(body, indent=2))
    print(f"\n{'='*80}")
    
    try:
        response = requests.post(url, headers=headers, json=body)
        
        print(f"Status Code: {response.status_code}")
        
        if not response.ok:
            print(f"❌ Error Response:")
            try:
                error_data = response.json()
                print(json.dumps(error_data, indent=2))
            except:
                print(response.text)
            return None
        
        data = response.json()
        print(f"✅ Success!")
        print(f"Total records: {data.get('total', 0)}")
        print(f"Records returned: {len(data.get('records', []))}")
        print(f"Has more: {data.get('hasMore', False)}")
        
        if data.get('records'):
            print(f"\nFirst record preview:")
            first_record = data['records'][0]
            print(f"  ID: {first_record.get('id')}")
            print(f"  All field names: {list(first_record.get('fields', {}).keys())}")
            
            fields = first_record.get('fields', {})
            
            # Show key fields
            if 'punch_in_time' in fields:
                print(f"  punch_in_time: {fields['punch_in_time']}")
            if 'punch_out_time' in fields:
                print(f"  punch_out_time: {fields['punch_out_time']}")
            if 'employee_id' in fields:
                print(f"  employee_id: {fields['employee_id']}")
            if 'client_id' in fields:
                print(f"  client_id: {fields['client_id']}")
            
            # Show lookup fields (these should be populated automatically)
            if 'employee_name' in fields:
                print(f"  ✅ employee_name (lookup): {fields['employee_name']}")
            else:
                print(f"  ❌ employee_name (lookup): NOT FOUND")
            
            if 'client_name' in fields:
                print(f"  ✅ client_name (lookup): {fields['client_name']}")
            else:
                print(f"  ❌ client_name (lookup): NOT FOUND")
            
            # Also check data object (field IDs)
            data_obj = first_record.get('data', {})
            print(f"\n  Data object (field IDs): {list(data_obj.keys())[:5]}...")
            
            # Check lookup field IDs in data object
            PUNCHES_EMPLOYEE_NAME_FIELD_ID = 'fiPVb28e4ue'  # From generated config
            PUNCHES_CLIENT_NAME_FIELD_ID = 'fb72dNX1c6i'    # From generated config
            
            if PUNCHES_EMPLOYEE_NAME_FIELD_ID in data_obj:
                print(f"  ✅ employee_name (field ID {PUNCHES_EMPLOYEE_NAME_FIELD_ID}): {data_obj[PUNCHES_EMPLOYEE_NAME_FIELD_ID]}")
            else:
                print(f"  ❌ employee_name field ID {PUNCHES_EMPLOYEE_NAME_FIELD_ID} not found in data object")
            
            if PUNCHES_CLIENT_NAME_FIELD_ID in data_obj:
                print(f"  ✅ client_name (field ID {PUNCHES_CLIENT_NAME_FIELD_ID}): {data_obj[PUNCHES_CLIENT_NAME_FIELD_ID]}")
            else:
                print(f"  ❌ client_name field ID {PUNCHES_CLIENT_NAME_FIELD_ID} not found in data object")
            
            # Show full data object for first record
            print(f"\n  Full data object (first record):")
            print(json.dumps(data_obj, indent=4, default=str))
            
            # Show a few sample records with names from both sources
            print(f"\n  Sample records with names:")
            for i, record in enumerate(data['records'][:3]):
                rec_fields = record.get('fields', {})
                rec_data = record.get('data', {})
                
                # Try fields object first
                emp_name_fields = rec_fields.get('employee_name', None)
                cli_name_fields = rec_fields.get('client_name', None)
                
                # Try data object (field IDs)
                emp_name_data = rec_data.get(PUNCHES_EMPLOYEE_NAME_FIELD_ID, None)
                cli_name_data = rec_data.get(PUNCHES_CLIENT_NAME_FIELD_ID, None)
                
                punch_time = rec_fields.get('punch_in_time', 'N/A')
                
                print(f"    Record {i+1}:")
                print(f"      Time: {punch_time}")
                print(f"      Employee (fields): {emp_name_fields}")
                print(f"      Employee (data): {emp_name_data}")
                print(f"      Client (fields): {cli_name_fields}")
                print(f"      Client (data): {cli_name_data}")
        
        return data
    
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("Fillout API Sort Testing Script")
    print("=" * 80)
    
    # First, let's find the Punches table ID
    # We'll try to query by table name first (Fillout API supports this)
    print("\nStep 1: Finding Punches table...")
    
    # Use table ID (more reliable than table name)
    punches_table_id = PUNCHES_TABLE_ID
    
    # Get last 30 days date filter
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    filters = {
        'punch_in_time': {
            'gte': thirty_days_ago
        }
    }
    
    # Test 1: No sort (baseline)
    print("\n" + "="*80)
    print("TEST 1: Query without sort (baseline)")
    print("="*80)
    test_fillout_query(
        table_id=punches_table_id,
        filters=filters,
        sort=None,
        limit=5
    )
    
    # Test 2: Sort with field name (what we're currently using)
    print("\n" + "="*80)
    print("TEST 2: Sort with field NAME 'punch_in_time'")
    print("="*80)
    test_fillout_query(
        table_id=punches_table_id,
        filters=filters,
        sort=[{'field': 'punch_in_time', 'direction': 'desc'}],
        limit=5
    )
    
    # Test 3: Sort with field ID
    print("\n" + "="*80)
    print("TEST 3: Sort with field ID")
    print("="*80)
    test_fillout_query(
        table_id=punches_table_id,
        filters=filters,
        sort=[{'field': PUNCHES_PUNCH_IN_TIME_FIELD_ID, 'direction': 'desc'}],
        limit=5
    )
    
    # Test 4: Different sort format (maybe it's not an array?)
    print("\n" + "="*80)
    print("TEST 4: Sort as single object (not array)")
    print("="*80)
    test_fillout_query(
        table_id=punches_table_id,
        filters=filters,
        sort={'field': 'punch_in_time', 'direction': 'desc'},
        limit=5
    )
    
    # Test 5: Sort with different key names (THIS ONE WORKS!)
    print("\n" + "="*80)
    print("TEST 5: Sort with 'fieldId' instead of 'field' (WORKING FORMAT)")
    print("="*80)
    result = test_fillout_query(
        table_id=punches_table_id,
        filters=filters,
        sort=[{'fieldId': PUNCHES_PUNCH_IN_TIME_FIELD_ID, 'direction': 'desc'}],
        limit=10  # Get more records to see pattern
    )
    
    # Additional analysis of lookup fields
    if result and result.get('records'):
        print(f"\n{'='*80}")
        print("LOOKUP FIELD ANALYSIS")
        print(f"{'='*80}")
        print(f"Total records analyzed: {len(result['records'])}")
        
        # Count how many have populated lookup fields
        emp_name_populated = 0
        cli_name_populated = 0
        
        for record in result['records']:
            fields = record.get('fields', {})
            emp_name = fields.get('employee_name')
            cli_name = fields.get('client_name')
            
            # Check if it's a non-empty value (not empty array, None, or empty string)
            if emp_name and (isinstance(emp_name, str) or (isinstance(emp_name, list) and len(emp_name) > 0)):
                emp_name_populated += 1
            if cli_name and (isinstance(cli_name, str) or (isinstance(cli_name, list) and len(cli_name) > 0)):
                cli_name_populated += 1
        
        print(f"Records with employee_name populated: {emp_name_populated}/{len(result['records'])}")
        print(f"Records with client_name populated: {cli_name_populated}/{len(result['records'])}")
        
        if emp_name_populated == 0 and cli_name_populated == 0:
            print("\n⚠️  WARNING: Lookup fields are not being populated by Fillout API")
            print("   This could mean:")
            print("   1. Lookup fields need to be configured differently in Fillout")
            print("   2. Lookup fields need to be explicitly requested")
            print("   3. We need to fetch related records separately and join them")
    
    # Test 6: Sort with 'order' instead of 'direction'
    print("\n" + "="*80)
    print("TEST 6: Sort with 'order' instead of 'direction'")
    print("="*80)
    test_fillout_query(
        table_id=punches_table_id,
        filters=filters,
        sort=[{'field': PUNCHES_PUNCH_IN_TIME_FIELD_ID, 'order': 'desc'}],
        limit=5
    )
    
    print("\n" + "="*80)
    print("Testing Complete!")
    print("="*80)

if __name__ == '__main__':
    main()
