# Admin Authentication Setup Guide

## Overview

Yuki admin console uses Firebase Authentication (same Firebase project as the Flutter app) but requires admin role verification. This guide explains how to set up admin authentication.

## Authentication Flow

```
1. User signs in with Google (Firebase Auth)
2. Frontend gets Firebase Auth token
3. Frontend sends token to Vercel function
4. Vercel function verifies token with Firebase Admin SDK
5. Vercel function checks admin role (custom claim or admin table)
6. If admin, allow access; otherwise deny
```

## Option 1: Firebase Custom Claims (Recommended)

### Setup

1. **Install Firebase Admin SDK** (if not already installed):
```bash
npm install firebase-admin
```

2. **Create setup script** to add admin claims:

```typescript
// scripts/set-admin-claim.ts
import admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

async function setAdminClaim(email: string) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Admin claim set for ${email} (UID: ${user.uid})`);
  } catch (error) {
    console.error(`❌ Error setting admin claim for ${email}:`, error);
  }
}

// Usage
const adminEmail = process.argv[2];
if (!adminEmail) {
  console.error('Usage: ts-node scripts/set-admin-claim.ts <email>');
  process.exit(1);
}

setAdminClaim(adminEmail).then(() => process.exit(0));
```

3. **Run script** to set admin claim:
```bash
ts-node scripts/set-admin-claim.ts admin@discover-nocode.com
```

4. **Verify in Vercel function**:

```typescript
// api/admin/check.ts
import { verifyAuthToken } from '../auth/verify';
import { NextApiRequest } from 'next';

export async function isAdmin(req: NextApiRequest): Promise<boolean> {
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken) return false;
  
  // Check custom claim
  return decodedToken.admin === true;
}
```

### Advantages
- ✅ Fast (no database query needed)
- ✅ Built into Firebase Auth
- ✅ Easy to manage

### Disadvantages
- ⚠️ Requires Firebase Admin SDK access
- ⚠️ Claims persist until explicitly removed

## Option 2: Admin Table in Fillout

### Setup

1. **Create Admins table in Fillout**:
   - `email` (Email field, required, unique)
   - `role` (Select: "admin", "manager", "payroll")
   - `created_at` (DateTime, auto)
   - `updated_at` (DateTime, auto)

2. **Add admin users** to the table via Fillout UI or API

3. **Verify in Vercel function**:

```typescript
// api/admin/check.ts
import { verifyAuthToken } from '../auth/verify';
import { NextApiRequest } from 'next';

const ADMINS_TABLE_ID = 'tXXXXX'; // Get from Fillout

export async function isAdmin(req: NextApiRequest): Promise<boolean> {
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken?.email) return false;
  
  // Query Fillout for admin record
  const endpoint = `/tables/${ADMINS_TABLE_ID}/records/list`;
  const url = `${process.env.FILLOUT_BASE_URL}/${process.env.FILLOUT_BASE_ID}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FILLOUT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: {
          email: { eq: decodedToken.email.toLowerCase().trim() }
        },
        limit: 1
      })
    });
    
    const data = await response.json();
    return data.records?.length > 0;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
```

### Advantages
- ✅ No Firebase Admin SDK needed
- ✅ Easy to add/remove admins via Fillout UI
- ✅ Can have multiple roles (admin, manager, payroll)

### Disadvantages
- ⚠️ Requires Fillout API call (slightly slower)
- ⚠️ Need to maintain admin table

## Option 3: Environment Variable (Simple, for small teams)

### Setup

1. **Set admin emails in Vercel environment variables**:
```bash
ADMIN_EMAILS=admin1@discover-nocode.com,admin2@discover-nocode.com
```

2. **Verify in Vercel function**:

```typescript
// api/admin/check.ts
import { verifyAuthToken } from '../auth/verify';
import { NextApiRequest } from 'next';

export async function isAdmin(req: NextApiRequest): Promise<boolean> {
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken?.email) return false;
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(decodedToken.email.toLowerCase().trim());
}
```

### Advantages
- ✅ Simplest setup
- ✅ No database needed
- ✅ Fast (no API calls)

### Disadvantages
- ⚠️ Requires Vercel deployment to change admins
- ⚠️ Not scalable for many admins

## Recommended Approach

**For Yuki, use Option 1 (Custom Claims)** because:
- Fast and efficient
- Built into Firebase Auth
- Easy to manage via script
- Scales well

**Fallback to Option 2 (Admin Table)** if:
- You need role-based access (admin, manager, payroll)
- You want to manage admins via Fillout UI
- You don't have Firebase Admin SDK access

## Frontend Integration

### Next.js Auth Hook

```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

export function useAdminAuth() {
  const [user, loading] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    }

    checkAdmin();
  }, [user]);

  return { user, loading: loading || adminLoading, isAdmin };
}
```

### Protected Route Component

```typescript
// components/ProtectedRoute.tsx
import { useAdminAuth } from '../hooks/useAuth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function ProtectedRoute({ children }) {
  const { user, loading, isAdmin } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/login');
    }
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
```

## Testing

### Test Admin Access

1. **Set admin claim** for test user:
```bash
ts-node scripts/set-admin-claim.ts test@discover-nocode.com
```

2. **Sign in** with test user in admin console

3. **Verify** admin access works

4. **Test non-admin** user (should be denied)

## Troubleshooting

### "Unauthorized" Error
- Check Firebase Auth token is being sent
- Verify token is valid (not expired)
- Check Firebase Admin SDK is configured correctly

### "Forbidden" Error
- Verify admin claim is set (Option 1)
- Check admin table has user's email (Option 2)
- Verify environment variables are set (Option 3)

### Token Not Found
- Ensure frontend is sending Authorization header
- Check token format: `Bearer <token>`
- Verify Firebase Auth is initialized correctly

## Next Steps

1. ✅ Choose authentication method (recommend Option 1)
2. ✅ Set up admin users
3. ✅ Create authentication middleware
4. ✅ Create protected routes
5. ✅ Test admin access
6. ✅ Build admin UI components

