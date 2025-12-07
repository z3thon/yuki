#!/usr/bin/env python3
"""
Test script to calculate employee hours from punches for a pay period.
This helps us verify the logic before implementing in Next.js.
"""

import os
import sys
import json
from datetime import datetime, timedelta
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

# Table IDs
PAY_PERIODS_TABLE_ID = 'tk8fyCDXQ8H'
TIME_CARDS_TABLE_ID = 't4F8J8DfSSN'
PUNCHES_TABLE_ID = 't3uPEDXn9wt'
EMPLOYEES_TABLE_ID = 'tcNK2zZPcAR'

def query_fillout(table_id, filters=None, limit=2000, offset=0):
    """Query Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {
        'limit': min(limit, 2000),  # Fillout max is 2000
    }
    
    if filters:
        body['filters'] = filters
    
    if offset > 0:
        body['offset'] = offset
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Error: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def get_record(table_id, record_id):
    """Get a single record"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/{record_id}"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
    }
    
    response = requests.get(url, headers=headers)
    
    if not response.ok:
        print(f"❌ Error: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def calculate_hours(punch_in_time, punch_out_time):
    """Calculate hours from punch in/out times"""
    if not punch_in_time or not punch_out_time:
        return 0.0
    
    try:
        in_time = datetime.fromisoformat(punch_in_time.replace('Z', '+00:00'))
        out_time = datetime.fromisoformat(punch_out_time.replace('Z', '+00:00'))
        
        diff = out_time - in_time
        hours = diff.total_seconds() / 3600
        
        return max(0.0, hours)
    except Exception as e:
        print(f"⚠️ Error calculating hours: {e}")
        return 0.0

def main():
    print("=" * 80)
    print("🔍 Employee Hours Calculation Test")
    print("=" * 80)
    
    # Test with a specific pay period ID
    pay_period_id = '85fc01a2-a66b-40ee-aed5-23827d35f114'  # Nov 11-25, 2025
    
    print(f"\n📅 Pay Period ID: {pay_period_id}")
    
    # Get pay period
    print("\n1. Fetching pay period...")
    pay_period = get_record(PAY_PERIODS_TABLE_ID, pay_period_id)
    if not pay_period:
        print("❌ Pay period not found")
        return
    
    pay_period_start = pay_period['fields']['start_date']
    pay_period_end = pay_period['fields']['end_date']
    print(f"   Dates: {pay_period_start} to {pay_period_end}")
    
    # Get time cards
    print("\n2. Fetching time cards...")
    time_cards_response = query_fillout(
        TIME_CARDS_TABLE_ID,
        filters={'pay_period_id': {'in': [pay_period_id]}},
        limit=1000
    )
    
    if not time_cards_response:
        print("❌ Failed to fetch time cards")
        return
    
    time_cards = time_cards_response.get('records', [])
    print(f"   Found {len(time_cards)} time cards")
    
    time_card_ids = [tc['id'] for tc in time_cards]
    print(f"   Time card IDs: {time_card_ids[:5]}..." if len(time_card_ids) > 5 else f"   Time card IDs: {time_card_ids}")
    
    # Get punches within date range (paginate if needed)
    print("\n3. Fetching punches...")
    all_punches = []
    offset = 0
    limit = 2000
    
    while True:
        punches_response = query_fillout(
            PUNCHES_TABLE_ID,
            filters={
                'punch_in_time': {
                    'gte': pay_period_start,
                    'lte': pay_period_end,
                }
            },
            limit=limit,
            offset=offset
        )
        
        if not punches_response:
            break
        
        punches = punches_response.get('records', [])
        if not punches:
            break
        
        all_punches.extend(punches)
        print(f"   Fetched {len(punches)} punches (total: {len(all_punches)})")
        
        if not punches_response.get('hasMore', False):
            break
        
        offset += limit
    
    print(f"   Total punches found: {len(all_punches)}")
    
    # Debug: Check first punch structure
    if all_punches:
        first_punch = all_punches[0]
        print(f"\n   📋 Sample punch structure:")
        print(f"      Fields: {list(first_punch['fields'].keys())}")
        print(f"      time_card_id: {first_punch['fields'].get('time_card_id')}")
        print(f"      employee_id: {first_punch['fields'].get('employee_id')}")
        print(f"      punch_in_time: {first_punch['fields'].get('punch_in_time')}")
        print(f"      punch_out_time: {first_punch['fields'].get('punch_out_time')}")
    
    # Filter punches linked to time cards
    # If time cards exist but no punches are linked, use all punches in date range
    # (punches might not have time_card_id set yet, or relationship works differently)
    if time_card_ids:
        filtered_punches = []
        for p in all_punches:
            tc_id = p['fields'].get('time_card_id')
            if isinstance(tc_id, list) and tc_id:
                tc_id = tc_id[0]
            if tc_id and tc_id in time_card_ids:
                filtered_punches.append(p)
        
        print(f"   Punches linked to time cards: {len(filtered_punches)}")
        
        # If no linked punches, use all punches in date range
        if len(filtered_punches) == 0:
            print(f"   ⚠️ No punches linked to time cards, using all {len(all_punches)} punches in date range")
            filtered_punches = all_punches
    else:
        filtered_punches = all_punches
        print(f"   No time cards found, using all punches")
    
    # Group by employee
    print("\n4. Calculating hours by employee...")
    employee_punches = {}
    employee_ids = set()
    
    for punch in filtered_punches:
        emp_id = punch['fields'].get('employee_id')
        if isinstance(emp_id, list):
            emp_id = emp_id[0] if emp_id else None
        
        if not emp_id:
            continue
        
        employee_ids.add(emp_id)
        if emp_id not in employee_punches:
            employee_punches[emp_id] = []
        
        employee_punches[emp_id].append(punch)
    
    print(f"   Found {len(employee_ids)} employees with punches")
    
    # Get employee names
    print("\n5. Fetching employee names...")
    employees = {}
    if employee_ids:
        employees_response = query_fillout(
            EMPLOYEES_TABLE_ID,
            filters={'id': {'in': list(employee_ids)}},
            limit=1000
        )
        
        if employees_response:
            for emp in employees_response.get('records', []):
                employees[emp['id']] = {
                    'name': emp['fields'].get('Name') or emp['fields'].get('name') or emp['fields'].get('email') or 'Unknown',
                    'email': emp['fields'].get('email'),
                }
    
    # Calculate totals
    print("\n6. Calculating totals...")
    employee_hours = []
    
    for emp_id in employee_ids:
        punches = employee_punches[emp_id]
        total_hours = 0.0
        
        for punch in punches:
            punch_in = punch['fields'].get('punch_in_time')
            punch_out = punch['fields'].get('punch_out_time')
            duration = punch['fields'].get('duration')
            
            # Use duration if available, otherwise calculate
            if duration and isinstance(duration, (int, float)):
                total_hours += duration
            elif punch_in and punch_out:
                total_hours += calculate_hours(punch_in, punch_out)
        
        employee_hours.append({
            'employeeId': emp_id,
            'employeeName': employees.get(emp_id, {}).get('name', 'Unknown'),
            'employeeEmail': employees.get(emp_id, {}).get('email'),
            'totalHours': total_hours,
            'punchCount': len(punches),
        })
    
    # Sort by name
    employee_hours.sort(key=lambda x: x['employeeName'])
    
    # Print results
    print("\n" + "=" * 80)
    print("📊 Results:")
    print("=" * 80)
    print(f"{'Employee Name':<30} {'Email':<35} {'Hours':<10} {'Punches'}")
    print("-" * 80)
    
    total_hours = 0.0
    for eh in employee_hours:
        email = eh['employeeEmail'] or ''
        print(f"{eh['employeeName']:<30} {email:<35} {eh['totalHours']:>8.2f} {eh['punchCount']:>8}")
        total_hours += eh['totalHours']
    
    print("-" * 80)
    print(f"{'TOTAL':<30} {'':<35} {total_hours:>8.2f}")
    print("=" * 80)
    
    print(f"\n✅ Test complete! Found {len(employee_hours)} employees with {total_hours:.2f} total hours")

if __name__ == '__main__':
    main()

