# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Firebase project set up (see `FIREBASE_SETUP.md`)
- Fillout API token (already in your `.env.local`)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local` and ensure it has:

```bash
# Fillout (you already have these)
FILLOUT_API_TOKEN=your_token
FILLOUT_BASE_ID=aa7a307dc0a191a5
USER_APP_ACCESS_TABLE_ID=tpwLPMUfiwS
USER_PERMISSIONS_TABLE_ID=t8bkw75uxCC
VIEWS_TABLE_ID=t1F3H9vT9Gr

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### 3. Set Up Firebase Auth

We're using the existing `dnc-time-tracker` Firebase project for authentication (shared with Flutter app).

**Quick Setup:**
1. Get Admin SDK credentials from Firebase Console:
   - Go to: https://console.firebase.google.com/project/dnc-time-tracker/settings/serviceaccounts/adminsdk
   - Click "Generate New Private Key"
   - Download JSON and extract `private_key` and `client_email`

2. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=dnc-time-tracker
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCB8a57Hm7pw6A03w9C2UTmOLuee33OtJs
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dnc-time-tracker.firebaseapp.com
   FIREBASE_PROJECT_ID=dnc-time-tracker
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@dnc-time-tracker.iam.gserviceaccount.com
   ```

3. Enable Email/Password auth in Firebase Console

See `FIREBASE_SETUP.md` or `FIREBASE_CONFIG.md` for detailed instructions.

**Quick version:**
1. Go to Firebase Console → Your Project
2. Authentication → Sign-in method → Enable Email/Password
3. Authentication → Users → Add user (test user)
4. Copy the User UID

### 4. Set Up Test User Permissions

Add permissions for your test user in Fillout Database:

**User App Access Table:**
- `user_id` = Firebase UID
- `app_id` = "hr"
- `employee_id` = (optional - link to Employee record)

**User Permissions Table:**
- `user_id` = Firebase UID
- `app_id` = "hr"
- `view_id` = "employees" (or null for all views)
- `resource_type` = "employee" (or null for all resources)
- `actions` = ["read", "write"]

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3011**

### 6. Sign In

1. Visit `http://localhost:3011`
2. Sign in with your test user credentials
3. You should see the HR app with Employees view

## Current Features

✅ **Permission System** - Fully implemented with caching
✅ **Employees View** - List, search, view, and edit employees
✅ **Permission Checks** - All views respect user permissions
✅ **Employee Filtering** - Users only see employees they have access to

## Next Steps

- Build Time Tracking View
- Build Punch Alterations View
- Build Pay Periods View
- Add AI integration

## Troubleshooting

### Server won't start
- Check Node.js version: `node --version` (should be 18+)
- Check if port 3011 is available: `lsof -i :3011`
- Check `.env.local` has all required variables

### Can't sign in
- Verify Firebase Auth is enabled
- Check browser console for errors
- Verify `NEXT_PUBLIC_FIREBASE_*` variables are set

### "Access Denied" errors
- Check user has permissions in Fillout tables
- Verify Firebase UID matches `user_id` in permission tables
- Check user has HR app access

### Employees view shows "No employees found"
- Check user has "read" permission for "employees" view
- Verify `employee_id` filtering isn't too restrictive
- Check Fillout API token is valid
