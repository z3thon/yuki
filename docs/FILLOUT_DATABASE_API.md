# Fillout Database API Reference

## Overview

Fillout's Zite Database is a built-in database system that allows you to create and manage databases without writing SQL or code. It supports over 20 field types including text, numbers, dates, files, and relationships.

**⚠️ Important Note**: Fillout's API documentation is incomplete and sometimes incorrect. This document contains discovered working patterns and formats that may differ from official documentation. Always test API changes and update this document with new discoveries.

**⚠️ Important Note**: Fillout's API documentation is incomplete and sometimes incorrect. This document contains discovered working patterns and formats that may differ from official documentation. Always test API changes and update this document with new discoveries.

## Authentication

All API requests must include your API key in the Authorization header:

```
Authorization: Bearer <your-api-key>
```

**Database URL:** `https://build.fillout.com/database/f252dc2174d39484/...`

**Database ID:** `f252dc2174d39484` (Discover NoCode DB)

## Base URL

The Fillout Database API base URL is:

```
https://tables.fillout.com/api/v1
```

For EU servers:
```
https://eu-tables.fillout.com/api/v1
```

**Reference**: [Fillout Database API Documentation](https://www.fillout.com/help/database/get-databases)

## Rate Limits

- Maximum 50 requests per second per Account/API key
- Contact support@fillout.com for increased rate limits

## API Endpoints

### Databases

#### Get All Databases
```
GET /bases
```

Lists all databases for your organization. Returns an array of databases, each containing:
- `id` - Database UUID
- `name` - Database name
- `tables` - Array of tables with their fields and views
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

**Response Structure:**
```json
[
  {
    "id": "f252dc2174d39484",
    "name": "Discover NoCode DB",
    "tables": [
      {
        "id": "table_id",
        "name": "Table Name",
        "order": 0,
        "primaryFieldId": "field_id",
        "fields": [
          {
            "id": "field_id",
            "name": "Field Name",
            "type": "single_line_text",
            "template": {},
            "order": 0
          }
        ],
        "views": [...]
      }
    ],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
]
```

**Example:**
```bash
curl -X GET "https://tables.fillout.com/api/v1/bases" \
  -H "Authorization: Bearer sk_prod_..."
```

**Reference**: [Get Databases Documentation](https://www.fillout.com/help/database/get-databases)

#### Get Database by ID
```
GET /bases/{databaseId}
```

Retrieves detailed information about a specific database, including all tables, fields, and views.

**Response Structure:**
```json
{
  "id": "f252dc2174d39484",
  "name": "Discover NoCode DB",
  "tables": [
    {
      "id": "table_id",
      "name": "Table Name",
      "order": 0,
      "primaryFieldId": "field_id",
      "fields": [
        {
          "id": "field_id",
          "name": "Field Name",
          "type": "single_line_text",
          "template": {},
          "order": 0
        }
      ],
      "views": [...]
    }
  ],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

**Usage Notes:**
- Use this endpoint to discover table IDs and structure
- Tables array contains all tables with their fields and views
- Field names and IDs can both be used in queries
- Table names are case-sensitive in API but can be found case-insensitively by iterating

#### Create Database
```
POST /bases
```

Allows you to create a new database with complete table and field structures in a single API call.

### Tables

#### List Tables
To get all tables, use the [Get All Databases](#get-all-databases) endpoint. The response includes all tables with their fields and views for each database.

Alternatively, you can get tables for a specific database:
```
GET /bases/{databaseId}
```

This returns the database with all its tables, fields, and views.

#### Create Table
```
POST /bases/{databaseId}/tables
```

Creates a new table within a database. Requires at least one field in the `fields` array.

**Request Body:**
```json
{
  "name": "Table Name",
  "fields": [
    {
      "name": "field_name",
      "type": "single_line_text",
      "template": {},
      "required": false
    }
  ]
}
```

**Field Types:**
- `single_line_text` - Single line text input
- `long_text` - Multi-line text input
- `number` - Numeric values
- `date` - Date only
- `datetime` - Date and time
- `single_select` - Single select dropdown
- `multiple_select` - Multiple select dropdown
- `linked_record` - Relationship to another table
- `checkbox` - Boolean checkbox
- `email` - Email address
- `url` - Web URL
- `phone_number` - Phone number

**Important Notes:**
- Table creation via API may have limitations - some complex tables may need to be created via UI
- Field types must match exactly: `single_select` (not `select`), `multiple_select` (not `multi_select`), `datetime` (not `date_time`)
- For `single_select` and `multiple_select`, provide choices in `template.options.choices` array
- Table names must be unique within a database
- Some field combinations may fail - if API creation fails, use Fillout UI

**Example:**
```json
{
  "name": "User App Access",
  "fields": [
    {
      "name": "user_id",
      "type": "single_line_text",
      "required": true
    },
    {
      "name": "app_id",
      "type": "single_select",
      "required": true,
      "template": {
        "choices": [
          { "name": "hr", "color": "blue" },
          { "name": "crm", "color": "purple" },
          { "name": "billing", "color": "pink" }
        ]
      }
    }
  ]
}
```

#### Update Table
```
PUT /v1/databases/{databaseId}/tables/{tableId}
```

Modifies table properties and settings.

#### Delete Table
```
DELETE /v1/databases/{databaseId}/tables/{tableId}
```

Removes a table from the database.

### Fields

#### Create Field
```
POST /bases/{databaseId}/tables/{tableId}/fields
```

Adds new fields to existing tables.

**Request Body:**
```json
{
  "name": "field_name",
  "type": "single_line_text", // or "number", "date", "datetime", "linked_record", etc.
  "required": false,
  "template": {} // Field-specific options
}
```

**Note**: Fillout uses `"type": "linked_record"` for relationship fields. The `template` object contains relationship configuration.

#### Update Field
```
PUT /bases/{databaseId}/tables/{tableId}/fields/{fieldId}
```

Modifies field properties and configurations.

#### Delete Field
```
DELETE /bases/{databaseId}/tables/{tableId}/fields/{fieldId}
```

Removes fields from tables.

### Records

#### Create Record
```
POST /bases/{databaseId}/tables/{tableId}/records
```

Adds new records to a table with field data.

**Request Body:**
```json
{
  "record": {
    "field_name": "value",
    "another_field": 123
  }
}
```

**Critical Discovery (2025-12-06):**
- **Correct Format**: The API requires `{"record": {field_name: value, ...}}` format
- **Fields go directly under "record"** - NOT nested in a "fields" object
- **Wrong**: `{"record": {"fields": {...}}}` - This creates records but fields are null!
- **Right**: `{"record": {"user_id": "value", "app_id": "hr"}}`
- **Common Error**: If you get `400 Bad Request` with error `"expected record, received undefined"` at path `["data"]`, you're missing the `record` wrapper
- **Common Issue**: Records created but fields are null - this means you used `{"record": {"fields": {...}}}` instead of `{"record": {...}}`

**Field Formatting:**
- Field names must match exactly (case-sensitive) as defined in the table schema
- Auto-generated fields (`created_at`, `updated_at`) should not be included in create requests
- For `single_select` fields, provide the exact option value as a string (e.g., `"hr"`, `"crm"`, `"billing"`)
- For `linked_record` fields:
  - **Create**: Use field ID (not field name) - e.g., `{"record": {"fjdE51bBqzV": ["record-id-1"]}}`
  - **Update**: Use field ID (not field name) - e.g., `{"fields": {"fjdE51bBqzV": ["record-id-1"]}}`
  - Always provide as an array, even for single-value relationships: `["record-id-1"]`
  - Field names may work for regular fields, but `linked_record` fields consistently require field IDs
- For `datetime` fields, use ISO 8601 format: `"2025-12-06T15:08:55.639651"` or `"2025-12-06T15:08:55Z"`
- For `multiple_select` fields, provide an array: `["value1", "value2"]`
- `null` values are allowed for optional fields

**Finding Field IDs for Linked Records:**
1. Query table structure: `GET /bases/{databaseId}`
2. Find the table in the `tables` array
3. Locate the `linked_record` field in the `fields` array
4. Use the `id` property (e.g., `"fjdE51bBqzV"`) instead of the `name` property

**Example (Regular Fields):**
```bash
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "user_id": "QIcvJl1MA3cMw26PwzkJVnmgaJu2",
      "app_id": "hr",
      "granted_at": "2025-12-06T15:08:55.639651"
    }
  }'
```

**Example (With Linked Record - Use Field ID):**
```bash
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "user_id": "QIcvJl1MA3cMw26PwzkJVnmgaJu2",
      "fjdE51bBqzV": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"],
      "app_id": "hr",
      "granted_at": "2025-12-06T15:08:55.639651"
    }
  }'
```

**Note**: In the example above, `fjdE51bBqzV` is the field ID for the `employee_id` linked_record field. Use field IDs (not names) for `linked_record` fields.

**Response:**
```json
{
  "id": "551754ba-e5cd-4537-890e-bfb10ab3426c",
  "data": {...},
  "fields": {...},
  "createdAt": "2025-12-06T22:08:49.000Z",
  "updatedAt": "2025-12-06T22:08:49.000Z"
}
```

#### Get Record by ID
```
GET /bases/{databaseId}/tables/{tableId}/records/{recordId}
```

Retrieves a specific record by its unique identifier.

#### List Records
```
POST /bases/{databaseId}/tables/{tableId}/records/list
```

Gets all records from a table with filtering options. Uses POST method with request body.

**Request Body:**
```json
{
  "limit": 100,
  "offset": 0,
  "filters": {
    "field_name": {"eq": "value"}
  }
}
```

**Important Notes on Filters:**
- **Regular fields** (text, number, date, etc.): Use `{"eq": "value"}` for exact matches
- **Linked Record fields**: Use `{"in": ["value"]}` for single-value linked records, or `{"in": ["value1", "value2"]}` for multiple values
- **Multi-select fields**: Use `{"in": ["value1", "value2"]}` to match records containing ANY of the values
- The `eq` operator does NOT work for linked_record fields - you must use `in` operator
- Field names work (e.g., `"employee_id"`) as well as field IDs (e.g., `"fjysyYmr13B"`)
- Field names are case-sensitive - use exact field names as defined in the table
- For date/datetime fields, use ISO 8601 format: `"2025-01-01T00:00:00Z"`

**Filter Operators:**
- `eq` - Equals (text, number, date)
- `ne` - Not equals
- `gt` - Greater than (number, date)
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `in` - In array (required for linked_record, multiple_select)
- `contains` - Contains substring (text fields)
- `startsWith` - Starts with (text fields)
- `endsWith` - Ends with (text fields)

**Filter Examples:**
```json
{
  "filters": {
    // Regular text field
    "name": {"eq": "John Doe"},
    
    // Regular number field
    "age": {"gte": 18, "lt": 65},
    
    // Linked record field (single value) - MUST use "in" operator
    "employee_id": {"in": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"]},
    "client_id": {"in": ["602a4066-4d9a-4eb7-bb60-37bfa6655926"]},
    "pay_period_id": {"in": ["801b3f2a-1e3b-4ac5-abf9-aa602bfc0515"]},
    
    // Multiple conditions
    "status": {"in": ["Active", "Pending"]},
    
    // Date range
    "created_at": {"gte": "2025-01-01T00:00:00Z", "lt": "2025-12-31T23:59:59Z"}
  }
}
```

**Query Parameters (Alternative GET endpoint):**
- `filter`: Filter records by field values
- `sort`: Sort records by field
- `limit`: Limit number of records returned
- `offset`: Pagination offset

#### Update Record
```
PATCH /bases/{databaseId}/tables/{tableId}/records/{recordId}
```

Modifies existing record data.

**Request Body:**
```json
{
  "record": {
    "field_name": "new_value"
  }
}
```

**Critical Discovery (2025-12-06):**
- **Update Format**: Use `{"record": {field_name: value}}` format (SAME as create!)
- **Create uses**: `{"record": {field_name: value}}`
- **Update uses**: `{"record": {field_name: value}}` (NOT `{"fields": {...}}`)
- **Wrong**: `{"fields": {"actions": ["read"]}}` - Returns 400 error expecting "record"
- **Right**: `{"record": {"actions": ["read"]}}`
- **Linked Record Fields**: For `linked_record` fields, you MUST use the field ID (not field name) when updating
- **Field Names vs IDs**: Regular fields can use names, but `linked_record` fields require field IDs in updates

**Linked Record Update Format:**
```json
{
  "record": {
    "field_id_for_linked_record": ["record-id-1", "record-id-2"]
  }
}
```

**Example:**
```bash
curl -X PATCH "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records/{recordId}" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "fpwC9wNgLvN": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"]
    }
  }'
```

**⚠️ Critical Notes:**
- Use field ID (`fpwC9wNgLvN`) not field name (`timezone_actual_id`) for `linked_record` fields
- If updating a `linked_record` field doesn't work with the field name, use the field ID instead
- You can find field IDs by querying the table structure via `GET /bases/{databaseId}`
- Relationship arrays must be provided as arrays: `["id"]` even for single-value relationships

#### Delete Record
```
DELETE /bases/{databaseId}/tables/{tableId}/records/{recordId}
```

Removes a record from the database.

## Field Types

Fillout supports over 20 field types including:

- **Text**: Single-line or multi-line text
- **Number**: Integer or decimal numbers
- **Date**: Date values
- **DateTime**: Date and time values
- **Boolean**: True/false values
- **File**: File attachments
- **Relationship**: Links to records in other tables (One-to-Many, Many-to-Many)
- **Select**: Dropdown selection
- **Multi-select**: Multiple selections
- **Email**: Email addresses
- **URL**: Web URLs
- **Phone**: Phone numbers
- **Currency**: Monetary values
- **Percent**: Percentage values
- **Rating**: Star ratings
- **Checkbox**: Checkbox fields
- **Formula**: Calculated fields

## Error Handling

All API errors return a consistent response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Common Error Codes:**
- `INVALID_RECORD_ID`: Record ID is invalid
- `NOT_FOUND`: Resource not found
- `BAD_REQUEST`: Invalid request parameters
- `UNAUTHORIZED`: Authentication failed
- `INTERNAL_SERVER_ERROR`: Server error
- `NOT_IMPLEMENTED`: Feature not available

## Relationships

Relationships allow you to link records between tables:

- **One-to-Many**: One record in Table A can relate to many records in Table B
- **Many-to-Many**: Many records in Table A can relate to many records in Table B

When creating a relationship field, specify:
- Target table
- Relationship type (one-to-many or many-to-many)
- Display field (which field from the related table to show)

## Table Discovery & Management

### Finding Tables by Name

Since Fillout doesn't provide a direct "get table by name" endpoint, you need to:

1. Get all tables: `GET /bases/{databaseId}`
2. Iterate through `tables` array
3. Match by `name` property (case-sensitive)

**Example:**
```typescript
const database = await fetch(`/bases/${databaseId}`);
const tables = database.tables;
const targetTable = tables.find(t => t.name === "Table Name");
```

### Table ID Storage

- Table IDs are stable and don't change
- Store table IDs in environment variables or a configuration table
- Table IDs are required for all record operations
- Field IDs can be found in the table's `fields` array

### Field Name vs Field ID

**For Queries (Filters):**
- Both field names and IDs work in queries/filters
- **Field Name**: `"employee_id"` (human-readable, easier to maintain)
- **Field ID**: `"fjysyYmr13B"` (stable, doesn't change if field renamed)

**For Creating/Updating Records:**
- **Regular Fields**: Can use either field names or IDs
- **Linked Record Fields**: **MUST use field IDs** (field names will not work)
  - Create: `{"record": {"fjdE51bBqzV": ["record-id"]}}` ✅
  - Create: `{"record": {"employee_id": ["record-id"]}}` ❌ (will create record but field will be null)
  - Update: `{"record": {"fpwC9wNgLvN": ["record-id"]}}` ✅
  - Update: `{"record": {"timezone_actual_id": ["record-id"]}}` ❌ (update fails silently or returns error)

**Recommendation**: 
- Use field names for queries/filters (readability)
- Use field IDs for `linked_record` fields in create/update operations (required)
- Store field IDs in a generated config file that can be regenerated when fields change
- When reading records, check both field name and field ID for robustness
- When copying relationship arrays between records, copy the entire array as-is

### Multi-Select Field Handling

Multi-select fields store arrays of values. When filtering:
- Use `{"in": ["value1", "value2"]}` to match records containing ANY of the values
- Use multiple `in` filters with AND logic for records containing ALL values

**Example:**
```json
{
  "filters": {
    "tags": {"in": ["urgent", "important"]}  // Matches records with "urgent" OR "important"
  }
}
```

### JSON Field Handling

Some fields store JSON data (like view configurations):
- Store as string: `JSON.stringify(config)`
- Retrieve and parse: `JSON.parse(record.fields.config)`
- Fillout may return JSON as string or object depending on field type

## Table Creation Limitations

**Important Discovery**: Table creation via API has limitations:
- Simple tables with basic fields work fine (e.g., User App Access, User Permissions)
- Some table configurations consistently fail via API, even with minimal fields
- Error message is generic: `"Failed to create table"` (400 Bad Request)
- **Known Issue**: Tables with `single_select` + `long_text` combination may fail
- **Workaround**: Create problematic tables via Fillout UI, then use API for records

**Example**: Views table creation fails even with just 3 fields (single_select, single_line_text, long_text). This appears to be a Fillout API limitation rather than a configuration issue.

**Field Type Requirements**:
- Use exact type names: `single_select` (not `select`), `multiple_select` (not `multi_select`)
- Use `datetime` (not `date_time`)
- Checkbox fields may cause issues in some table configurations
- Multiple datetime fields in one table may cause creation to fail

## Error Handling Best Practices

### Common Errors

1. **Table Not Found**: Verify table ID is correct
2. **Field Not Found**: Check field name spelling (case-sensitive)
3. **Invalid Filter**: Use `in` operator for linked_record fields
4. **Rate Limit**: Implement exponential backoff (50 req/sec limit)

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Additional error context
  }
}
```

### Handling Errors

```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Fillout API error: ${error.error?.message || response.statusText}`);
  }
  return await response.json();
} catch (error) {
  // Handle error (log, retry, etc.)
  console.error('Fillout API error:', error);
  throw error;
}
```

## Performance Optimization

### Caching Table Structure

- Table structure rarely changes
- Cache table metadata (IDs, field names) in memory
- Refresh cache periodically or on-demand

### Batch Operations

- Use `limit` and `offset` for pagination
- Default limit is usually 100 records
- Use `offset` token from response for next page

### Query Optimization

- Use specific filters to reduce result set
- Sort on indexed fields when possible
- Request only needed fields if API supports field selection

## Example API Calls

### Get All Databases (with Tables)
```bash
curl -X GET "https://tables.fillout.com/api/v1/bases" \
  -H "Authorization: Bearer sk_prod_..."
```

### Create a Text Field
```bash
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/fields" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "name",
    "type": "single_line_text",
    "template": {}
  }'
```

### Create a Relationship Field
```bash
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/fields" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "employee",
    "type": "linked_record",
    "template": {
      "targetTable": "employees_table_id",
      "relationshipType": "many-to-one"
    }
  }'
```

**Note**: Fillout uses `"type": "linked_record"` for relationship fields. The `template` object contains relationship configuration.

### Create Record with Linked Record Field
```bash
# First, get the field ID for the linked_record field
curl -X GET "https://tables.fillout.com/api/v1/bases/{databaseId}" \
  -H "Authorization: Bearer sk_prod_..."

# Then use the field ID (not name) when creating the record
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "user_id": "firebase_uid_123",
      "fjdE51bBqzV": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"],
      "app_id": "hr"
    }
  }'
```

**⚠️ Critical**: Use the field ID (`fjdE51bBqzV`) not the field name (`employee_id`) for `linked_record` fields.

### Update Record with Linked Record Field
```bash
# Use field ID (not name) when updating linked_record fields
curl -X PATCH "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records/{recordId}" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "fpwC9wNgLvN": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"]
    }
  }'
```

**⚠️ Critical**: 
- Update uses `{"record": {...}}` format (SAME as create!)
- Use field ID (not name) for `linked_record` fields - field names will fail silently
- Provide as array even for single-value relationships: `["id"]` not `"id"`
- When copying relationship arrays from one record to another, copy the entire array as-is

### Create a Record
```bash
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }'
```

**⚠️ Critical**: 
- Always use `{"record": {field_name: value, ...}}` format
- Fields go directly under `"record"`, NOT nested in `"fields"`
- Wrong: `{"record": {"fields": {...}}}` - Creates record but fields are null!
- Right: `{"record": {"name": "John", "email": "john@example.com"}}`

### List Records with Filter
```bash
curl -X POST "https://tables.fillout.com/api/v1/bases/{databaseId}/tables/{tableId}/records/list" \
  -H "Authorization: Bearer sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "employee_id": {"in": ["5307b392-cd10-4b62-bd56-e3e61076c0b2"]},
      "client_id": {"in": ["602a4066-4d9a-4eb7-bb60-37bfa6655926"]},
      "pay_period_id": {"in": ["801b3f2a-1e3b-4ac5-abf9-aa602bfc0515"]}
    },
    "limit": 100,
    "offset": 0
  }'
```

**Note**: For linked_record fields, always use `{"in": ["value"]}` instead of `{"eq": "value"}`. The `eq` operator does not work for linked records.

## Known API Inconsistencies & Discoveries

Since Fillout's API documentation is incomplete, this section tracks discovered working patterns that differ from official docs:

### Create Record Format (2025-12-06)
- **Official docs say**: `{"fields": {...}}`
- **Actually works**: `{"record": {field_name: value, ...}}`
- **Fields go directly under "record"** - NOT nested in "fields"
- **Error if wrong format**: `400 Bad Request` with `"expected record, received undefined"` at path `["data"]`
- **Issue if nested wrong**: Records created but all fields are null - means you used `{"record": {"fields": {...}}}` instead of `{"record": {...}}`
- **Solution**: Always use `{"record": {"field_name": "value", ...}}` format

### Update Record Format (2025-12-06)
- **Same as Create**: Update uses `{"record": {field_name: value}}` (same format as create!)
- **Create**: `{"record": {field: value}}`
- **Update**: `{"record": {field: value}}` ✅ (NOT `{"fields": {...}}`)
- **Common Mistake**: Using `{"fields": {...}}` format returns 400 error expecting "record"

### Linked Record Fields (2025-12-06)
- **Critical Discovery**: `linked_record` fields require field IDs (not field names) in create/update operations
- **Create with field name**: `{"record": {"employee_id": ["id"]}}` ❌ Creates record but field is null/empty
- **Create with field ID**: `{"record": {"fjdE51bBqzV": ["id"]}}` ✅ Works correctly
- **Update with field name**: `{"record": {"timezone_actual_id": ["id"]}}` ❌ Field update fails silently or returns error
- **Update with field ID**: `{"record": {"fpwC9wNgLvN": ["id"]}}` ✅ Works correctly
- **Why**: Fillout's API treats `linked_record` fields differently - they must be referenced by ID
- **Finding Field IDs**: Query table structure via `GET /bases/{databaseId}` and look in `tables[].fields[].id`
- **Regular fields**: Can use names or IDs (names preferred for readability)
- **Linked record fields**: Must use IDs (names don't work)

### Field IDs Can Change (2025-12-06)
- **Important**: Field IDs are NOT permanent - they change when a field is deleted and recreated
- **Scenario**: If you delete a field (e.g., `status`) and recreate it with the same name, it gets a NEW field ID
- **Impact**: Code using hardcoded field IDs will break with error: `column "oldFieldId" does not exist`
- **Solution**: 
  - Use a config generation script to auto-discover field IDs from the API
  - Store field IDs in a generated config file that can be regenerated
  - When fields are recreated, regenerate the config to get new IDs
- **Best Practice**: Always use constants from a generated config file, never hardcode field IDs

### Reading vs Writing Fields (2025-12-06)
- **Reading Records**: Fillout may return fields by name OR by field ID (inconsistent!)
  - Example: `record.fields.status` OR `record.fields["feNvSx9giZs"]`
  - **Best Practice**: Check both when reading: `record.fields.status || record.fields[STATUS_FIELD_ID]`
- **Writing Records**: 
  - **Regular fields**: Can use names or IDs (names preferred)
  - **Linked record fields**: MUST use field IDs (names don't work)
  - **Filters**: Can use names or IDs (names preferred for readability)
- **Robust Pattern**: When reading, try both name and ID. When writing `linked_record` fields, always use ID.

### Copying Relationship Arrays Between Records (2025-12-06)
- **Context**: When copying `linked_record` field values from one record (e.g., alteration) to another (e.g., punch)
- **Key Discovery**: Relationship arrays must be copied as arrays, using field IDs for the destination
- **Pattern**:
  1. Read from source: Try both field name and field ID (e.g., `alteration.fields.new_timezone_actual_id || alteration.fields[NEW_TIMEZONE_FIELD_ID]`)
  2. Handle array format: If already array, use as-is; if single value, wrap in array; if null/undefined, use empty array
  3. Write to destination: Use field ID (not name) for the destination field
- **Example**:
```typescript
// Read from alteration (try both name and ID)
const rawInTimezone = alteration.fields.new_timezone_actual_id 
  || alteration.fields[NEW_TIMEZONE_ACTUAL_ID_FIELD_ID];

// Normalize to array format
let timezoneArray: string[];
if (Array.isArray(rawInTimezone)) {
  timezoneArray = rawInTimezone;
} else if (rawInTimezone) {
  timezoneArray = [rawInTimezone];
} else {
  timezoneArray = []; // Clear if null/undefined
}

// Write to punch using field ID (required!)
punchUpdates[PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID] = timezoneArray;
```
- **Critical**: Always use field IDs when writing `linked_record` fields, even when copying from another record

### Table Discovery
- Use `GET /bases` to list all databases and their tables
- Table IDs are stable and don't change
- Field names work in queries (easier than field IDs)
- Field names are case-sensitive

### Filter Operators
- Linked records MUST use `{"in": ["id"]}` - `{"eq": "id"}` does NOT work
- Multi-select fields use `{"in": ["value1", "value2"]}` to match ANY value

## References

- [Get Databases API Documentation](https://www.fillout.com/help/database/get-databases)
- [Fillout Database Overview](https://www.fillout.com/help/database/overview)
- [Fillout Database API Documentation](https://support.fillout.com/help/database/api) - ⚠️ May contain incorrect examples
- [Field Types Documentation](https://www.fillout.com/help/database/field-types)
- [Import Data Guide](https://www.fillout.com/help/database/import-data)

**Note**: Always verify API formats by testing, as official documentation may be outdated or incorrect. Update this document with new discoveries.


