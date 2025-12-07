#!/usr/bin/env python3
"""
Test department templates API endpoint logic.
Validates that templates are fetched and formatted correctly.
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

def main():
    print("=" * 80)
    print("🧪 Testing Department Templates API Logic")
    print("=" * 80)
    
    # Get a department
    departments_response = query_fillout(DEPARTMENTS_TABLE_ID, limit=10)
    if not departments_response or not departments_response.get('records'):
        print("❌ No departments found")
        return
    
    department = departments_response['records'][0]
    department_id = department['id']
    department_name = department['fields'].get('Name') or department['fields'].get('name') or 'Unknown'
    
    print(f"\n📁 Testing with department: {department_name} ({department_id})")
    
    # Fetch all templates (matching API logic)
    templates_response = query_fillout(PAY_PERIOD_TEMPLATES_TABLE_ID, limit=1000)
    if not templates_response:
        print("❌ Failed to fetch templates")
        return
    
    all_templates = templates_response.get('records', [])
    print(f"\n📋 Fetched {len(all_templates)} total templates")
    
    # Filter by department_id client-side (matching API logic)
    templates = [
        record for record in all_templates
        if record.get('fields', {}).get('department_id') and
        (
            (isinstance(record['fields']['department_id'], list) and 
             department_id in [str(d).strip() for d in record['fields']['department_id']]) or
            str(record['fields']['department_id']).strip() == str(department_id).strip()
        )
    ]
    
    # Filter active templates
    templates = [
        t for t in templates 
        if t.get('fields', {}).get('is_active') is not False
    ]
    
    # Sort by period_number
    templates.sort(key=lambda t: t.get('fields', {}).get('period_number', 0))
    
    print(f"✅ Found {len(templates)} templates for this department")
    
    # Format templates (matching API response)
    formatted_templates = []
    for template in templates:
        fields = template.get('fields', {})
        formatted = {
            'id': template['id'],
            'periodNumber': fields.get('period_number'),
            'startDay': fields.get('start_day'),
            'endDay': fields.get('end_day'),
            'payoutDay': fields.get('payout_day'),
            'payoutMonthOffset': fields.get('payout_month_offset'),
            'isActive': fields.get('is_active') is not False,
        }
        formatted_templates.append(formatted)
    
    # Display results
    print("\n" + "=" * 80)
    print("📊 Formatted Templates")
    print("=" * 80)
    
    for template in formatted_templates:
        payout_display = template['payoutDay']
        if payout_display == 'last':
            payout_display = 'Last day'
        else:
            payout_display = f"Day {payout_display}"
        
        if template['payoutMonthOffset'] == 1:
            payout_display += ' (next month)'
        
        print(f"\nPeriod {template['periodNumber']}:")
        print(f"  Start Day: {template['startDay']}")
        print(f"  End Day: {template['endDay']}")
        print(f"  Payout: {payout_display}")
        print(f"  Active: {template['isActive']}")
    
    print("\n" + "=" * 80)
    print(f"✅ Test Complete! Found {len(formatted_templates)} templates")
    print("=" * 80)
    
    return formatted_templates

if __name__ == '__main__':
    main()

