#!/usr/bin/env python3
"""
Fix the incorrect start_day and end_day values in Pay Period Templates.
The migration script incorrectly paired the days. This script fixes them.
"""

import os
import sys
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv('.env.local')
load_dotenv()

FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    print("❌ Error: FILLOUT_API_TOKEN not found in environment")
    sys.exit(1)

PAY_PERIOD_TEMPLATES_TABLE_ID = 't7RLTQD7xWd'
DEPARTMENTS_TABLE_ID = 'tviEhSR8rfg'

def query_fillout(table_id, filters=None, limit=1000, offset=None):
    """Query Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {'limit': limit}
    if filters:
        body['filters'] = filters
    if offset:
        body['offset'] = str(offset)
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Query error: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def update_record(table_id, record_id, fields):
    """Update a Fillout record"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/{record_id}"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {'record': fields}
    
    response = requests.patch(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Update error: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def main():
    print("=" * 80)
    print("🔧 Fixing Pay Period Template Data")
    print("=" * 80)
    
    # Get a department
    departments_response = query_fillout(DEPARTMENTS_TABLE_ID, limit=10)
    if not departments_response or not departments_response.get('records'):
        print("❌ No departments found")
        return
    
    department = departments_response['records'][0]
    department_id = department['id']
    department_name = department['fields'].get('Name') or department['fields'].get('name') or 'Unknown'
    
    print(f"\n📁 Department: {department_name} ({department_id})")
    
    # Fetch all templates
    templates_response = query_fillout(PAY_PERIOD_TEMPLATES_TABLE_ID, limit=1000)
    if not templates_response:
        print("❌ Failed to fetch templates")
        return
    
    all_templates = templates_response.get('records', [])
    
    # Filter by department_id
    templates = [
        record for record in all_templates
        if record.get('fields', {}).get('department_id') and
        (
            (isinstance(record['fields']['department_id'], list) and 
             department_id in [str(d).strip() for d in record['fields']['department_id']]) or
            str(record['fields']['department_id']).strip() == str(department_id).strip()
        )
    ]
    
    templates.sort(key=lambda t: t.get('fields', {}).get('period_number', 0))
    
    print(f"\n📋 Found {len(templates)} templates for this department\n")
    
    if len(templates) != 2:
        print(f"⚠️ Expected 2 templates, found {len(templates)}")
        return
    
    # Expected correct values:
    # Period 1: Start 11, End 25
    # Period 2: Start 26, End 10
    
    fixes = []
    for template in templates:
        fields = template.get('fields', {})
        period_num = fields.get('period_number')
        current_start = fields.get('start_day')
        current_end = fields.get('end_day')
        
        print(f"Period {period_num}:")
        print(f"  Current: Start {current_start}, End {current_end}")
        
        if period_num == 1:
            expected_start = 11
            expected_end = 25
        elif period_num == 2:
            expected_start = 26
            expected_end = 10
        else:
            print(f"  ⚠️ Unknown period number, skipping")
            continue
        
        if current_start != expected_start or current_end != expected_end:
            print(f"  ❌ INCORRECT - Should be: Start {expected_start}, End {expected_end}")
            fixes.append({
                'record_id': template['id'],
                'period_number': period_num,
                'fields': {
                    'start_day': expected_start,
                    'end_day': expected_end,
                }
            })
        else:
            print(f"  ✅ CORRECT")
    
    if not fixes:
        print("\n✅ All templates are already correct!")
        return
    
    print(f"\n🔧 Fixing {len(fixes)} templates...")
    
    for fix in fixes:
        print(f"\nUpdating Period {fix['period_number']} (record {fix['record_id']})...")
        result = update_record(PAY_PERIOD_TEMPLATES_TABLE_ID, fix['record_id'], fix['fields'])
        if result:
            print(f"  ✅ Updated successfully")
        else:
            print(f"  ❌ Failed to update")
    
    print("\n" + "=" * 80)
    print("✅ Fix complete!")
    print("=" * 80)

if __name__ == '__main__':
    main()

