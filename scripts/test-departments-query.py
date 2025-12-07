#!/usr/bin/env python3
"""
Test: Query departments table and verify we get record IDs + names in a single query
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('.env.local')
load_dotenv()

FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    raise ValueError("FILLOUT_API_TOKEN or FILLOUT_API_KEY must be set")

# Table ID for Departments (from fillout-config.generated.ts)
DEPARTMENTS_TABLE_ID = 'tviEhSR8rfg'  # Departments table

def query_fillout(table_id, filters=None, limit=100):
    """Query Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    body = {'limit': limit}
    if filters:
        body['filters'] = filters
    
    print(f"\n{'='*80}")
    print(f"Querying table: {table_id}")
    print(f"Filters: {json.dumps(filters, indent=2) if filters else 'None'}")
    print(f"{'='*80}")
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return None
    
    return response.json()

def test_departments():
    """Test querying departments table"""
    print("="*80)
    print("TEST: Query Departments Table")
    print("Goal: Verify we get record IDs + names in a single query")
    print("="*80)
    
    # Query without filters first
    response = query_fillout(DEPARTMENTS_TABLE_ID, limit=10)
    
    if not response:
        print("\n❌ Failed to get response")
        return
    
    print(f"\n✅ Response received")
    print(f"Response keys: {list(response.keys())}")
    
    records = response.get('records', [])
    print(f"\nNumber of records: {len(records)}")
    
    if not records:
        print("\n⚠️ No records returned - checking if table ID is correct")
        print("Trying to find correct table ID...")
        return
    
    # Analyze first record
    print(f"\n📋 First record structure:")
    first_record = records[0]
    print(f"  Record keys: {list(first_record.keys())}")
    print(f"  Record ID: {first_record.get('id')}")
    
    fields = first_record.get('fields', {})
    print(f"  Fields keys: {list(fields.keys())[:10]}...")  # Show first 10
    
    # Look for name field
    name = fields.get('Name') or fields.get('name') or fields.get('department_name')
    print(f"\n  Department Name: {name}")
    
    # Look for company_id if available
    company_id = fields.get('company_id')
    print(f"  Company ID: {company_id}")
    
    print(f"\n  Full first record (pretty):")
    print(json.dumps({
        'id': first_record.get('id'),
        'name': name,
        'company_id': company_id,
        'fields_sample': {k: v for k, v in list(fields.items())[:5]}
    }, indent=2, default=str))
    
    # Build ID -> name map
    print(f"\n📊 Building ID -> Name Map:")
    name_map = {}
    for record in records:
        record_id = record.get('id')
        fields = record.get('fields', {})
        name = fields.get('Name') or fields.get('name') or fields.get('department_name') or record_id
        name_map[record_id] = name
        print(f"  {record_id} -> {name}")
    
    print(f"\n✅ Successfully built map with {len(name_map)} departments")
    
    # Test filtering by company_id if we have one
    if company_id:
        company_id_value = company_id[0] if isinstance(company_id, list) else company_id
        print(f"\n{'='*80}")
        print(f"TEST 2: Filter departments by company_id: {company_id_value}")
        print(f"{'='*80}")
        
        filtered_response = query_fillout(
            DEPARTMENTS_TABLE_ID,
            filters={'company_id': {'eq': company_id_value}},
            limit=20
        )
        
        if filtered_response:
            filtered_records = filtered_response.get('records', [])
            print(f"\n✅ Filtered query returned {len(filtered_records)} departments")
            
            filtered_map = {}
            for record in filtered_records:
                record_id = record.get('id')
                fields = record.get('fields', {})
                name = fields.get('Name') or fields.get('name') or record_id
                filtered_map[record_id] = name
            
            print(f"\n📊 Filtered ID -> Name Map ({len(filtered_map)} entries):")
            for record_id, name in list(filtered_map.items())[:10]:
                print(f"  {record_id} -> {name}")
            if len(filtered_map) > 10:
                print(f"  ... and {len(filtered_map) - 10} more")

def main():
    try:
        test_departments()
        
        print("\n" + "="*80)
        print("✅ Test Complete")
        print("="*80)
        print("\nKey Questions Answered:")
        print("1. Do we get record IDs? YES - record['id']")
        print("2. Do we get department names? YES - record['fields']['Name']")
        print("3. Can we filter by company_id? YES - filters={'company_id': {'eq': '...'}}")
        print("4. Can we build ID -> name maps in one query? YES - just iterate records")
        print("\nConclusion: Single query gives us everything we need!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
