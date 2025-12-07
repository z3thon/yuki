# Environment Variables Setup Guide

## Quick Setup

1. **Copy the example file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in the values** from your `env.example` file and Firebase/Fillout dashboards

3. **Map your existing variables**:
   - `FILLOUT_API_KEY` → `FILLOUT_API_TOKEN`
   - `FILLOUT_BASE_URL` → `FILLOUT_BASE_URL` (if you have it)
   - Check if any `ZITE_*_DATABASE_ID` matches `aa7a307dc0a191a5`

## Required Variables

### Fillout/Zite Database
- ✅ `FILLOUT_API_TOKEN` - Your Fillout API key
- ✅ `FILLOUT_BASE_URL` - API endpoint (default provided)
- ✅ `FILLOUT_BASE_ID` - Database ID (`aa7a307dc0a191a5`)

### Firebase
- ✅ `FIREBASE_PROJECT_ID` - `dnc-time-tracker`
- ✅ `FIREBASE_PRIVATE_KEY` - From Firebase Console
- ✅ `FIREBASE_CLIENT_EMAIL` - From Firebase Console
- ✅ `NEXT_PUBLIC_FIREBASE_API_KEY` - From Firebase Console
- ✅ `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - `dnc-time-tracker.firebaseapp.com`
- ✅ `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - `dnc-time-tracker`

### Optional (for AI features)
- ⏳ `ANTHROPIC_API_KEY` - Claude API key (needed later)

## Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `dnc-time-tracker`
3. Click ⚙️ → Project Settings
4. Go to "Service Accounts" tab
5. Click "Generate New Private Key"
6. Download JSON file
7. Copy values:
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `project_id` → `FIREBASE_PROJECT_ID`

## Getting Firebase Client Config

1. Same Firebase Console → Project Settings
2. Scroll to "Your apps" section
3. Click on Web app (or create one)
4. Copy values:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

## Getting Fillout API Token

1. Go to [Fillout Dashboard](https://www.fillout.com/)
2. Navigate to Settings → API
3. Copy your API key
4. Use as `FILLOUT_API_TOKEN`

## Verification

After setting up `.env.local`, verify:

```bash
# Check if file exists
ls -la .env.local

# Start dev server (will show errors if vars are missing)
npm run dev
```

## Security Notes

- ✅ `.env.local` is gitignored (never commit)
- ✅ `NEXT_PUBLIC_*` variables are exposed to client (safe for Firebase client config)
- ✅ Server-only variables (no `NEXT_PUBLIC_`) stay server-side
- ✅ Never share `.env.local` file

## Troubleshooting

### "FIREBASE_PRIVATE_KEY is undefined"
- Make sure you copied the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters in the string

### "Fillout API error"
- Verify `FILLOUT_API_TOKEN` is correct
- Check `FILLOUT_BASE_ID` matches your database
- Ensure `FILLOUT_BASE_URL` is correct

### "Firebase Auth error"
- Verify all `NEXT_PUBLIC_FIREBASE_*` variables are set
- Check Firebase project ID matches in all variables

