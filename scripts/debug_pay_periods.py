#!/usr/bin/env python3
"""
Debug script to query Fillout pay periods and identify current/previous periods.
This helps us understand what data is actually in the database.
"""

import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests

# Load environment variables (try .env.local first, then .env)
load_dotenv('.env.local')
load_dotenv()

FILLOUT_BASE_URL = os.getenv('FILLOUT_BASE_URL', 'https://tables.fillout.com/api/v1/bases')
FILLOUT_BASE_ID = os.getenv('FILLOUT_BASE_ID', 'aa7a307dc0a191a5')
# Try both FILLOUT_API_TOKEN and FILLOUT_API_KEY
FILLOUT_API_TOKEN = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY')

if not FILLOUT_API_TOKEN:
    print("❌ Error: FILLOUT_API_TOKEN not found in environment")
    sys.exit(1)

# Pay Periods table ID
PAY_PERIODS_TABLE_ID = 'tk8fyCDXQ8H'

def query_fillout(table_id, filters=None, limit=100):
    """Query Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {
        'limit': limit,
    }
    
    if filters:
        body['filters'] = filters
    
    print(f"\n📡 Querying Fillout API...")
    print(f"URL: {url}")
    print(f"Filters: {json.dumps(filters, indent=2) if filters else 'None'}")
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Error: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def parse_date(date_str):
    """Parse date string from Fillout (YYYY-MM-DD format)"""
    if not date_str:
        return None
    try:
        # Handle YYYY-MM-DD format
        if isinstance(date_str, str) and len(date_str) >= 10:
            date_part = date_str.split('T')[0]  # Remove time if present
            year, month, day = map(int, date_part.split('-'))
            return datetime(year, month, day)
    except Exception as e:
        print(f"⚠️ Error parsing date '{date_str}': {e}")
    return None

def determine_relevance(start_date, end_date, today):
    """Determine if pay period is current, upcoming, or past"""
    if not start_date or not end_date:
        return 'unknown'
    
    # Normalize dates to start/end of day
    start = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
    today_normalized = datetime(today.year, today.month, today.day, 0, 0, 0)
    
    if today_normalized >= start and today_normalized <= end:
        return 'current'
    elif start > today_normalized:
        return 'upcoming'
    else:
        return 'past'

def main():
    print("=" * 80)
    print("🔍 Fillout Pay Periods Debug Script")
    print("=" * 80)
    
    # Get today's date
    today = datetime.now()
    print(f"\n📅 Today's date: {today.strftime('%Y-%m-%d')} ({today.strftime('%B %d, %Y')})")
    
    # Query all pay periods
    print(f"\n{'='*80}")
    print("Step 1: Fetching all pay periods...")
    print(f"{'='*80}")
    
    response = query_fillout(PAY_PERIODS_TABLE_ID, limit=100)
    
    if not response or 'records' not in response:
        print("❌ No records returned")
        return
    
    records = response.get('records', [])
    print(f"\n✅ Fetched {len(records)} pay period records")
    
    # Parse and analyze pay periods
    print(f"\n{'='*80}")
    print("Step 2: Analyzing pay periods...")
    print(f"{'='*80}")
    
    pay_periods = []
    for record in records:
        fields = record.get('fields', {})
        start_date_str = fields.get('start_date')
        end_date_str = fields.get('end_date')
        department_id = fields.get('department_id')
        
        start_date = parse_date(start_date_str)
        end_date = parse_date(end_date_str)
        
        relevance = determine_relevance(start_date, end_date, today) if start_date and end_date else 'unknown'
        
        pay_period = {
            'id': record.get('id'),
            'start_date_str': start_date_str,
            'end_date_str': end_date_str,
            'start_date': start_date,
            'end_date': end_date,
            'department_id': department_id,
            'relevance': relevance,
        }
        pay_periods.append(pay_period)
    
    # Sort by start date (newest first)
    pay_periods.sort(key=lambda x: x['start_date'] if x['start_date'] else datetime.min, reverse=True)
    
    # Print all pay periods
    print(f"\n{'='*80}")
    print("All Pay Periods (sorted by start date, newest first):")
    print(f"{'='*80}")
    print(f"{'ID':<40} {'Start Date':<15} {'End Date':<15} {'Relevance':<10} {'Department'}")
    print("-" * 100)
    
    for pp in pay_periods[:20]:  # Show first 20
        dept = str(pp['department_id'])[:30] if pp['department_id'] else 'None'
        start_str = pp['start_date'].strftime('%Y-%m-%d') if pp['start_date'] else 'N/A'
        end_str = pp['end_date'].strftime('%Y-%m-%d') if pp['end_date'] else 'N/A'
        print(f"{pp['id']:<40} {start_str:<15} {end_str:<15} {pp['relevance']:<10} {dept}")
    
    # Find current period
    print(f"\n{'='*80}")
    print("Step 3: Identifying current and previous periods...")
    print(f"{'='*80}")
    
    current_periods = [pp for pp in pay_periods if pp['relevance'] == 'current']
    upcoming_periods = [pp for pp in pay_periods if pp['relevance'] == 'upcoming']
    past_periods = [pp for pp in pay_periods if pp['relevance'] == 'past']
    
    print(f"\n📊 Relevance breakdown:")
    print(f"  Current: {len(current_periods)}")
    print(f"  Upcoming: {len(upcoming_periods)}")
    print(f"  Past: {len(past_periods)}")
    
    if current_periods:
        current = current_periods[0]  # Take first current period
        print(f"\n✅ Current Pay Period:")
        print(f"  ID: {current['id']}")
        print(f"  Dates: {current['start_date_str']} to {current['end_date_str']}")
        if current['start_date']:
            print(f"  Formatted: {current['start_date'].strftime('%B %d, %Y')} - {current['end_date'].strftime('%B %d, %Y')}")
    else:
        print(f"\n⚠️ No current pay period found!")
        # Find most recent past period
        if past_periods:
            most_recent = past_periods[0]
            print(f"\n📅 Most recent past period:")
            print(f"  ID: {most_recent['id']}")
            print(f"  Dates: {most_recent['start_date_str']} to {most_recent['end_date_str']}")
            if most_recent['start_date']:
                print(f"  Formatted: {most_recent['start_date'].strftime('%B %d, %Y')} - {most_recent['end_date'].strftime('%B %d, %Y')}")
    
    # Get 5 periods starting from current (or most recent)
    print(f"\n{'='*80}")
    print("Step 4: Getting 5 relevant pay periods (current + 4 previous)...")
    print(f"{'='*80}")
    
    if current_periods:
        current = current_periods[0]
        # Find periods that end before or on current period's end date
        current_end = current['end_date'] if current['end_date'] else datetime.max
        
        # Get all periods that end before current period ends (or are current)
        relevant_periods = [pp for pp in pay_periods if 
                           (pp['end_date'] and pp['end_date'] <= current_end) or pp['id'] == current['id']]
        
        # Sort by end date descending (most recent first)
        relevant_periods.sort(key=lambda x: x['end_date'] if x['end_date'] else datetime.min, reverse=True)
        
        # Take first 5
        top_5 = relevant_periods[:5]
        
        print(f"\n✅ Top 5 relevant pay periods:")
        for i, pp in enumerate(top_5, 1):
            start_str = pp['start_date'].strftime('%b %d, %Y') if pp['start_date'] else 'N/A'
            end_str = pp['end_date'].strftime('%b %d, %Y') if pp['end_date'] else 'N/A'
            label = "CURRENT" if pp['relevance'] == 'current' else "PREVIOUS" if pp['relevance'] == 'past' else "UPCOMING"
            print(f"  {i}. [{label}] {start_str} - {end_str}")
    else:
        print(f"\n⚠️ No current period found, showing 5 most recent past periods:")
        for i, pp in enumerate(past_periods[:5], 1):
            start_str = pp['start_date'].strftime('%b %d, %Y') if pp['start_date'] else 'N/A'
            end_str = pp['end_date'].strftime('%b %d, %Y') if pp['end_date'] else 'N/A'
            print(f"  {i}. {start_str} - {end_str}")
    
    print(f"\n{'='*80}")
    print("✅ Debug complete!")
    print(f"{'='*80}")

if __name__ == '__main__':
    main()

