#!/usr/bin/env python3
"""
Simple test to verify punches endpoint works without name fetching
"""

import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('.env.local')
load_dotenv()

FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    raise ValueError("FILLOUT_API_TOKEN or FILLOUT_API_KEY must be set")

PUNCHES_TABLE_ID = 't3uPEDXn9wt'
PUNCHES_PUNCH_IN_TIME_FIELD_ID = 'f9ZJj4VR1mg'

def query_fillout(table_id, filters=None, sort=None, limit=50):
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    body = {'limit': limit}
    if filters:
        body['filters'] = filters
    if sort:
        body['sort'] = sort
    
    print(f"📡 Querying {table_id}...")
    response = requests.post(url, headers=headers, json=body)
    if not response.ok:
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        raise Exception(f"API error: {response.status_code} - {error_data}")
    return response.json()

print("=" * 80)
print("Simple Punches Test (No Names)")
print("=" * 80)

# Fetch punches
thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
filters = {'punch_in_time': {'gte': thirty_days_ago}}
sort = [{'fieldId': PUNCHES_PUNCH_IN_TIME_FIELD_ID, 'direction': 'desc'}]

try:
    response = query_fillout(PUNCHES_TABLE_ID, filters=filters, sort=sort, limit=10)
    punches = response.get('records', [])
    
    print(f"\n✅ Fetched {len(punches)} punches")
    
    for punch in punches[:5]:
        fields = punch.get('fields', {})
        print(f"\n  Punch {punch.get('id')}:")
        print(f"    Employee ID: {fields.get('employee_id')}")
        print(f"    Client ID: {fields.get('client_id')}")
        print(f"    Time: {fields.get('punch_in_time')}")
    
    print("\n" + "=" * 80)
    print("✅ Test complete - punches endpoint works!")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
