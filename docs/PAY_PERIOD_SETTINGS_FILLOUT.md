# Pay Period Settings Structure for Fillout DB

## ✅ IMPLEMENTED: Linked Table Approach

We have implemented the **Pay Period Templates** table linked to Departments. This is the most Fillout-native approach and has been successfully created and populated.

**Table ID:** `t7RLTQD7xWd`  
**Table Name:** Pay Period Templates

## Fillout Constraints

Fillout supports:
- ✅ Single line text
- ✅ Long text (for JSON strings)
- ✅ Number
- ✅ Date
- ✅ Single select / Multi select
- ✅ Linked records (relationships)
- ✅ Checkbox
- ❌ No native JSON field type
- ❌ No native array/object fields

## Implemented Solution: Linked Table Approach

We created a **"Pay Period Templates"** table linked to Departments. This is the most Fillout-native approach and is now in use.

### Pay Period Templates Table (IMPLEMENTED)

**Table ID:** `t7RLTQD7xWd`

**Fields:**
- `department_id` (linked_record → Departments, field ID: `fiunMgBrrC9`) - Which department this template belongs to
- `period_number` (number, field ID: `faiQsBfwJtT`) - 1 or 2 (for twice-per-month)
- `start_day` (number, field ID: `fjkdULQiY68`) - Day of month (1-31)
- `end_day` (number, field ID: `f6GFoDwhiuS`) - Day of month (1-31)
- `payout_day` (single_line_text, field ID: `fn8tD3dpDnQ`) - Day number OR "last" for last day of month
- `payout_month_offset` (number, field ID: `fxzeXzvBGt2`) - 0 = same month, 1 = next month
- `is_active` (checkbox, field ID: `f26NBqb2bqj`) - Enable/disable this template

**Example Records (from actual migration):**

| department_id | period_number | start_day | end_day | payout_day | payout_month_offset | is_active |
|---------------|---------------|-----------|---------|------------|---------------------|-----------|
| Software Dev  | 1             | 11        | 25      | last       | 0                   | true      |
| Software Dev  | 2             | 26        | 10      | 15         | 1                   | true      |

**Migration Status:** ✅ Complete - All existing department settings have been migrated to templates.

**Advantages:**
- ✅ Native Fillout structure (uses linked records)
- ✅ Queryable and filterable
- ✅ Easy to add/remove periods
- ✅ Can have multiple templates per department
- ✅ Clear relationships
- ✅ Supports "last" as text value

**Query Example:**
```typescript
// Get all templates for a department
const templates = await queryFillout({
  tableId: PAY_PERIOD_TEMPLATES_TABLE_ID,
  filters: { department_id: { in: [departmentId] } },
  sort: [{ field: 'period_number', direction: 'asc' }]
});
```

## Implementation Details

### Migration Script

The migration script (`scripts/create-pay-period-templates-table.py`) was used to:
1. Create the Pay Period Templates table
2. Migrate existing department settings to the new structure
3. Convert "1" payout day values to "last" for clarity

### Current Status

- ✅ Table created: `t7RLTQD7xWd`
- ✅ All fields added and configured
- ✅ Existing department data migrated
- ✅ "Last day of month" stored as "last" text value

### Legacy Fields

The original fields in the Departments table are kept for backward compatibility:
- `pay_period_type` - Still used for display
- `pay_period_start_days` - Kept for reference
- `pay_period_end_days` - Kept for reference  
- `payout_days` - Kept for reference

**Note:** New code should use the Pay Period Templates table instead of parsing these legacy fields.

## Implementation for "Last Day of Month" (IMPLEMENTED)

### In Pay Period Templates Table:

**✅ IMPLEMENTED: Text Value Approach**
- `payout_day` field type: **single_line_text**
- Store `"last"` for last day of month
- Store numbers like `"15"` for specific days
- Parse: `if (payoutDay === "last" || payoutDay === "L") { /* calculate last day */ }`

**Migration:** All existing "1" values (which meant "last day") have been converted to "last" during migration.

## Example Code for "Last Day"

```typescript
function getPayoutDay(
  payoutDayValue: string | number, 
  month: number, 
  year: number
): number {
  // Handle text "last" or "L"
  if (payoutDayValue === "last" || payoutDayValue === "L") {
    return new Date(year, month + 1, 0).getDate(); // Last day of month
  }
  
  // Handle number
  const day = typeof payoutDayValue === 'string' 
    ? parseInt(payoutDayValue, 10) 
    : payoutDayValue;
  
  // Handle -1 convention
  if (day === -1) {
    return new Date(year, month + 1, 0).getDate();
  }
  
  return day;
}
```

## Migration Status

✅ **Phase 1**: Pay Period Templates table created (`t7RLTQD7xWd`)  
✅ **Phase 2**: Migration script executed - all department settings migrated  
✅ **Phase 3**: Table ID added to `lib/fillout-table-ids.ts`  
⏳ **Phase 4**: Update code to use templates table (next step)  
⏳ **Phase 5**: Legacy fields kept for backward compatibility

### Migration Results

Successfully migrated 1 department with 2 pay period templates:

**Department: Software Development**
- **Template 1**: Start 11, End 25, Payout "last", Month offset 0
- **Template 2**: Start 26, End 10, Payout "15", Month offset 1

### Next Steps

1. ✅ ~~Add Pay Period Templates table ID to `lib/fillout-table-ids.ts`~~ - **DONE**
2. Update pay period calculation code to use templates instead of parsing legacy fields
3. Update UI to allow editing templates
4. Eventually deprecate legacy fields once all code uses templates

## Example Template Records

### Bi-Monthly (Current Setup - 2x per month)
```
Department: Engineering
pay_period_type: "Bi-Monthly"

Template 1:
  - period_number: 1
  - start_day: 11
  - end_day: 25
  - payout_day: "last"
  - payout_month_offset: 0

Template 2:
  - period_number: 2
  - start_day: 26
  - end_day: 10
  - payout_day: "15"
  - payout_month_offset: 1
```

### Monthly (1x per month)
```
Department: Sales
pay_period_type: "Monthly"

Template 1:
  - period_number: 1
  - start_day: 1
  - end_day: 31 (or use "last" calculation)
  - payout_day: 5
  - payout_month_offset: 1
```

### Bi-Weekly (every two weeks)
```
Department: Operations
pay_period_type: "Bi-Weekly"

Template 1:
  - period_number: 1
  - start_day: [anchor date needed - e.g., first Monday of pay cycle]
  - end_day: [14 days after start_day]
  - payout_day: 5
  - payout_month_offset: 0

Note: Bi-Weekly requires an anchor date stored in the Department table 
or calculated from a known start date. Periods repeat every 14 days.
```

**Pay Period Type Reference:**
- **Monthly** = 1x per month (1 template record)
- **Bi-Monthly** = 2x per month (2 template records)
- **Bi-Weekly** = every two weeks (typically 1 template record with week-based calculation)

