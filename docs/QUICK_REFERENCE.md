# Quick Reference Guide

## 🔑 Key Information

### Database
- **Database ID**: `aa7a307dc0a191a5`
- **Base URL**: `https://tables.fillout.com/api/v1/bases`
- **API Token**: `sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131`

### Table IDs
- **Employees**: `tcNK2zZPcAR`
- **Punches**: `t3uPEDXn9wt`
- **Punch Alterations**: `t5x39cZnrdK`
- **Time Cards**: `t4F8J8DfSSN`
- **Clients**: `te3Gw8PDkS7`
- **Projects**: `t9gBZ2DumZM`
- **Pay Periods**: `tk8fyCDXQ8H`
- **Invoices**: (check schema)

### Firebase
- **Project ID**: `dnc-time-tracker`
- **Auth Domain**: `dnc-time-tracker.firebaseapp.com`

### URLs
- **Admin Console**: `hub.discover-nocode.com`
- **Employee App**: `time.discover-nocode.com` (or app.discover-nocode.com)

## 📋 Common Tasks

### Set Admin User
```bash
ts-node scripts/set-admin-claim.ts admin@discover-nocode.com
```

### Query Fillout API
```typescript
const response = await fetch(
  `${process.env.FILLOUT_BASE_URL}/${process.env.FILLOUT_BASE_ID}/tables/${TABLE_ID}/records/list`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FILLOUT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: { /* filters */ },
      limit: 100,
      offset: 0
    })
  }
);
```

### Verify Admin
```typescript
// Option 1: Custom Claims
const decodedToken = await verifyAuthToken(req);
const isAdmin = decodedToken?.admin === true;

// Option 2: Admin Table
const adminRecord = await queryFillout('Admins', { email: decodedToken.email });
const isAdmin = adminRecord?.length > 0;
```

## 🔍 Filter Syntax

### Text Field
```json
{
  "filters": {
    "name": { "eq": "John Doe" }
  }
}
```

### Linked Record Field (MUST use "in")
```json
{
  "filters": {
    "employee_id": { "in": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"] }
  }
}
```

### Date Range
```json
{
  "filters": {
    "created_at": {
      "gte": "2025-01-01T00:00:00Z",
      "lt": "2025-12-31T23:59:59Z"
    }
  }
}
```

### Multiple Conditions
```json
{
  "filters": {
    "status": { "in": ["pending", "approved"] },
    "employee_id": { "in": ["employee-id"] }
  }
}
```

## 🚨 Important Notes

1. **Linked Record Fields**: Always use `{"in": ["id"]}` NOT `{"eq": "id"}`
2. **Admin Access**: No employee filtering needed - admins see all data
3. **API Token**: Never expose to client - always use server-side
4. **Auth Token**: Verify Firebase Auth token in all API routes
5. **Admin Role**: Check admin role before allowing data access

## 📚 Documentation Files

- **Schema**: `FILLOUT_DATABASE_SCHEMA.md`
- **API**: `FILLOUT_DATABASE_API.md`
- **Architecture**: `VERCEL_FUNCTIONS_ARCHITECTURE.md`
- **Auth**: `ADMIN_AUTHENTICATION_SETUP.md`
- **Reference**: `FIREBASE_FUNCTIONS_REFERENCE.md`

## 🐛 Common Issues

### "Unauthorized" Error
- Check Firebase Auth token is being sent
- Verify token is valid (not expired)
- Check Firebase Admin SDK is configured

### "Forbidden" Error
- Verify admin claim is set (Option 1)
- Check admin table has user's email (Option 2)
- Verify environment variables are set (Option 3)

### Fillout API Errors
- Check API token is correct
- Verify table IDs are correct
- Check filter syntax (especially linked records)
- Verify field names match schema

