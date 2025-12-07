#!/usr/bin/env python3
"""Test script to debug Views table creation"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
load_dotenv()

token = os.getenv('FILLOUT_API_TOKEN') or os.getenv('FILLOUT_API_KEY') or 'sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131'
db_id = 'aa7a307dc0a191a5'

url = f'https://tables.fillout.com/api/v1/bases/{db_id}/tables'

# Try different configurations
configs = [
    {
        'name': 'Test Views 1',
        'description': 'Minimal - just text fields',
        'fields': [
            {'name': 'name', 'type': 'single_line_text', 'required': True}
        ]
    },
    {
        'name': 'Test Views 2',
        'description': 'With select field',
        'fields': [
            {'name': 'app_id', 'type': 'single_select', 'required': True, 'options': {
                'choices': [{'name': 'hr'}, {'name': 'crm'}, {'name': 'billing'}]
            }},
            {'name': 'name', 'type': 'single_line_text', 'required': True}
        ]
    },
    {
        'name': 'User Views',
        'description': 'Full configuration',
        'fields': [
            {'name': 'app_id', 'type': 'single_select', 'required': True, 'options': {
                'choices': [
                    {'name': 'hr', 'color': 'blue'},
                    {'name': 'crm', 'color': 'purple'},
                    {'name': 'billing', 'color': 'pink'}
                ]
            }},
            {'name': 'name', 'type': 'single_line_text', 'required': True},
            {'name': 'config', 'type': 'long_text', 'required': True}
        ]
    }
]

for config in configs:
    print(f'\n🧪 Testing: {config["description"]}')
    print(f'   Table name: {config["name"]}')
    
    payload = {
        'name': config['name'],
        'fields': [
            {
                'name': f['name'],
                'type': f['type'],
                'template': f.get('options', {}),
                'required': f.get('required', False)
            }
            for f in config['fields']
        ]
    }
    
    print(f'   Payload: {json.dumps(payload, indent=2)}')
    
    try:
        response = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        print(f'   Status: {response.status_code}')
        
        if response.ok:
            data = response.json()
            table_id = data.get('id') or data.get('table', {}).get('id')
            print(f'   ✅ SUCCESS! Table ID: {table_id}')
            break
        else:
            error = response.json() if response.headers.get('content-type', '').startswith('application/json') else {'text': response.text}
            print(f'   ❌ Failed: {json.dumps(error, indent=2)}')
    except Exception as e:
        print(f'   ❌ Exception: {e}')

