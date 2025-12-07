# Fillout Database Setup Guide

This guide will help you set up all fields and relationships for your Fillout Database.

## Prerequisites

1. **Database Created**: All tables should already be created in Fillout
2. **API Token**: `sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131`
3. **Database ID**: `aa7a307dc0a191a5`

## Step 1: Get Table IDs

First, you need to get the table IDs from your Fillout database. You can do this by:

### Option A: Using the Fillout Dashboard
1. Navigate to your database: https://build.fillout.com/database/aa7a307dc0a191a5/trwubaBRu4W/v8J1fT1cBsm
2. Click on each table
3. The table ID should be visible in the URL or table settings

### Option B: Using the API
```bash
curl -X GET \
  -H "Authorization: Bearer sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131" \
  -H "Content-Type: application/json" \
  "https://api.fillout.com/v1/databases/aa7a307dc0a191a5"
```

Or try:
```bash
curl -X GET \
  -H "Authorization: Bearer sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131" \
  -H "Content-Type: application/json" \
  "https://tables.fillout.com/api/v1/bases/aa7a307dc0a191a5"
```

## Step 2: Create Fields

Once you have the table IDs, you can create fields using one of these methods:

### Method 1: Using the Setup Scripts

#### Python Script (Recommended)
```bash
python3 setup_fillout_database.py
```

The script will:
1. Attempt to connect to the Fillout API
2. Retrieve table IDs automatically (if possible)
3. Create all fields and relationships
4. Handle errors gracefully

#### Bash Script
```bash
./setup_fillout_database.sh
```

The script will prompt you for table IDs and then create all fields.

### Method 2: Manual Creation via API

For each field, use this format:

```bash
curl -X POST \
  -H "Authorization: Bearer sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "field_name",
    "type": "text",
    "required": true
  }' \
  "https://api.fillout.com/v1/databases/aa7a307dc0a191a5/tables/{TABLE_ID}/fields"
```

### Method 3: Using Fillout Dashboard

You can also create fields manually in the Fillout dashboard:
1. Navigate to your database
2. Click on a table
3. Click "Add Field"
4. Configure the field according to the schema document

## Step 3: Field Creation Order

Create fields in this order to ensure relationships work correctly:

1. **Base Tables** (no dependencies):
   - Companies
   - Clients
   - Timezones

2. **Dependent Tables** (depend on base tables):
   - Departments (needs Companies)
   - Projects (needs Clients)
   - Timezone Actual (needs Timezones)

3. **Employee Tables**:
   - Employees (needs Companies, Departments, Timezones)
   - Employee Activity (needs Employees)

4. **Access Tables**:
   - Client Employee Access (needs Clients, Employees)

5. **Pay Period Tables**:
   - Pay Periods
   - Time Cards (needs Employees, Pay Periods, Clients)

6. **Punch Tables**:
   - Punches (needs Employees, Clients, Projects, Time Cards, Timezones)
   - Punch Alterations (needs Punches, Projects)

## Step 4: Field Type Reference

### Text Fields
```json
{
  "name": "name",
  "type": "text",
  "required": true
}
```

### Long Text/Rich Text Fields
```json
{
  "name": "memo",
  "type": "long_text",
  "required": false
}
```

### Email Fields
```json
{
  "name": "email",
  "type": "email",
  "required": true
}
```

### Number Fields
```json
{
  "name": "pay_rate",
  "type": "number",
  "required": true
}
```

### Date Fields
```json
{
  "name": "start_date",
  "type": "date",
  "required": true
}
```

### DateTime Fields
```json
{
  "name": "punch_in_time",
  "type": "datetime",
  "required": true
}
```

### Boolean/Checkbox Fields
```json
{
  "name": "is_active",
  "type": "checkbox",
  "required": false,
  "options": {
    "defaultValue": true
  }
}
```

### Select Fields
```json
{
  "name": "employment_type",
  "type": "select",
  "required": true,
  "options": {
    "choices": ["w2", "contract1099"]
  }
}
```

### Relationship Fields (One-to-Many)
```json
{
  "name": "company_id",
  "type": "link",
  "required": true,
  "options": {
    "targetTable": "{TARGET_TABLE_ID}",
    "relationshipType": "many-to-one",
    "displayField": "name"
  }
}
```

### Relationship Fields (Many-to-Many)
```json
{
  "name": "project_ids",
  "type": "link",
  "required": true,
  "options": {
    "targetTable": "{TARGET_TABLE_ID}",
    "relationshipType": "many-to-many",
    "displayField": "name"
  }
}
```

**Note**: Fillout might use `"type": "link"` instead of `"type": "relationship"` for relationship fields. Check the API response or documentation.

## Step 5: Verify Setup

After creating all fields, verify:

1. **All fields created**: Check each table has all required fields
2. **Relationships working**: Test creating a record and linking to related records
3. **Required fields enforced**: Try creating records without required fields
4. **Field types correct**: Verify dates, numbers, and selects work correctly

## Troubleshooting

### API Authentication Errors
- Verify your API token is correct
- Check that the token has proper permissions
- Ensure the Authorization header format is correct: `Bearer {token}`

### Table Not Found Errors
- Verify table IDs are correct
- Check that tables exist in the database
- Ensure you're using the correct database ID

### Field Creation Errors
- Check if field already exists (might need to delete and recreate)
- Verify field type is supported by Fillout
- Check relationship field configuration (target table ID, display field)

### Relationship Errors
- Ensure target tables exist before creating relationship fields
- Verify display field exists in target table
- Check relationship type is correct (many-to-one vs many-to-many)

## Next Steps

After setup is complete:

1. **Populate Initial Data**:
   - Add timezone records (all world timezones with DST variants)
   - Create your first company
   - Add departments
   - Add employees

2. **Test the Schema**:
   - Create a pay period
   - Generate time cards
   - Create test punches
   - Test punch alterations

3. **Update Flutter App**:
   - Replace mock data service with Fillout API service
   - Implement API calls for CRUD operations
   - Add error handling and loading states

## Resources

- [Fillout Database Overview](https://www.fillout.com/help/database/overview)
- [Fillout Database API Reference](https://support.fillout.com/help/database/api)
- [Field Types Documentation](https://www.fillout.com/help/database/field-types)
- Schema Documentation: See `FILLOUT_DATABASE_SCHEMA.md`

## Support

If you encounter issues:
1. Check the Fillout API documentation
2. Review error messages carefully
3. Test API calls manually with curl/Postman
4. Contact Fillout support if needed: support@fillout.com

