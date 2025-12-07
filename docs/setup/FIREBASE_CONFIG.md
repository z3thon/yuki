# Firebase Configuration for Yuki

## Current Setup

Using existing Firebase project: **dnc-time-tracker**

**Note**: This project serves as central authentication for all DNC company apps. We're using it safely - only reading auth tokens, not modifying anything. See `docs/FIREBASE_AUTH_STRATEGY.md` for details.

## Web App Config (Client-side)

From Firebase CLI:
```
Project ID: dnc-time-tracker
API Key: [Get from Firebase Console - see instructions below]
Auth Domain: dnc-time-tracker.firebaseapp.com
```

## Update .env.local

Add these values to your `.env.local`:

```bash
# Firebase Client (Public - safe to expose)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dnc-time-tracker
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dnc-time-tracker.firebaseapp.com

# Firebase Admin (Server-side - keep secret!)
FIREBASE_PROJECT_ID=dnc-time-tracker
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@dnc-time-tracker.iam.gserviceaccount.com
```

## Get Admin SDK Credentials

You need to get the Firebase Admin SDK credentials manually:

1. Go to [Firebase Console](https://console.firebase.google.com/project/dnc-time-tracker/settings/serviceaccounts/adminsdk)
2. Click **Generate New Private Key**
3. Download the JSON file
4. Extract these values:
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `project_id` → Already have this (`dnc-time-tracker`)

## Enable Authentication

1. Go to [Firebase Console → Authentication](https://console.firebase.google.com/project/dnc-time-tracker/authentication)
2. Click **Get Started** (if not already enabled)
3. Go to **Sign-in method** tab
4. Enable **Email/Password**
5. Create a test user in **Users** tab

## Quick Setup Command

After updating `.env.local`, restart the dev server:

```bash
npm run dev
```

The app will be available at: **http://localhost:3011**

