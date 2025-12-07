# Scripts Directory

## Python Scripts

### create_permission_tables.py
Creates the three permission tables in Fillout Database:
- User App Access
- User Permissions  
- Views

**Usage:**
```bash
# Install dependencies (if needed)
pip3 install requests python-dotenv

# Run script
python3 scripts/create_permission_tables.py
```

**Requirements:**
- Python 3.7+
- `requests` library
- `python-dotenv` library
- `.env.local` with `FILLOUT_API_TOKEN` and `FILLOUT_BASE_ID`

### test_fillout_db.py
Test script to verify Fillout API access and list accessible databases.

**Usage:**
```bash
python3 scripts/test_fillout_db.py
```

## TypeScript Scripts

### generate-fillout-config.ts
**IMPORTANT**: This script generates the Fillout table and field ID configuration file.

This script queries the Fillout API to discover all tables and fields in your database,
then generates `lib/fillout-config.generated.ts` with all table IDs and field IDs.

**Why use this?**
- Table and field IDs are automatically discovered from your database schema
- No need to manually maintain field IDs in `.env.local` files
- Only the API token needs to be in `.env.local` - everything else is auto-generated
- The generated config file is version-controlled and can be regenerated anytime

**Usage:**
```bash
# Make sure FILLOUT_API_TOKEN is set in .env.local
npx tsx scripts/generate-fillout-config.ts
```

**When to regenerate:**
- When you add new tables or fields to your Fillout database
- When field IDs change (rare, but can happen if fields are recreated)
- After pulling changes that modify the database schema

**Output:**
- Generates `lib/fillout-config.generated.ts` with:
  - Table ID constants (e.g., `TABLE_EMPLOYEES_ID`)
  - Field ID constants (e.g., `EMPLOYEE_PAY_RATES_EMPLOYEE_ID_FIELD_ID`)
  - Helper functions (`getTableId()`, `getFieldId()`)
  - Full config object for programmatic access

**Note**: The generated file is auto-generated - do not edit it manually.
Instead, regenerate it when your database schema changes.

### create-permission-tables.ts
TypeScript version (legacy - use Python version instead).

**Usage:**
```bash
npm run create-tables
```

## Database Access

**Important**: Make sure your API token has access to the target database (`aa7a307dc0a191a5`).

If you get a 404 error:
1. Verify the database ID is correct
2. Check that your API token has access to this database
3. Grant access in Fillout dashboard if needed

