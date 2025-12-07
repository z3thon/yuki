# Vercel Functions Architecture for Yuki

## Overview

Yuki admin console uses **Vercel serverless functions** instead of Firebase Functions. This document explains the architecture and implementation approach.

## Why Vercel Functions?

1. **Different Security Model**: Admins need access to ALL data (no employee filtering)
2. **Cleaner Separation**: Admin logic stays in admin repo
3. **Same Security**: Vercel env vars are secure (like Firebase Secrets)
4. **Simpler**: Direct Fillout API calls (no proxy needed)

## Architecture

```
Next.js Admin UI (hub.discover-nocode.com)
    ↓
    Firebase Auth (verify admin user)
    ↓
    Vercel Serverless Functions (verify admin + call Fillout API)
    ↓
    Fillout API (with server-side token)
```

**Key Points:**
- ✅ Fillout API token stored in Vercel environment variables (secure)
- ✅ Firebase Auth for user authentication (same Firebase project as Flutter app)
- ✅ Admin role verification (custom claims or admin table)
- ✅ Direct Fillout API calls (no employee filtering)

## Environment Variables

Set these in Vercel dashboard:

```bash
# Fillout API Configuration
FILLOUT_API_TOKEN=sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131
FILLOUT_BASE_ID=aa7a307dc0a191a5
FILLOUT_BASE_URL=https://tables.fillout.com/api/v1/bases

# Firebase Admin SDK (for verifying auth tokens)
FIREBASE_PROJECT_ID=dnc-time-tracker
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

## Vercel Function Structure

### Directory Structure

```
api/
├── auth/
│   └── verify.ts          # Verify Firebase Auth token
├── admin/
│   └── check.ts            # Check if user is admin
├── fillout/
│   ├── proxy.ts            # Generic Fillout API proxy
│   ├── punches.ts          # Get all punches
│   ├── alterations.ts      # Get/update alterations
│   ├── timecards.ts        # Get time cards for payroll
│   └── invoices.ts         # Get invoices
└── employees/
    └── list.ts             # Get all employees
```

### Example: Admin Verification Middleware

```typescript
// api/auth/verify.ts
import admin from 'firebase-admin';
import { NextApiRequest, NextApiResponse } from 'next';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export async function verifyAuthToken(
  req: NextApiRequest
): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}
```

### Example: Admin Role Check

```typescript
// api/admin/check.ts
import { verifyAuthToken } from '../auth/verify';
import { NextApiRequest, NextApiResponse } from 'next';

// Option 1: Custom Claims (recommended)
export async function isAdmin(req: NextApiRequest): Promise<boolean> {
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken) return false;
  
  // Check custom claim
  return decodedToken.admin === true;
}

// Option 2: Admin Table in Fillout
export async function isAdminFromFillout(req: NextApiRequest): Promise<boolean> {
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken?.email) return false;
  
  // Query Fillout for admin record
  const response = await fetch(
    `${process.env.FILLOUT_BASE_URL}/${process.env.FILLOUT_BASE_ID}/tables/{ADMINS_TABLE_ID}/records/list`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FILLOUT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: {
          email: { eq: decodedToken.email }
        }
      })
    }
  );
  
  const data = await response.json();
  return data.records?.length > 0;
}
```

### Example: Fillout API Proxy

```typescript
// api/fillout/proxy.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuthToken } from '../auth/verify';
import { isAdmin } from '../admin/check';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authentication
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify admin role
  if (!(await isAdmin(req))) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  // Extract request parameters
  const { endpoint, method = 'GET', data } = req.body;

  // Make Fillout API request
  const url = `${process.env.FILLOUT_BASE_URL}/${process.env.FILLOUT_BASE_ID}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${process.env.FILLOUT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: result });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Fillout API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Example: Get All Punches (Admin View)

```typescript
// api/fillout/punches.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuthToken } from '../auth/verify';
import { isAdmin } from '../admin/check';

const PUNCHES_TABLE_ID = 't3uPEDXn9wt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authentication
  const decodedToken = await verifyAuthToken(req);
  if (!decodedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify admin role
  if (!(await isAdmin(req))) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  // Extract query parameters
  const { limit = 100, offset = 0, filters = {} } = req.query;

  // Build Fillout API request
  const endpoint = `/tables/${PUNCHES_TABLE_ID}/records/list`;
  const url = `${process.env.FILLOUT_BASE_URL}/${process.env.FILLOUT_BASE_ID}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FILLOUT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: result });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Fillout API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## Admin Authentication Setup

### Option 1: Firebase Custom Claims (Recommended)

Set admin custom claim for admin users:

```typescript
// One-time setup script (run in Firebase Admin SDK)
import admin from 'firebase-admin';

async function setAdminClaim(email: string) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
}
```

### Option 2: Admin Table in Fillout

Create an `Admins` table in Fillout with:
- `email` (Email field, unique)
- `role` (Select: "admin", "manager", "payroll")

Query this table to verify admin access.

## Security Best Practices

1. **Always verify auth token** before processing requests
2. **Always check admin role** before allowing data access
3. **Never expose Fillout API token** to client
4. **Use environment variables** for all secrets
5. **Log all admin actions** for audit trail
6. **Rate limit** API calls to prevent abuse

## Error Handling

```typescript
// Standard error response format
{
  error: {
    code: 'ERROR_CODE',
    message: 'Human-readable error message'
  }
}

// Common error codes
- 'UNAUTHORIZED' - No auth token or invalid token
- 'FORBIDDEN' - Not an admin user
- 'NOT_FOUND' - Resource not found
- 'BAD_REQUEST' - Invalid request parameters
- 'INTERNAL_SERVER_ERROR' - Server error
```

## Next Steps

1. ✅ Set up Next.js project with TypeScript
2. ✅ Configure Firebase Admin SDK
3. ✅ Set up Vercel environment variables
4. ✅ Create authentication middleware
5. ✅ Create admin role verification
6. ✅ Create Fillout API proxy functions
7. ✅ Build admin UI components

See `ADMIN_AUTHENTICATION_SETUP.md` for detailed setup instructions.

