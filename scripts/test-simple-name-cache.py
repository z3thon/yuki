#!/usr/bin/env python3
"""
Simple test: Query employees and clients tables and see what we get back.
Do we get record IDs? Do we get names? What's the actual response format?
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

# Table IDs
EMPLOYEES_TABLE_ID = 'tcNK2zZPcAR'
CLIENTS_TABLE_ID = 'te3Gw8PDkS7'

def query_fillout(table_id, filters=None, limit=10):
    """Query Fillout API and return raw response"""
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

def test_employees():
    """Test querying employees table"""
    print("\n" + "="*80)
    print("TEST 1: Query Employees Table")
    print("="*80)
    
    # Query without filters first to see structure
    response = query_fillout(EMPLOYEES_TABLE_ID, limit=5)
    
    if not response:
        return
    
    print(f"\n✅ Response received")
    print(f"Response keys: {list(response.keys())}")
    
    records = response.get('records', [])
    print(f"\nNumber of records: {len(records)}")
    
    if records:
        print(f"\n📋 First record structure:")
        first_record = records[0]
        print(f"  Record keys: {list(first_record.keys())}")
        print(f"  Record ID: {first_record.get('id')}")
        print(f"  Fields keys: {list(first_record.get('fields', {}).keys())}")
        
        fields = first_record.get('fields', {})
        print(f"\n  Field values:")
        print(f"    Name: {fields.get('Name')}")
        print(f"    name: {fields.get('name')}")
        print(f"    email: {fields.get('email')}")
        print(f"    company_id: {fields.get('company_id')}")
        
        print(f"\n  Full first record (pretty):")
        print(json.dumps(first_record, indent=2, default=str))
    
    # Now test with company_id filter
    print(f"\n{'='*80}")
    print("TEST 2: Query Employees with company_id filter")
    print("="*80)
    
    # Get a company_id from first record if available
    if records and records[0].get('fields', {}).get('company_id'):
        company_id = records[0]['fields']['company_id']
        if isinstance(company_id, list):
            company_id = company_id[0]
        print(f"Using company_id from first record: {company_id}")
        
        filtered_response = query_fillout(
            EMPLOYEES_TABLE_ID, 
            filters={'company_id': {'eq': company_id}},
            limit=10
        )
        
        if filtered_response:
            filtered_records = filtered_response.get('records', [])
            print(f"\n✅ Filtered query returned {len(filtered_records)} records")
            
            # Build ID -> name map
            name_map = {}
            for record in filtered_records:
                record_id = record.get('id')
                fields = record.get('fields', {})
                name = fields.get('Name') or fields.get('name') or fields.get('email') or record_id
                name_map[record_id] = name
            
            print(f"\n📊 ID -> Name Map ({len(name_map)} entries):")
            for i, (record_id, name) in enumerate(list(name_map.items())[:5]):
                print(f"  {record_id} -> {name}")
            if len(name_map) > 5:
                print(f"  ... and {len(name_map) - 5} more")

def test_clients():
    """Test querying clients table"""
    print("\n" + "="*80)
    print("TEST 3: Query Clients Table")
    print("="*80)
    
    response = query_fillout(CLIENTS_TABLE_ID, limit=5)
    
    if not response:
        return
    
    records = response.get('records', [])
    print(f"\n✅ Got {len(records)} client records")
    
    if records:
        print(f"\n📋 First client record:")
        first_record = records[0]
        print(f"  Record ID: {first_record.get('id')}")
        fields = first_record.get('fields', {})
        print(f"  Name: {fields.get('Name')}")
        print(f"  name: {fields.get('name')}")
        print(f"  is_active: {fields.get('is_active')}")
        
        # Build ID -> name map
        name_map = {}
        for record in records:
            record_id = record.get('id')
            fields = record.get('fields', {})
            name = fields.get('Name') or fields.get('name') or record_id
            name_map[record_id] = name
        
        print(f"\n📊 Client ID -> Name Map ({len(name_map)} entries):")
        for record_id, name in name_map.items():
            print(f"  {record_id} -> {name}")

def main():
    print("="*80)
    print("Simple Name Cache Test")
    print("Testing: Can we query tables and get record IDs + names?")
    print("="*80)
    
    try:
        test_employees()
        test_clients()
        
        print("\n" + "="*80)
        print("✅ Test Complete")
        print("="*80)
        print("\nKey Questions Answered:")
        print("1. Do we get record IDs? YES - record['id']")
        print("2. Do we get names? YES - record['fields']['Name'] or record['fields']['name']")
        print("3. Can we filter by company_id? YES - filters={'company_id': {'eq': '...'}}")
        print("4. Can we build ID -> name maps? YES - just iterate records")
        print("\nConclusion: This should be SIMPLE. Query table, get records with IDs, build map.")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
