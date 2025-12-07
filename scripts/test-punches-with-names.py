#!/usr/bin/env python3
"""
Test fetching punches with employee and client names
This tests the approach we're using in Next.js
"""

import os
import json
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
load_dotenv()

# Fillout API Configuration
FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    raise ValueError("FILLOUT_API_TOKEN or FILLOUT_API_KEY must be set in environment")

# Table IDs
PUNCHES_TABLE_ID = 't3uPEDXn9wt'
EMPLOYEES_TABLE_ID = 'tcNK2zZPcAR'
CLIENTS_TABLE_ID = 'te3Gw8PDkS7'

# Field IDs
PUNCHES_PUNCH_IN_TIME_FIELD_ID = 'f9ZJj4VR1mg'
EMPLOYEES_NAME_FIELD_ID = 'f3K9qdNnRA9'

def query_fillout(table_id, filters=None, sort=None, limit=50, offset=0):
    """Query Fillout API"""
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
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        raise Exception(f"Fillout API error: {response.status_code} - {error_data.get('error', {}).get('message', response.text)}")
    
    return response.json()

def main():
    print("=" * 80)
    print("Testing Punches with Employee/Client Names")
    print("=" * 80)
    
    # Step 1: Fetch punches
    print("\n1. Fetching punches...")
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    try:
        punches_response = query_fillout(
            table_id=PUNCHES_TABLE_ID,
            filters={'punch_in_time': {'gte': thirty_days_ago}},
            sort=[{'fieldId': PUNCHES_PUNCH_IN_TIME_FIELD_ID, 'direction': 'desc'}],
            limit=10
        )
        
        punches = punches_response.get('records', [])
        print(f"✅ Fetched {len(punches)} punches")
        
        if len(punches) == 0:
            print("⚠️ No punches found")
            return
        
    except Exception as e:
        print(f"❌ Error fetching punches: {e}")
        return
    
    # Step 2: Extract unique IDs
    print("\n2. Extracting unique employee and client IDs...")
    employee_ids = set()
    client_ids = set()
    
    for punch in punches:
        fields = punch.get('fields', {})
        emp_id = fields.get('employee_id')
        cli_id = fields.get('client_id')
        
        if emp_id:
            if isinstance(emp_id, list):
                employee_ids.update(emp_id)
            else:
                employee_ids.add(emp_id)
        
        if cli_id:
            if isinstance(cli_id, list):
                client_ids.update(cli_id)
            else:
                client_ids.add(cli_id)
    
    print(f"   Found {len(employee_ids)} unique employees")
    print(f"   Found {len(client_ids)} unique clients")
    
    if len(employee_ids) == 0 and len(client_ids) == 0:
        print("⚠️ No employee or client IDs found in punches")
        return
    
    # Step 3: Fetch employee names
    employee_name_map = {}
    if employee_ids:
        print(f"\n3. Fetching {len(employee_ids)} employee names...")
        try:
            # Test if filtering by id works
            employee_response = query_fillout(
                table_id=EMPLOYEES_TABLE_ID,
                filters={'id': {'in': list(employee_ids)}},
                limit=1000
            )
            
            for record in employee_response.get('records', []):
                fields = record.get('fields', {})
                name = fields.get('Name') or fields.get('name') or fields.get('email') or 'Unknown'
                employee_name_map[record['id']] = name
            
            print(f"✅ Fetched {len(employee_name_map)} employee names")
            print(f"   Sample names: {list(employee_name_map.values())[:3]}")
            
        except Exception as e:
            print(f"❌ Error fetching employees: {e}")
            print(f"   Trying individual fetches as fallback...")
            # Fallback: fetch individually
            for emp_id in list(employee_ids)[:5]:  # Limit to 5 for testing
                try:
                    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{EMPLOYEES_TABLE_ID}/records/{emp_id}"
                    response = requests.get(url, headers={'Authorization': f'Bearer {FILLOUT_API_TOKEN}'})
                    if response.ok:
                        record = response.json()
                        fields = record.get('fields', {})
                        name = fields.get('Name') or fields.get('name') or fields.get('email') or 'Unknown'
                        employee_name_map[emp_id] = name
                except:
                    pass
            print(f"   Fallback fetched {len(employee_name_map)} names")
    
    # Step 4: Fetch client names
    client_name_map = {}
    if client_ids:
        print(f"\n4. Fetching {len(client_ids)} client names...")
        try:
            client_response = query_fillout(
                table_id=CLIENTS_TABLE_ID,
                filters={'id': {'in': list(client_ids)}},
                limit=1000
            )
            
            for record in client_response.get('records', []):
                fields = record.get('fields', {})
                name = fields.get('Name') or fields.get('name') or 'Unknown'
                client_name_map[record['id']] = name
            
            print(f"✅ Fetched {len(client_name_map)} client names")
            print(f"   Sample names: {list(client_name_map.values())[:3]}")
            
        except Exception as e:
            print(f"❌ Error fetching clients: {e}")
    
    # Step 5: Combine and display results
    print(f"\n5. Combined results:")
    print("=" * 80)
    
    for i, punch in enumerate(punches[:5], 1):
        fields = punch.get('fields', {})
        emp_id = fields.get('employee_id')
        cli_id = fields.get('client_id')
        
        if isinstance(emp_id, list):
            emp_id = emp_id[0] if emp_id else None
        if isinstance(cli_id, list):
            cli_id = cli_id[0] if cli_id else None
        
        emp_name = employee_name_map.get(str(emp_id), 'Unknown') if emp_id else 'Unknown'
        cli_name = client_name_map.get(str(cli_id), 'Unknown') if cli_id else 'Unknown'
        
        punch_time = fields.get('punch_in_time', 'N/A')
        
        print(f"Punch {i}:")
        print(f"  Employee: {emp_name} (ID: {emp_id})")
        print(f"  Client: {cli_name} (ID: {cli_id})")
        print(f"  Time: {punch_time}")
        print()
    
    print("=" * 80)
    print("✅ Test complete!")

if __name__ == '__main__':
    main()
