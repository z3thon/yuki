# Permission Tables Schema

## Overview

The permission system uses three tables to manage user access and permissions:
1. **User App Access** - Controls which apps users can access
2. **User Permissions** - Granular permissions (app/view/resource/action)
3. **Views** - Stores user-created and default views/dashboards

## Table: User App Access

**Table ID**: `tpwLPMUfiwS`  
**Purpose**: Controls which apps users can access

### Fields

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `user_id` | Single Line Text | ✅ Yes | Firebase UID (for authentication) |
| `employee_id` | Linked Record → Employees | ❌ No | Employee record ID (links to Employees table) |
| `app_id` | Single Select | ✅ Yes | App ID: `hr`, `crm`, or `billing` |
| `granted_at` | Date Time | ✅ Yes | When access was granted |
| `created_at` | Date Time | ✅ Yes | Record creation timestamp |
| `updated_at` | Date Time | ✅ Yes | Last update timestamp |

### Relationships
- **Many-to-One** → Employees (via `employee_id`)
- Links Firebase users to Employee records

### Usage

**Why both `user_id` and `employee_id`?**
- `user_id` (Firebase UID): Used for authentication - identifies who is logged in
- `employee_id` (Employee record): Links to Employee data - allows querying by employee, filtering permissions by company/department, etc.

**Example Use Cases:**
- Grant HR app access to an employee: Set both `user_id` (Firebase UID) and `employee_id` (Employee record ID)
- Query all app access for an employee: Filter by `employee_id`
- Check if a Firebase user has access: Filter by `user_id`

## Table: User Permissions

**Table ID**: `t8bkw75uxCC`  
**Purpose**: Granular permissions (app/view/resource/action)

### Fields

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `user_id` | Single Line Text | ✅ Yes | Firebase UID (for authentication) |
| `employee_id` | Linked Record → Employees | ❌ No | Employee record ID (links to Employees table) |
| `app_id` | Single Select | ✅ Yes | App ID: `hr`, `crm`, or `billing` |
| `view_id` | Single Line Text | ❌ No | View ID (if null, applies to all views) |
| `resource_type` | Single Line Text | ❌ No | Resource type (e.g., "employee", "punch", "invoice") |
| `resource_id` | Single Line Text | ❌ No | Specific resource ID (if null, applies to all) |
| `actions` | Multiple Select | ✅ Yes | Actions: `read`, `write`, `delete`, `approve` |
| `created_at` | Date Time | ✅ Yes | Record creation timestamp |
| `updated_at` | Date Time | ✅ Yes | Last update timestamp |

### Relationships
- **Many-to-One** → Employees (via `employee_id`)

### Permission Hierarchy

Permissions are checked in order of specificity:

1. **Most Specific**: `app_id` + `view_id` + `resource_type` + `resource_id` + `action`
2. **View-Level**: `app_id` + `view_id` + `resource_type` + `action` (no `resource_id`)
3. **Resource-Level**: `app_id` + `resource_type` + `action` (no `view_id`)
4. **App-Level**: `app_id` + `action` (no `view_id`, no `resource_type`)

### Example Permissions

```typescript
// App-level: User can read everything in HR app
{
  user_id: "firebase_uid_123",
  employee_id: "employee_record_id",
  app_id: "hr",
  actions: ["read"]
}

// View-level: User can write to Employees view
{
  user_id: "firebase_uid_123",
  employee_id: "employee_record_id",
  app_id: "hr",
  view_id: "employees",
  resource_type: "employee",
  actions: ["read", "write"]
}

// Resource-level: User can approve alterations
{
  user_id: "firebase_uid_123",
  employee_id: "employee_record_id",
  app_id: "hr",
  view_id: "punch-alterations",
  resource_type: "alteration",
  actions: ["read", "approve"]
}
```

## Table: Views

**Table ID**: `t1F3H9vT9Gr`  
**Purpose**: Stores user-created and default views/dashboards

### Fields

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `app_id` | Single Select | ✅ Yes | App ID: `hr`, `crm`, or `billing` |
| `name` | Single Line Text | ✅ Yes | View name |
| `description` | Long Text | ❌ No | View description |
| `is_default` | Checkbox | ❌ No | Whether this is a default view |
| `is_custom` | Checkbox | ❌ No | Whether this is user-created |
| `created_by` | Single Line Text | ❌ No | Firebase UID of creator |
| `employee_id` | Linked Record → Employees | ❌ No | Employee record ID (links to Employees table) |
| `shared_with` | Multiple Select | ❌ No | Firebase UIDs of users who can access |
| `config` | Long Text | ✅ Yes | JSON configuration (query, filters, etc.) |
| `created_at` | Date Time | ✅ Yes | Creation timestamp |
| `updated_at` | Date Time | ✅ Yes | Last update timestamp |

### Relationships
- **Many-to-One** → Employees (via `employee_id`)

### Usage

**Why link Views to Employees?**
- **Query by Employee**: Find all views created by a specific employee
- **Filter by Company/Department**: Query views by employee → company → department
- **Reporting**: See which employees/departments create the most views
- **Sharing**: Share views with employees in the same company/department
- **Data Relationships**: Link views to employee data for filtering

**Example Queries:**
```typescript
// Get all views created by employees in Company X
// Filter Views by employee_id → company_id

// Get views for a specific employee
// Filter Views by employee_id = X

// Get HR app views for employees in Department Y
// Filter Views by app_id = 'hr' AND employee_id → department_id = Y
```

## Employee Relationship Benefits

### Why Link to Employees Table?

1. **Data Filtering**: Query permissions by employee, company, or department
2. **Employee Management**: See which employees have access to which apps
3. **Reporting**: Generate reports on app access by department/company
4. **Data Integrity**: Ensure permissions are tied to actual employee records
5. **Flexibility**: Support employees who don't have Firebase accounts yet

### Query Examples

```typescript
// Get all HR app access for employees in a specific company
// Filter User App Access by employee_id → company_id

// Get permissions for an employee
// Filter User Permissions by employee_id

// Check if employee has access to HR app
// Query User App Access where employee_id = X AND app_id = 'hr'
```

## Migration Notes

If you have existing records with only `user_id`:
1. Match `user_id` (Firebase UID) to Employee records by email
2. Update records to include `employee_id`
3. Both fields can coexist - `user_id` for auth, `employee_id` for data relationships

## Best Practices

1. **Always set both fields** when creating permissions:
   - `user_id`: From Firebase Auth token
   - `employee_id`: Lookup Employee by email or Firebase UID

2. **Query by employee_id** when filtering by company/department

3. **Query by user_id** when checking permissions during authentication

4. **Keep them in sync**: When an employee's Firebase account changes, update both fields

