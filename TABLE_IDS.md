# Fillout Table IDs

## Database Information
- **Database Name**: Discover NoCode DB  
- **Database ID**: `aa7a307dc0a191a5`
- **Base URL**: `https://tables.fillout.com/api/v1/bases`
- **API Token**: Set in `.env.local` as `FILLOUT_API_TOKEN`

## Permission Tables

### ✅ User App Access
- **Table ID**: `tpwLPMUfiwS`
- **Status**: Created successfully ✅
- **Fields**: 
  - `user_id` (single_line_text, required)
  - `app_id` (single_select: hr, crm, billing, required)
  - `granted_at` (datetime, required)
  - `created_at` (datetime, required)
  - `updated_at` (datetime, required)

### ✅ User Permissions
- **Table ID**: `t8bkw75uxCC`
- **Status**: Created successfully ✅
- **Fields**:
  - `user_id` (single_line_text, required)
  - `app_id` (single_select: hr, crm, billing, required)
  - `view_id` (single_line_text, optional)
  - `resource_type` (single_line_text, optional)
  - `resource_id` (single_line_text, optional)
  - `actions` (multiple_select: read, write, delete, approve, required)
  - `created_at` (datetime, required)
  - `updated_at` (datetime, required)

### ✅ Views
- **Table ID**: `t1F3H9vT9Gr`
- **Status**: Created successfully ✅
- **Fields**: 
  - `name` (single_line_text, required)
  - `app_id` (single_select: hr, crm, billing, required)
  - `config` (long_text, required)
  - `description` (long_text, optional)
  - `is_default` (checkbox, optional)
  - `is_custom` (checkbox, optional)
  - `created_by` (single_line_text, optional)

## Environment Variables

Add these to your `.env.local`:

```bash
# Fillout Database
FILLOUT_BASE_ID=aa7a307dc0a191a5

# Permission Table IDs
USER_APP_ACCESS_TABLE_ID=tpwLPMUfiwS
USER_PERMISSIONS_TABLE_ID=t8bkw75uxCC
VIEWS_TABLE_ID=your_table_id_here  # Get after creating manually
```

## Creating Views Table Manually

Since the API fails to create the Views table, create it manually:

1. **Go to Fillout Dashboard**
   - Navigate to: https://build.fillout.com/database/aa7a307dc0a191a5
   - Or search for "Discover NoCode DB"

2. **Create New Table**
   - Click "Create Table" or "+" button
   - Name it: **"User Views"** (or "App Views")

3. **Add Required Fields**
   - `app_id` - **Single Select** field
     - Options: `hr`, `crm`, `billing`
   - `name` - **Single Line Text** field (required)
   - `config` - **Long Text** field (required) - stores JSON

4. **Add Optional Fields** (can add later if needed)
   - `description` - Long Text
   - `is_default` - Checkbox
   - `is_custom` - Checkbox  
   - `created_by` - Single Line Text
   - `shared_with` - Multiple Select (or Single Line Text for comma-separated)
   - `created_at` - Date Time
   - `updated_at` - Date Time

5. **Get Table ID**
   - After creating, click on the table
   - Look at the URL: `https://build.fillout.com/database/aa7a307dc0a191a5/{TABLE_ID}/...`
   - Copy the `TABLE_ID` from the URL
   - Add to `.env.local` as `VIEWS_TABLE_ID`

## Verification

After setting up all tables, verify with:

```bash
# Test database access
python3 scripts/test_fillout_db.py

# Or test via API
curl -X GET "https://tables.fillout.com/api/v1/bases/aa7a307dc0a191a5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### ⏳ Employee Pay Rate History
- **Table ID**: To be created
- **Status**: Needs to be created manually
- **Purpose**: Track historical changes to employee pay rates
- **Fields**:
  - `employee_id` (linked_record → Employees, required)
  - `pay_rate` (number/decimal, required)
  - `start_date` (date, required)
  - `end_date` (date, optional - null means still active)
  - `created_at` (datetime, auto)
  - `updated_at` (datetime, auto)
- **See**: `docs/PAY_RATE_HISTORY_SCHEMA.md` for full schema details

## Next Steps

1. ✅ Tables created: User App Access, User Permissions
2. ⏳ Create Views table manually (see above)
3. ⏳ Create Employee Pay Rate History table manually (see docs/PAY_RATE_HISTORY_SCHEMA.md)
4. ✅ Add table IDs to `.env.local`
5. ✅ Test permission system

## API Discovery

**Fillout API Limitation**: The Views table creation consistently fails via API with error "Failed to create table" (400 Bad Request), even with minimal fields. This appears to be a Fillout API limitation rather than a configuration issue.

**Workaround**: Create the Views table manually via Fillout UI, then use the API for record operations.
