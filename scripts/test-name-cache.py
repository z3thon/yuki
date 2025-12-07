#!/usr/bin/env python3
"""
Test the name cache approach: fetch employees and clients for a company
and validate that we can match names to IDs efficiently.
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Set, List

# Fillout API configuration
from dotenv import load_dotenv
load_dotenv('.env.local')
load_dotenv()

FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    raise ValueError("FILLOUT_API_TOKEN or FILLOUT_API_KEY must be set in environment")

# Table IDs (from fillout-config.generated.ts)
EMPLOYEES_TABLE_ID = 'tcNK2zZPcAR'  # Employees
CLIENTS_TABLE_ID = 'te3Gw8PDkS7'  # Clients
CLIENT_EMPLOYEE_ACCESS_TABLE_ID = 'tt5JxJuYHSQ'  # Client Employee Access
PUNCHES_TABLE_ID = 't3uPEDXn9wt'  # Punches

# Field IDs (from fillout-config.generated.ts)
EMPLOYEES_COMPANY_ID_FIELD_ID = 'fuLkEWaHUgU'
EMPLOYEES_NAME_FIELD_ID = 'f3K9qdNnRA9'
CLIENT_EMPLOYEE_ACCESS_EMPLOYEE_ID_FIELD_ID = 'fuhEsTwF8kJ'
CLIENT_EMPLOYEE_ACCESS_CLIENT_ID_FIELD_ID = 'f681n9u8ovE'
CLIENT_EMPLOYEE_ACCESS_END_DATE_FIELD_ID = 'fo2k9La7cgp'
PUNCHES_PUNCH_IN_TIME_FIELD_ID = 'f9ZJj4VR1mg'

def query_fillout(table_id: str, filters: Dict = None, sort: List[Dict] = None, limit: int = 1000, offset: int = 0):
    """Query Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'limit': limit,
    }
    if offset:
        payload['offset'] = offset
    if filters:
        payload['filters'] = filters
    if sort:
        payload['sort'] = sort
    
    print(f"📡 Querying {table_id}...")
    if filters:
        print(f"   Filters: {filters}")
    if sort:
        print(f"   Sort: {sort}")
    
    response = requests.post(url, json=payload, headers=headers)
    if not response.ok:
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        raise Exception(f"Fillout API error: {response.status_code} - {error_data.get('error', {}).get('message', response.text)}")
    return response.json()

def get_company_id_for_user(user_email: str) -> str:
    """Get company_id for a user by finding their employee record"""
    print(f"\n🔍 Finding company_id for user: {user_email}")
    
    # Query employees by email
    filters = {
        'email': {'eq': user_email.lower().strip()}
    }
    
    response = query_fillout(EMPLOYEES_TABLE_ID, filters=filters, limit=1)
    records = response.get('records', [])
    
    if not records:
        print("❌ No employee found for email")
        return None
    
    employee = records[0]
    fields = employee.get('fields', {})
    
    # Get company_id (could be array or single value)
    company_id = fields.get(EMPLOYEES_COMPANY_ID_FIELD_ID) or fields.get('company_id')
    if isinstance(company_id, list):
        company_id = company_id[0] if company_id else None
    
    if company_id:
        print(f"✅ Found company_id: {company_id}")
        return str(company_id)
    else:
        print("❌ No company_id found")
        return None

def fetch_employees_for_company(company_id: str) -> Dict[str, str]:
    """Fetch all employees for a company and return ID -> name map"""
    print(f"\n👥 Fetching employees for company {company_id}...")
    
    name_map = {}
    
    try:
        filters = {
            EMPLOYEES_COMPANY_ID_FIELD_ID: {'eq': company_id}
        }
        
        response = query_fillout(EMPLOYEES_TABLE_ID, filters=filters, limit=1000)
        records = response.get('records', [])
        
        for record in records:
            fields = record.get('fields', {})
            employee_id = record.get('id')
            
            # Try multiple field names for name
            name = (
                fields.get(EMPLOYEES_NAME_FIELD_ID) or
                fields.get('Name') or
                fields.get('name') or
                fields.get('email') or
                'Unknown'
            )
            
            if name and isinstance(name, list):
                name = name[0] if name else 'Unknown'
            
            name_map[employee_id] = str(name).strip() if name else 'Unknown'
        
        print(f"✅ Fetched {len(name_map)} employee names")
        for emp_id, name in list(name_map.items())[:5]:  # Show first 5
            print(f"   {emp_id}: {name}")
        if len(name_map) > 5:
            print(f"   ... and {len(name_map) - 5} more")
            
    except Exception as e:
        print(f"❌ Error fetching employees: {e}")
    
    return name_map

def fetch_clients_for_company(company_id: str, employee_ids: List[str]) -> Dict[str, str]:
    """Fetch all clients accessible to employees in a company"""
    print(f"\n🏢 Fetching clients for company {company_id} (via {len(employee_ids)} employees)...")
    
    name_map = {}
    
    try:
        # Step 1: Get Client Employee Access records
        if not employee_ids:
            print("⏭️ No employee IDs, skipping client fetch")
            return name_map
        
        filters = {
            CLIENT_EMPLOYEE_ACCESS_EMPLOYEE_ID_FIELD_ID: {'in': employee_ids}
        }
        
        access_response = query_fillout(CLIENT_EMPLOYEE_ACCESS_TABLE_ID, filters=filters, limit=1000)
        access_records = access_response.get('records', [])
        
        print(f"📋 Found {len(access_records)} Client Employee Access records")
        
        # Step 2: Extract unique client IDs (filter out inactive access)
        client_ids = set()
        now = datetime.now()
        
        for record in access_records:
            fields = record.get('fields', {})
            end_date = fields.get(CLIENT_EMPLOYEE_ACCESS_END_DATE_FIELD_ID) or fields.get('end_date')
            
            # Only include if end_date is null or in the future
            if not end_date or (isinstance(end_date, str) and datetime.fromisoformat(end_date.replace('Z', '+00:00')) > now):
                client_id = fields.get(CLIENT_EMPLOYEE_ACCESS_CLIENT_ID_FIELD_ID) or fields.get('client_id')
                if isinstance(client_id, list):
                    client_id = client_id[0] if client_id else None
                
                if client_id:
                    client_ids.add(str(client_id))
        
        print(f"✅ Found {len(client_ids)} unique active client IDs")
        
        if not client_ids:
            return name_map
        
        # Step 3: Fetch client names
        filters = {
            'id': {'in': list(client_ids)},
            'is_active': {'eq': True}
        }
        
        clients_response = query_fillout(CLIENTS_TABLE_ID, filters=filters, limit=1000)
        client_records = clients_response.get('records', [])
        
        for record in client_records:
            fields = record.get('fields', {})
            client_id = record.get('id')
            
            name = (
                fields.get('Name') or
                fields.get('name') or
                'Unknown'
            )
            
            if name and isinstance(name, list):
                name = name[0] if name else 'Unknown'
            
            name_map[client_id] = str(name).strip() if name else 'Unknown'
        
        print(f"✅ Fetched {len(name_map)} client names")
        for cli_id, name in list(name_map.items())[:5]:  # Show first 5
            print(f"   {cli_id}: {name}")
        if len(name_map) > 5:
            print(f"   ... and {len(name_map) - 5} more")
            
    except Exception as e:
        print(f"❌ Error fetching clients: {e}")
        import traceback
        traceback.print_exc()
    
    return name_map

def test_punches_with_cached_names():
    """Test fetching punches and matching names from cache"""
    print("=" * 80)
    print("Testing Name Cache Approach")
    print("=" * 80)
    
    # Step 1: Get a test user's company_id
    # You'll need to provide a real email from your system
    test_email = input("\nEnter a test user email (or press Enter to skip): ").strip()
    if not test_email:
        print("⚠️ Skipping company_id lookup - will test with manual company_id")
        company_id = input("Enter a company_id to test (or press Enter to exit): ").strip()
        if not company_id:
            return
    else:
        company_id = get_company_id_for_user(test_email)
        if not company_id:
            print("❌ Could not determine company_id")
            return
    
    # Step 2: Fetch employees for company (this is the "cache")
    employee_name_map = fetch_employees_for_company(company_id)
    employee_ids = list(employee_name_map.keys())
    
    # Step 3: Fetch clients for company (this is the "cache")
    client_name_map = fetch_clients_for_company(company_id, employee_ids)
    
    # Step 4: Fetch some punches
    print(f"\n⏰ Fetching punches...")
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    filters = {
        'punch_in_time': {'gte': thirty_days_ago}
    }
    
    sort = [{
        'fieldId': PUNCHES_PUNCH_IN_TIME_FIELD_ID,
        'direction': 'desc'
    }]
    
    punches_response = query_fillout(PUNCHES_TABLE_ID, filters=filters, sort=sort, limit=10)
    punches = punches_response.get('records', [])
    
    print(f"✅ Fetched {len(punches)} punches")
    
    # Step 5: Match names using the "cache"
    print(f"\n🔗 Matching names using cache...")
    matched_count = 0
    
    for punch in punches:
        fields = punch.get('fields', {})
        punch_id = punch.get('id')
        
        # Get employee_id and client_id
        employee_id = fields.get('employee_id')
        if isinstance(employee_id, list):
            employee_id = employee_id[0] if employee_id else None
        
        client_id = fields.get('client_id')
        if isinstance(client_id, list):
            client_id = client_id[0] if client_id else None
        
        # Look up names from cache
        employee_name = employee_name_map.get(str(employee_id) if employee_id else '', 'Unknown')
        client_name = client_name_map.get(str(client_id) if client_id else '', 'Unknown')
        
        punch_in_time = fields.get('punch_in_time', 'N/A')
        
        print(f"\n  Punch {punch_id}:")
        print(f"    Employee: {employee_name} (ID: {employee_id})")
        print(f"    Client: {client_name} (ID: {client_id})")
        print(f"    Time: {punch_in_time}")
        
        if employee_name != 'Unknown' or client_name != 'Unknown':
            matched_count += 1
    
    print(f"\n✅ Successfully matched names for {matched_count}/{len(punches)} punches")
    print(f"📊 Cache stats:")
    print(f"   Employees cached: {len(employee_name_map)}")
    print(f"   Clients cached: {len(client_name_map)}")
    
    print("\n" + "=" * 80)
    print("✅ Name cache test complete!")
    print("=" * 80)

if __name__ == '__main__':
    test_punches_with_cached_names()
