#!/usr/bin/env python3
"""
Create Pay Period Templates table in Fillout and migrate existing department settings.
This implements the linked table approach for better Fillout-native structure.
"""

import os
import sys
import json
from datetime import datetime
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

DEPARTMENTS_TABLE_ID = 'tviEhSR8rfg'

def create_table(name, fields):
    """Create a new table in Fillout"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    # Fillout API format: fields need to be in specific format
    formatted_fields = []
    for field in fields:
        formatted_field = {
            'name': field['name'],
            'type': field['type'],
            'required': field.get('required', False),
        }
        # Add template for linked_record fields
        if field['type'] == 'linked_record' and 'template' in field:
            formatted_field['template'] = field['template']
        formatted_fields.append(formatted_field)
    
    body = {
        'name': name,
        'fields': formatted_fields
    }
    
    print(f"\n📋 Creating table: {name}")
    print(f"   Fields: {len(formatted_fields)}")
    print(f"   Body: {json.dumps(body, indent=2)}")
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        error_text = response.text
        print(f"❌ Error creating table: {response.status_code}")
        print(f"   Response: {error_text}")
        # Try to get more details
        try:
            error_json = response.json()
            print(f"   Error details: {json.dumps(error_json, indent=2)}")
        except:
            pass
        return None
    
    result = response.json()
    print(f"✅ Table created: {result.get('id')}")
    return result

def create_field(table_id, field_config):
    """Create a field in an existing table"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/fields"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    print(f"   Creating field: {field_config['name']} ({field_config['type']})")
    
    response = requests.post(url, headers=headers, json=field_config)
    
    if not response.ok:
        error_text = response.text
        print(f"   ❌ Error: {response.status_code} - {error_text}")
        return None
    
    result = response.json()
    print(f"   ✅ Field created: {result.get('id')}")
    return result

def query_fillout(table_id, filters=None, limit=1000):
    """Query Fillout API"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records/list"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {'limit': limit}
    if filters:
        body['filters'] = filters
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Query error: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def create_record(table_id, record_data):
    """Create a record in Fillout"""
    url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}/tables/{table_id}/records"
    
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
        'Content-Type': 'application/json',
    }
    
    body = {'record': record_data}
    
    response = requests.post(url, headers=headers, json=body)
    
    if not response.ok:
        print(f"❌ Error creating record: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def parse_days_string(days_str):
    """Parse comma-separated days string into list of integers"""
    if not days_str:
        return []
    try:
        return [int(d.strip()) for d in days_str.split(',') if d.strip()]
    except:
        return []

def get_last_day_of_month_indicator(payout_days, index, reverse_order=False):
    """Check if payout day should be 'last' based on current convention (1 = last day)
    
    Args:
        payout_days: List of payout days
        index: Period index (0-based)
        reverse_order: If True, reverse the order (for month-spanning periods)
    """
    if not payout_days or index >= len(payout_days):
        return None
    
    # Handle reverse order: payout_days "15, 1" might mean:
    #   Period 1 (11-25): uses payout_days[1] = 1 = "last"
    #   Period 2 (26-10): uses payout_days[0] = 15 = "15"
    actual_index = len(payout_days) - 1 - index if reverse_order else index
    if actual_index < 0 or actual_index >= len(payout_days):
        return None
    
    day = payout_days[actual_index]
    # Current convention: 1 means last day of month
    if day == 1:
        return "last"
    return str(day)

def main():
    print("=" * 80)
    print("🔧 Pay Period Templates Table Creation & Migration")
    print("=" * 80)
    
    # Step 1: Check if table already exists by trying to query it
    print("\n📋 Step 1: Checking for existing Pay Period Templates table...")
    
    # Get all tables to check if it exists
    db_url = f"{FILLOUT_BASE_URL}/{FILLOUT_BASE_ID}"
    headers = {
        'Authorization': f'Bearer {FILLOUT_API_TOKEN}',
    }
    
    db_response = requests.get(db_url, headers=headers)
    if db_response.ok:
        db_data = db_response.json()
        existing_tables = {t['name']: t['id'] for t in db_data.get('tables', [])}
        
        if 'Pay Period Templates' in existing_tables:
            templates_table_id = existing_tables['Pay Period Templates']
            print(f"✅ Table already exists: {templates_table_id}")
            print("   Skipping table creation, proceeding to migration...")
        else:
            # Step 2: Create Pay Period Templates table
            print("\n📋 Step 2: Creating Pay Period Templates table...")
            
            # Fillout API: Create table with a simple text field first
            # Linked records might need to be added after table creation
            table_fields = [
                {
                    'name': 'Name',
                    'type': 'single_line_text',
                    'required': False,
                }
            ]
            
            table_result = create_table('Pay Period Templates', table_fields)
            if not table_result:
                print("❌ Failed to create table")
                return
            
            templates_table_id = table_result['id']
            print(f"✅ Table created with ID: {templates_table_id}")
            
            # Step 3: Add all fields including linked_record
            print("\n📋 Step 3: Adding fields to Pay Period Templates table...")
            
            field_configs = [
                {
                    'name': 'department_id',
                    'type': 'linked_record',
                    'required': True,
                    'template': {
                        'tableId': DEPARTMENTS_TABLE_ID,
                        'relationship': 'many_to_one'
                    }
                },
                {
                    'name': 'period_number',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'start_day',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'end_day',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'payout_day',
                    'type': 'single_line_text',
                    'required': True,
                },
                {
                    'name': 'payout_month_offset',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'is_active',
                    'type': 'checkbox',
                    'required': False,
                },
            ]
            
            for field_config in field_configs:
                create_field(templates_table_id, field_config)
    else:
        print("❌ Failed to fetch database info")
        return
    
    # Step 4: Fetch all departments
    print("\n📋 Step 4: Fetching departments...")
    departments_response = query_fillout(DEPARTMENTS_TABLE_ID, limit=1000)
    
    if not departments_response:
        print("❌ Failed to fetch departments")
        return
    
    departments = departments_response.get('records', [])
    print(f"✅ Found {len(departments)} departments")
    
    # Step 5: Migrate department settings to templates
    print("\n📋 Step 5: Migrating department settings to templates...")
    
    # Get field IDs for the templates table
    # Try fetching from database structure
    print(f"\n📋 Fetching table structure for field IDs...")
    
    # Get database info which includes all tables
    db_response = requests.get(db_url, headers=headers)
    if not db_response.ok:
        print(f"❌ Failed to fetch database info: {db_response.status_code}")
        return
    
    db_data = db_response.json()
    templates_table = None
    for table in db_data.get('tables', []):
        if table['id'] == templates_table_id:
            templates_table = table
            break
    
    if not templates_table:
        print(f"❌ Table {templates_table_id} not found in database")
        return
    
    field_map = {}
    for field in templates_table.get('fields', []):
        field_name = field.get('name')
        field_id = field.get('id')
        if field_name and field_id:
            field_map[field_name] = field_id
    
    print(f"   ✅ Field IDs mapped:")
    for name, fid in field_map.items():
        print(f"      {name}: {fid}")
    
    if not field_map:
        print(f"   ⚠️ No fields found! Table might be empty or structure not loaded")
        print(f"   Trying to query a record to infer field structure...")
        
        # Try querying the table to see its structure
        test_query = query_fillout(templates_table_id, limit=1)
        if test_query and test_query.get('records'):
            first_record = test_query['records'][0]
            print(f"   Sample record fields: {list(first_record.get('fields', {}).keys())}")
    
    # Check for existing templates to avoid duplicates
    print(f"\n📋 Checking for existing templates...")
    existing_templates_response = query_fillout(templates_table_id, limit=1000)
    existing_templates = existing_templates_response.get('records', []) if existing_templates_response else []
    existing_dept_templates = {}
    for template in existing_templates:
        dept_id_field = template['fields'].get('department_id')
        if isinstance(dept_id_field, list) and dept_id_field:
            dept_id = dept_id_field[0]
            if dept_id not in existing_dept_templates:
                existing_dept_templates[dept_id] = []
            existing_dept_templates[dept_id].append(template)
    
    print(f"   Found {len(existing_templates)} existing templates")
    for dept_id, templates in existing_dept_templates.items():
        print(f"   Department {dept_id}: {len(templates)} templates")
    
    migrated_count = 0
    skipped_count = 0
    
    for dept in departments:
        dept_id = dept['id']
        dept_name = dept['fields'].get('Name') or dept['fields'].get('name') or 'Unknown'
        pay_period_type = dept['fields'].get('pay_period_type')
        start_days_str = dept['fields'].get('pay_period_start_days', '')
        end_days_str = dept['fields'].get('pay_period_end_days', '')
        payout_days_str = dept['fields'].get('payout_days', '')
        
        print(f"\n   📁 Department: {dept_name} ({dept_id})")
        print(f"      Type: {pay_period_type}")
        print(f"      Start days: {start_days_str}")
        print(f"      End days: {end_days_str}")
        print(f"      Payout days: {payout_days_str}")
        
        # Check if templates already exist for this department
        if dept_id in existing_dept_templates:
            existing_count = len(existing_dept_templates[dept_id])
            print(f"      ⚠️ Already has {existing_count} template(s), skipping migration")
            skipped_count += existing_count
            continue
        
        if not pay_period_type:
            print(f"      ⚠️ No pay period type, skipping")
            continue
        
        # Parse days
        start_days = parse_days_string(start_days_str)
        end_days = parse_days_string(end_days_str)
        payout_days = parse_days_string(payout_days_str)
        
        if not start_days or not end_days:
            print(f"      ⚠️ Missing start/end days, skipping")
            continue
        
        # Create template records for each period
        # Pair start_days[i] with end_days[i], but handle month-spanning periods
        # Example: Start "11, 26" and End "10, 25"
        #   The end_days "10, 25" actually means:
        #     - Period 1 ends on day 25 (pairs with start 11)
        #     - Period 2 ends on day 10 of next month (pairs with start 26)
        #   So we pair: start_days[0] with end_days[1], start_days[1] with end_days[0]
        #   OR: The data might be stored as [end_of_period_2, end_of_period_1]
        
        # Try to intelligently pair: if end_day < start_day at same index, it's month-spanning
        # Otherwise, pair sequentially
        period_count = min(len(start_days), len(end_days))
        
        for i in range(period_count):
            start_day = start_days[i]
            
            # Find the matching end_day
            # If current end_day < start_day, it's for the next period (month-spanning)
            # Otherwise, it's for this period
            if i < len(end_days):
                # Check if end_days[i] pairs with start_days[i]
                if end_days[i] >= start_day:
                    # Same month period: use end_days[i]
                    end_day = end_days[i]
                else:
                    # end_days[i] is less than start_day, might be for next period
                    # Try to find the right end_day
                    # For period 1 (start=11), we want end=25
                    # For period 2 (start=26), we want end=10
                    # If end_days = [10, 25], then:
                    #   Period 1 (i=0, start=11): end_days[1]=25 works (25 >= 11)
                    #   Period 2 (i=1, start=26): end_days[0]=10 works (10 < 26, spans months)
                    
                    # Try to find an end_day that's >= start_day (same month)
                    found_end = None
                    for j, ed in enumerate(end_days):
                        if ed >= start_day:
                            found_end = ed
                            break
                    
                    if found_end is not None:
                        end_day = found_end
                    else:
                        # All end_days are less than start_day, use the one that makes sense
                        # For month-spanning periods, use the smallest end_day
                        end_day = min(end_days)
            else:
                end_day = end_days[0] if end_days else None
            
            if end_day is None:
                print(f"      ⚠️ Could not determine end_day for period {i+1}, skipping")
                continue
            
            # Get payout_day - payout_days "15, 1" means:
            #   Period 1 (11-25): uses "1" (last day) = payout_days[1]
            #   Period 2 (26-10): uses "15" = payout_days[0]
            # So we need to reverse the order
            payout_day = None
            if payout_days:
                # Reverse index: Period 1 (i=0) uses payout_days[1], Period 2 (i=1) uses payout_days[0]
                reverse_index = len(payout_days) - 1 - i
                if reverse_index >= 0 and reverse_index < len(payout_days):
                    day_value = payout_days[reverse_index]
                    if day_value == 1:
                        payout_day = "last"
                    else:
                        payout_day = str(day_value)
                
                # Fallback to direct index if reverse didn't work
                if not payout_day and i < len(payout_days):
                    day_value = payout_days[i]
                    if day_value == 1:
                        payout_day = "last"
                    else:
                        payout_day = str(day_value)
            
            # Determine payout month offset based on period structure
            # Period 1: Nov 11 - Nov 25, payout on last day of Nov (same month, offset 0)
            # Period 2: Nov 26 - Dec 10, payout on Dec 15 (next month, offset 1)
            # If end_day < start_day, period spans months (e.g., 26-10)
            if end_day < start_day:
                # Period spans months (e.g., 26-10 means Nov 26 to Dec 10)
                # Payout is in the month where period ends (next month)
                payout_month_offset = 1
            else:
                # Period within same month (e.g., 11-25 means Nov 11 to Nov 25)
                # Payout is typically same month
                payout_month_offset = 0
            
            # Special handling for payout_day based on user's requirements:
            # Period 1 (11-25): payout is "last" day of same month (November)
            # Period 2 (26-10): payout is 15th of next month (December)
            # The payout_days string "15, 1" means:
            #   - Period 1: "1" = last day (converted to "last")
            #   - Period 2: "15" = 15th day
            
            # payout_day should already be set from get_last_day_of_month_indicator
            # But if not, apply default logic
            if not payout_day:
                if end_day < start_day:
                    # Period spans months (26-10), payout is 15th of next month
                    payout_day = "15"
                    payout_month_offset = 1
                else:
                    # Period in same month (11-25), payout is last day
                    payout_day = "last"
                    payout_month_offset = 0
            
            print(f"      📝 Creating template {i+1}:")
            print(f"         Start: {start_day}, End: {end_day}")
            print(f"         Payout: {payout_day}, Month offset: {payout_month_offset}")
            
            # Create record - try using field names first (Fillout might accept them)
            # If that doesn't work, we'll need to get field IDs from a query
            record_data = {
                'department_id': [dept_id],
                'period_number': i + 1,
                'start_day': start_day,
                'end_day': end_day,
                'payout_day': payout_day,
                'payout_month_offset': payout_month_offset,
                'is_active': True,
            }
            
            print(f"         Record data (using field names): {json.dumps(record_data, indent=2)}")
            
            result = create_record(templates_table_id, record_data)
            if result:
                migrated_count += 1
                print(f"         ✅ Created template record: {result.get('id')}")
            else:
                print(f"         ❌ Failed to create template")
    
    print("\n" + "=" * 80)
    print(f"✅ Migration complete!")
    print(f"   Created {migrated_count} new template records")
    print(f"   Skipped {skipped_count} existing templates")
    print(f"   Table ID: {templates_table_id}")
    print("=" * 80)
    
    print("\n📝 Next steps:")
    print("   1. Update code to use Pay Period Templates table")
    print("   2. Update documentation")
    print("   3. Test pay period generation with new structure")

if __name__ == '__main__':
    main()

