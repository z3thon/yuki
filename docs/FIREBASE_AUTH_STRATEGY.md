# Firebase Auth Strategy

## Current Setup

**Firebase Project**: `dnc-time-tracker`  
**Purpose**: Central authentication for all DNC company apps

## Multi-App Authentication Pattern

We're using a single Firebase project for authentication across multiple apps:

- **Flutter App** (DNCTimeTracker) - Mobile app for employees
- **Yuki Admin Console** (This app) - Web admin interface
- **Future Apps** - Can be added easily

## Why This Works

1. **Single Source of Truth**: All users authenticate through one Firebase Auth instance
2. **No User Sync Needed**: Users exist once, work everywhere
3. **Easy Management**: Manage users in one place
4. **Standard Pattern**: Firebase supports multiple apps per project

## What We're Using

- ✅ **Firebase Auth** - User authentication (read-only operations)
- ❌ **Firestore** - Not used (we use Fillout Database)
- ❌ **Storage** - Not used
- ❌ **Other Services** - Not used

## Safety Guarantees

- **Read-Only**: We only verify tokens, never modify user data
- **No Conflicts**: Each app has separate config, shares auth database
- **Isolated**: Our permission system (Fillout) is separate from Firebase Auth

## Future: Project Rename

**Potential Rename**: `dnc-time-tracker` → `dnc-auth` (or similar)

**When to Rename**:
- When adding more company-wide apps
- When project name becomes confusing
- When you want clearer separation

**Rename Process** (when ready):
1. Firebase Console → Project Settings → General
2. Click "Edit" next to project name
3. Rename to "DNC Auth" or preferred name
4. Update `.env.local` files in all apps
5. No code changes needed (project ID stays the same)

**Note**: The project ID (`dnc-time-tracker`) cannot be changed, only the display name. This is fine - the ID is internal, display name is what users see.

## Current Configuration

### Web App Config (Client-side)
```
Project ID: dnc-time-tracker
API Key: AIzaSyCB8a57Hm7pw6A03w9C2UTmOLuee33OtJs
Auth Domain: dnc-time-tracker.firebaseapp.com
```

### Admin SDK (Server-side)
- Get from Firebase Console → Service Accounts
- Used for server-side token verification

## Apps Using This Auth

1. **DNCTimeTracker** (Flutter) - Mobile app
2. **Yuki** (Next.js) - Admin console
3. **Future Apps** - Can be added as needed

