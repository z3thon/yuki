# Permission System Architecture

## Overview

Since Fillout/Zite DB doesn't have built-in RBAC (Role-Based Access Control), we've built a custom permission system that runs entirely in Vercel functions for maximum speed and cost-effectiveness.

## Architecture

```
User Request
    ↓
Vercel Function (API Route)
    ↓
1. Verify Firebase Auth Token
    ↓
2. Check Permission Cache (in-memory, 5min TTL)
    ↓
3. If cache miss → Fetch from Fillout User Permissions table
    ↓
4. Check Permission (App → View → Resource → Action)
    ↓
5. If allowed → Execute Fillout API call with filtered data
    ↓
6. Return filtered results
```

## Permission Granularity

### 1. App-Level
Controls which apps a user can access (HR, CRM, Billing).

**Table**: `User App Access`
- `user_id` (Firebase UID)
- `app_id` ("hr", "crm", "billing")
- `granted_at`

### 2. View-Level
Controls which views/dashboards within an app a user can see.

**Table**: `User Permissions`
- `user_id`
- `app_id`
- `view_id` (optional - if null, applies to all views)
- `actions` (array: ["read", "write", "delete", "approve"])

### 3. Resource-Level
Controls which resource types a user can access (employees, punches, invoices, etc.).

**Table**: `User Permissions`
- `user_id`
- `app_id`
- `resource_type` (optional - if null, applies to all resources)
- `actions`

### 4. Action-Level
Controls what actions a user can perform on resources.

**Actions**:
- `read` - View data
- `write` - Create/update data
- `delete` - Delete data
- `approve` - Approve requests (e.g., punch alterations)

## Permission Hierarchy

Permissions are checked in order of specificity:

1. **Most Specific**: `app_id` + `view_id` + `resource_type` + `resource_id` + `action`
2. **View-Level**: `app_id` + `view_id` + `resource_type` + `action` (no resource_id)
3. **Resource-Level**: `app_id` + `resource_type` + `action` (no view_id)
4. **App-Level**: `app_id` + `action` (no view_id, no resource_type)

If a more specific permission exists, it takes precedence.

## Implementation

### Permission Check Function

```typescript
import { checkPermission } from '@/lib/permissions';

// Check if user can read employees in HR app
const hasPermission = await checkPermission({
  userId: "user123",
  appId: "hr",
  viewId: "employees",
  resourceType: "employee",
  action: "read"
});
```

### API Route Example

```typescript
// app/api/hr/employees/route.ts
import { checkPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  // 1. Verify auth
  const decodedToken = await verifyAuth(request);
  const userId = decodedToken.uid;

  // 2. Check permission
  const hasPermission = await checkPermission({
    userId,
    appId: "hr",
    viewId: "employees",
    resourceType: "employee",
    action: "read"
  });

  if (!hasPermission) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Fetch data with permission filtering
  const employees = await getEmployees(userId); // Filters by permissions

  return NextResponse.json(employees);
}
```

## Caching Strategy

### In-Memory Cache
- **Location**: Vercel function memory
- **TTL**: 5 minutes
- **Key**: `permissions:${userId}`
- **Invalidation**: On permission updates

### Cache Benefits
- Fast permission checks (no Fillout API call needed)
- Reduced Fillout API usage
- Lower latency

### Cache Limitations
- Cleared on Vercel function restart (cold start)
- Not shared across function instances
- For production, consider Vercel KV for persistent cache

## Permission Filtering

When fetching data from Fillout, we apply permission-based filters:

```typescript
// Example: Get employees user can access
async function getEmployees(userId: string) {
  // Get user's permissions
  const permissions = await getUserPermissions(userId);
  
  // Build filter based on permissions
  const filter = buildPermissionFilter(permissions, "employee");
  
  // Query Fillout with filter
  return queryFillout({
    tableId: EMPLOYEES_TABLE_ID,
    filters: filter
  });
}
```

## AI Permission Inheritance

When AI generates views or updates data, it inherits the user's permissions:

1. User asks AI: "Show me all employees"
2. AI checks user's permissions
3. AI generates query filtered by permissions
4. AI cannot see data user doesn't have access to
5. All AI actions are logged with user ID

## Security Considerations

### Server-Side Only
- All permission checks happen in Vercel functions
- Client never receives unfiltered data
- Permission logic never exposed to client

### Defense in Depth
1. Firebase Auth verification (who are you?)
2. Permission check (what can you do?)
3. Data filtering (what can you see?)
4. Action validation (can you do this?)

### Audit Logging
All permission checks and data access should be logged:
- Who accessed what
- When
- What action
- Success/failure

## Database Schema

### User App Access Table
```
Fields:
- id (Auto-increment)
- user_id (Text, Required) - Firebase UID
- app_id (Select: "hr", "crm", "billing", Required)
- granted_at (DateTime, Auto)
- created_at (DateTime, Auto)
- updated_at (DateTime, Auto)
```

### User Permissions Table
```
Fields:
- id (Auto-increment)
- user_id (Text, Required) - Firebase UID
- app_id (Select: "hr", "crm", "billing", Required)
- view_id (Text, Optional) - View ID or null for all views
- resource_type (Text, Optional) - e.g., "employee", "punch", "invoice"
- resource_id (Text, Optional) - Specific resource ID or null for all
- actions (Text, Multiple) - ["read", "write", "delete", "approve"]
- created_at (DateTime, Auto)
- updated_at (DateTime, Auto)
```

## Example Permission Scenarios

### Scenario 1: HR Manager
- **App Access**: HR
- **View Access**: All HR views
- **Resource Access**: All employees, all punches
- **Actions**: read, write, approve

### Scenario 2: Payroll Clerk
- **App Access**: HR, Billing
- **View Access**: Pay Periods, Invoices
- **Resource Access**: Time Cards, Invoices
- **Actions**: read, write

### Scenario 3: Employee (Limited)
- **App Access**: HR (read-only)
- **View Access**: Own time tracking
- **Resource Access**: Own punches only
- **Actions**: read

## Future Enhancements

1. **Role-Based Permissions**: Pre-defined roles (Admin, Manager, Clerk)
2. **Temporary Permissions**: Time-limited access grants
3. **Permission Delegation**: Users can delegate permissions
4. **Permission Templates**: Reusable permission sets
5. **Audit Dashboard**: View permission usage and changes

---

**Last Updated**: January 2025

