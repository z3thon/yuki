# Firebase Functions Reference (For Yuki Admin Console)

## Overview

This document contains the Firebase Functions code from the DNCTimeTracker Flutter app. **Yuki will NOT use Firebase Functions** - instead, we'll use Vercel serverless functions. However, this code is valuable as a reference for:

1. Understanding how authentication works
2. Seeing Fillout API integration patterns
3. Understanding security patterns (employee filtering)
4. Learning table IDs and API structure

## Important Note

**Yuki Admin Console Architecture:**
- ✅ Uses **Vercel serverless functions** (not Firebase Functions)
- ✅ Uses **Firebase Auth** for authentication (same Firebase project)
- ✅ Calls **Fillout API directly** (no employee filtering needed - admins see all data)
- ✅ Stores **Fillout API token** in Vercel environment variables

## Key Differences from Flutter App

### Flutter App (Employee-Facing)
- Firebase Functions auto-filter by `employee_id`
- Employees can only see their own data
- Security: Server-side filtering ensures data isolation

### Yuki Admin Console
- Vercel functions call Fillout API directly
- Admins can see ALL employees' data
- Security: Admin role verification (not employee filtering)

## Firebase Functions Code

See `functions/index.js` in the DNCTimeTracker project for the complete implementation.

### Key Functions

1. **`filloutProxy`** - Generic Fillout API proxy
   - Verifies Firebase Auth token
   - Auto-filters by employee_id for employee-specific endpoints
   - Handles leaderboard queries (allows all employees)
   - **Yuki Note**: We won't need employee filtering, but the auth verification pattern is useful

2. **`getEmployeeByEmail`** - Get employee by email
   - Verifies Firebase Auth token
   - Queries Fillout API for employee record
   - **Yuki Note**: Useful pattern for admin user lookup

### Table IDs (From Firebase Functions)

```javascript
const PUNCHES_TABLE_ID = 't3uPEDXn9wt';
const PUNCH_ALTERATIONS_TABLE_ID = 't5x39cZnrdK';
const TIME_CARDS_TABLE_ID = 't4F8J8DfSSN';
const EMPLOYEES_TABLE_ID = 'tcNK2zZPcAR';
```

### Authentication Pattern

```javascript
// Firebase Functions pattern (for reference)
async function verifyAuthToken(authToken) {
  const decodedToken = await admin.auth().verifyIdToken(authToken);
  return decodedToken;
}
```

**Yuki Equivalent (Vercel Functions):**
```typescript
// Vercel Functions pattern
import admin from 'firebase-admin';

export default async function handler(req, res) {
  const authToken = req.headers.authorization?.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(authToken);
  // Verify admin role
  // Call Fillout API
}
```

## Security Patterns

### Employee Filtering (Flutter App)
- Auto-filters by `employee_id` for employee-specific endpoints
- Prevents data leakage
- **Yuki**: Not needed - admins see all data

### Admin Verification (Yuki)
- Verify Firebase Auth token
- Check if user has admin role (custom claim or admin table)
- Allow access to all data if admin

## Fillout API Request Pattern

```javascript
// Firebase Functions pattern
async function makeFilloutRequest(method, endpoint, data, userEmail) {
  const apiToken = getFilloutApiToken(); // From Firebase Secrets
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}${endpoint}`;
  
  const config = {
    method: method.toLowerCase(),
    url: url,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    data: data
  };
  
  const response = await axios(config);
  return response.data;
}
```

**Yuki Equivalent (Vercel Functions):**
```typescript
// Vercel Functions pattern
const apiToken = process.env.FILLOUT_API_TOKEN; // From Vercel env vars
const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}${endpoint}`;

const response = await fetch(url, {
  method,
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: data ? JSON.stringify(data) : undefined,
});

return await response.json();
```

## Next Steps for Yuki

1. ✅ Set up Vercel project
2. ✅ Configure Firebase Admin SDK in Vercel functions
3. ✅ Store Fillout API token in Vercel environment variables
4. ✅ Create admin authentication middleware
5. ✅ Create Vercel functions for Fillout API calls
6. ✅ Build admin UI components

See `VERCEL_FUNCTIONS_ARCHITECTURE.md` for Yuki-specific implementation details.

