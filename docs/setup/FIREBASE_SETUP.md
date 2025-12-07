# Firebase Setup for Yuki

## Overview

Yuki uses Firebase Auth for authentication. You can either:
1. **Use existing Firebase project** (`dnc-time-tracker`) - if you want to share auth with your Flutter app
2. **Create new Firebase project** (`yuki-dnc`) - if you want separate auth

## Option 1: Use Existing Project (dnc-time-tracker)

If you want to share authentication with your Flutter app:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `dnc-time-tracker`
3. Go to **Project Settings** → **General**
4. Scroll to **Your apps** section
5. If no web app exists, click **Add app** → **Web** (</> icon)
6. Register app name: "Yuki Admin Console"
7. Copy the config values

## Option 2: Create New Project (yuki-dnc)

If you want separate authentication:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Project name: `yuki-dnc`
4. Follow setup wizard
5. After project is created, go to **Project Settings** → **General**
6. Scroll to **Your apps** section
7. Click **Add app** → **Web** (</> icon)
8. Register app name: "Yuki Admin Console"
9. Copy the config values

## Get Firebase Config Values

After adding the web app, you'll get config like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "yuki-dnc.firebaseapp.com",
  projectId: "yuki-dnc",
  // ... other values
};
```

## Get Firebase Admin SDK Credentials

For server-side authentication:

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Download the JSON file
4. Extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

## Update .env.local

Add these to your `.env.local`:

```bash
# Firebase Client (Public - safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Firebase Admin (Server-side only - keep secret!)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## Enable Authentication Methods

1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** (or other methods you want)
3. For development, you can add test users

## Test User Setup

1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter email and password
4. Copy the **User UID** - you'll need this for setting up permissions

## Setting Up Permissions

After creating a test user:

1. Get the user's Firebase UID from Authentication → Users
2. Use the admin API or Fillout UI to grant permissions:
   - Add record to `User App Access` table with:
     - `user_id` = Firebase UID
     - `app_id` = "hr" (or "crm", "billing")
     - `employee_id` = Link to Employee record (optional)
   - Add record to `User Permissions` table with:
     - `user_id` = Firebase UID
     - `app_id` = "hr"
     - `view_id` = "employees" (or null for all views)
     - `resource_type` = "employee" (or null for all resources)
     - `actions` = ["read", "write"] (or ["read"] for read-only)

## Quick Start

1. Set up Firebase project (Option 1 or 2 above)
2. Copy config values to `.env.local`
3. Enable Email/Password auth
4. Create test user
5. Set up permissions in Fillout
6. Start dev server: `npm run dev`
7. Visit: `http://localhost:3011`
8. Sign in with test user credentials

## Troubleshooting

### "Firebase Admin initialization error"
- Check that `FIREBASE_PRIVATE_KEY` has `\n` characters (not actual newlines)
- Verify `FIREBASE_CLIENT_EMAIL` is correct
- Make sure service account has proper permissions

### "Unauthorized" errors
- Verify Firebase UID matches user in permission tables
- Check that user has app access in `User App Access` table
- Verify permissions exist in `User Permissions` table

### Auth not working
- Check browser console for Firebase errors
- Verify `NEXT_PUBLIC_FIREBASE_*` variables are set
- Make sure Firebase Auth is enabled in Firebase Console

