#!/bin/bash
# Script to get Firebase config and update .env.local

echo "🔍 Getting Firebase configuration for dnc-time-tracker..."

# Get web app config
CONFIG=$(firebase apps:sdkconfig WEB --project dnc-time-tracker 2>/dev/null | grep -A 10 "{" | tail -n +2 | head -n -1)

if [ -z "$CONFIG" ]; then
    echo "❌ Could not get Firebase config"
    exit 1
fi

# Extract values using Python
python3 << 'PYTHON'
import json
import sys

try:
    config_json = sys.stdin.read()
    config = json.loads(config_json)
    
    print("\n✅ Firebase Config Found:")
    print(f"Project ID: {config.get('projectId')}")
    print(f"API Key: {config.get('apiKey')}")
    print(f"Auth Domain: {config.get('authDomain')}")
    print("\n📋 Add these to your .env.local:")
    print(f"NEXT_PUBLIC_FIREBASE_PROJECT_ID={config.get('projectId')}")
    print(f"NEXT_PUBLIC_FIREBASE_API_KEY={config.get('apiKey')}")
    print(f"NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN={config.get('authDomain')}")
    print(f"\nFIREBASE_PROJECT_ID={config.get('projectId')}")
    print("\n⚠️  You still need to:")
    print("1. Get Firebase Admin SDK credentials from Firebase Console")
    print("2. Add FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL to .env.local")
    print("\n   Go to: Firebase Console → Project Settings → Service Accounts")
    print("   Click 'Generate New Private Key' and extract the values")
    
except Exception as e:
    print(f"❌ Error parsing config: {e}")
    sys.exit(1)
PYTHON

