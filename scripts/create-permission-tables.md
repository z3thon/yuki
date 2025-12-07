# Creating Permission Tables in Fillout

## Overview

This guide helps you create the three permission tables needed for Yuki's permission system:
1. **User App Access** - Controls which apps users can access
2. **User Permissions** - Granular permissions (app/view/resource/action)
3. **Views** - Stores user-created and default views/dashboards

## Option 1: Create via Fillout UI (Recommended)

### Step 1: Create "User App Access" Table

1. Go to Fillout Dashboard → Database → Your Database
2. Click "Create Table" → Name it: **User App Access**
3. Add these fields:

| Field Name | Field Type | Required | Options |
|------------|-----------|----------|---------|
| `user_id` | Single Line Text | ✅ Yes | - |
| `app_id` | Select | ✅ Yes | Options: `hr`, `crm`, `billing` |
| `granted_at` | Date Time | ✅ Yes | Auto-fill: Current time |
| `created_at` | Date Time | ✅ Yes | Auto-fill: Current time |
| `updated_at` | Date Time | ✅ Yes | Auto-fill: Current time |

### Step 2: Create "User Permissions" Table

1. Create new table: **User Permissions**
2. Add these fields:

| Field Name | Field Type | Required | Options |
|------------|-----------|----------|---------|
| `user_id` | Single Line Text | ✅ Yes | - |
| `app_id` | Select | ✅ Yes | Options: `hr`, `crm`, `billing` |
| `view_id` | Single Line Text | ❌ No | - |
| `resource_type` | Single Line Text | ❌ No | - |
| `resource_id` | Single Line Text | ❌ No | - |
| `actions` | Multi-Select | ✅ Yes | Options: `read`, `write`, `delete`, `approve` |
| `created_at` | Date Time | ✅ Yes | Auto-fill: Current time |
| `updated_at` | Date Time | ✅ Yes | Auto-fill: Current time |

### Step 3: Create "Views" Table

1. Create new table: **Views**
2. Add these fields:

| Field Name | Field Type | Required | Options |
|------------|-----------|----------|---------|
| `app_id` | Select | ✅ Yes | Options: `hr`, `crm`, `billing` |
| `name` | Single Line Text | ✅ Yes | - |
| `description` | Long Text | ❌ No | - |
| `is_default` | Checkbox | ❌ No | Default: false |
| `is_custom` | Checkbox | ❌ No | Default: true |
| `created_by` | Single Line Text | ❌ No | - |
| `shared_with` | Multi-Select | ❌ No | - |
| `config` | Long Text | ✅ Yes | Store JSON string |
| `created_at` | Date Time | ✅ Yes | Auto-fill: Current time |
| `updated_at` | Date Time | ✅ Yes | Auto-fill: Current time |

### Step 4: Get Table IDs

1. After creating each table, click on the table
2. Look at the URL: `https://build.fillout.com/database/{databaseId}/{tableId}/...`
3. Copy the `tableId` from the URL
4. Add to your `.env.local`:

```bash
# Permission Table IDs (get from Fillout URLs after creating tables)
USER_APP_ACCESS_TABLE_ID=your_table_id_here
USER_PERMISSIONS_TABLE_ID=your_table_id_here
VIEWS_TABLE_ID=your_table_id_here
```

### Step 5: Initialize in Yuki

1. Start your dev server: `npm run dev`
2. Call the initialize endpoint:
   ```bash
   curl -X POST http://localhost:3011/api/admin/permissions/initialize \
     -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
   ```

Or use the API route in your app to auto-discover table IDs by name.

## Option 2: Create via API (If Supported)

The API endpoint for creating tables is:
```
POST /bases/{databaseId}/tables
```

However, table creation via API may have limitations. Verify with Fillout support if this works for your use case.

## Field Type Notes

### Select Fields
- For `app_id`: Create select field with options: `hr`, `crm`, `billing`
- For `actions`: Create multi-select with options: `read`, `write`, `delete`, `approve`

### Date Time Fields
- Set to auto-fill with current time
- Format: ISO 8601 (`2025-01-01T00:00:00Z`)

### Multi-Select Fields
- `actions` in User Permissions: Multi-select
- `shared_with` in Views: Multi-select (stores array of user IDs)

### JSON Storage
- `config` field in Views: Store as Long Text, but content is JSON
- Example: `{"type": "table", "query": "...", "filters": {...}}`

## Testing

After creating tables:

1. **Test table discovery:**
   ```bash
   GET /api/admin/tables/list
   ```

2. **Test permission initialization:**
   ```bash
   POST /api/admin/permissions/initialize
   ```

3. **Test creating a permission:**
   ```bash
   POST /api/admin/permissions
   {
     "userId": "test_user_id",
     "appId": "hr",
     "actions": ["read", "write"]
   }
   ```

## Troubleshooting

### "Table not found"
- Verify table names match exactly (case-sensitive)
- Check table IDs are correct
- Ensure tables exist in the correct database

### "Field not found"
- Verify field names match exactly (case-sensitive)
- Check field types are correct
- Ensure required fields are set

### "Invalid filter"
- Use `in` operator for multi-select fields
- Use `eq` operator for single-select fields
- Check field names/IDs are correct

## Next Steps

After creating tables:
1. ✅ Initialize table IDs in Yuki
2. ✅ Create default views for HR app
3. ✅ Set up admin user permissions
4. ✅ Test permission system

See `MILESTONES.md` Milestone 2 for next steps.

