# Yuki Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Fillout API Configuration
FILLOUT_API_TOKEN=sk_prod_...
FILLOUT_BASE_ID=aa7a307dc0a191a5
FILLOUT_BASE_URL=https://tables.fillout.com/api/v1/bases

# Firebase Admin SDK
FIREBASE_PROJECT_ID=dnc-time-tracker
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@dnc-time-tracker.iam.gserviceaccount.com

# Firebase Client Config
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dnc-time-tracker.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dnc-time-tracker

# Anthropic Claude API (for AI features - optional for now)
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3011`

### 4. Set Up Admin User

```bash
# Option 1: Set Firebase custom claims (recommended)
ts-node scripts/set-admin-claim.ts admin@discover-nocode.com

# Option 2: Add to Fillout Admins table
# Option 3: Add to Vercel environment variables
```

## Project Structure

```
Yuki/
├── app/                    # Next.js App Router
│   ├── api/                # Vercel API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── permissions/    # Permission checking
│   │   └── fillout/        # Fillout API proxy
│   ├── [appId]/            # App routes (hr, crm, billing)
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── AppSwitcher.tsx     # App selection dropdown
│   ├── Sidebar.tsx         # Collapsible sidebar
│   └── Layout.tsx          # Main layout wrapper
├── lib/                    # Utility libraries
│   ├── apps.ts             # App definitions
│   ├── firebase.ts         # Firebase client
│   ├── firebase-admin.ts   # Firebase Admin SDK
│   ├── fillout.ts          # Fillout API wrapper
│   └── permissions.ts      # Permission system
├── types/                  # TypeScript types
│   └── index.ts            # Shared types
└── docs/                   # Documentation
```

## Next Steps

1. **Create Permission Tables in Fillout**
   - User App Access table
   - User Permissions table
   - Views table

2. **Build HR Views**
   - Employees view
   - Time Tracking view
   - Punch Alterations view
   - Pay Periods dashboard

3. **Set Up AI Integration**
   - Configure Claude API
   - Build AI view generator
   - Implement permission-aware AI queries

See `MILESTONES.md` for the full development roadmap.

## Troubleshooting

### Port Already in Use
If port 3011 is already in use, you can change it in `package.json`:
```json
"dev": "next dev -p 3012"
```

### Firebase Admin SDK Errors
Make sure your `FIREBASE_PRIVATE_KEY` includes the `\n` characters properly escaped in the `.env.local` file.

### Fillout API Errors
Verify your `FILLOUT_API_TOKEN` and `FILLOUT_BASE_ID` are correct. Check the Fillout dashboard for the correct values.

