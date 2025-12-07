# Pay Period Templates Migration - Time Tracking App Guide

**Date:** December 6, 2025  
**Status:** ✅ Database Migration Complete  
**Impact:** Time Tracking App needs to update pay period calculation logic

## Executive Summary

We've migrated from comma-separated text fields to a structured **Pay Period Templates** table. This provides better data integrity, clearer relationships, and easier maintenance. The time tracking app needs to update its pay period calculation logic to use the new templates table instead of parsing comma-separated strings.

**Key Changes:**
- ✅ New `Pay Period Templates` table created (ID: `t7RLTQD7xWd`)
- ✅ All department settings migrated to templates
- ✅ "Last day of month" now uses `"last"` instead of `"1"`
- ✅ Clear period pairing via `period_number` field
- ✅ Explicit `payout_month_offset` for month-spanning periods

**Action Required:**
- Update pay period calculation code to query templates table
- Implement "last" day parsing logic
- Add fallback to legacy fields during transition period

## What Changed

### Before (Legacy Structure)

Pay period settings were stored as comma-separated strings in the Departments table:
- `pay_period_start_days`: `"11, 26"` 
- `pay_period_end_days`: `"10, 25"`
- `payout_days`: `"15, 1"` (where `1` meant "last day of month")

**Problems:**
- Ambiguous pairing (which start pairs with which end?)
- "1" for last day was confusing
- Hard to query and maintain
- No clear relationship structure

### After (New Structure)

Pay period settings are now stored in a dedicated **Pay Period Templates** table:

**Table:** `Pay Period Templates` (ID: `t7RLTQD7xWd`)

**Fields:**
- `department_id` (linked_record → Departments) - Links template to department
- `period_number` (number) - 1, 2, etc. (for ordering periods)
- `start_day` (number) - Day of month (1-31)
- `end_day` (number) - Day of month (1-31)
- `payout_day` (single_line_text) - Day number OR `"last"` for last day of month
- `payout_month_offset` (number) - 0 = same month, 1 = next month
- `is_active` (checkbox) - Enable/disable template

**Example Records:**

| department_id | period_number | start_day | end_day | payout_day | payout_month_offset | is_active |
|---------------|---------------|-----------|---------|------------|---------------------|-----------|
| Software Dev  | 1             | 11        | 25      | last       | 0                   | true      |
| Software Dev  | 2             | 26        | 10      | 15         | 1                   | true      |

## How to Query Templates

### Fillout API Query

```typescript
// Get all active templates for a department
const templates = await queryFillout({
  tableId: 't7RLTQD7xWd', // Pay Period Templates table ID
  filters: {
    department_id: { in: [departmentId] },
    is_active: { equals: true }
  },
  sort: [{ field: 'period_number', direction: 'asc' }]
});
```

### Response Format

```json
{
  "records": [
    {
      "id": "record-id-1",
      "fields": {
        "department_id": ["department-uuid"],
        "period_number": 1,
        "start_day": 11,
        "end_day": 25,
        "payout_day": "last",
        "payout_month_offset": 0,
        "is_active": true
      }
    },
    {
      "id": "record-id-2",
      "fields": {
        "department_id": ["department-uuid"],
        "period_number": 2,
        "start_day": 26,
        "end_day": 10,
        "payout_day": "15",
        "payout_month_offset": 1,
        "is_active": true
      }
    }
  ]
}
```

## Calculating Pay Periods from Templates

### Step 1: Get Templates for Department

```dart
Future<List<PayPeriodTemplate>> getTemplatesForDepartment(String departmentId) async {
  final response = await filloutService.query(
    tableId: 't7RLTQD7xWd',
    filters: {
      'department_id': {'in': [departmentId]},
      'is_active': {'equals': true}
    },
    sort: [{'field': 'period_number', 'direction': 'asc'}]
  );
  
  return response.records.map((record) => PayPeriodTemplate.fromFillout(record)).toList();
}
```

### Step 2: Calculate Pay Period Dates

```dart
class PayPeriodTemplate {
  final int periodNumber;
  final int startDay;
  final int endDay;
  final String payoutDay; // "last" or number string like "15"
  final int payoutMonthOffset; // 0 = same month, 1 = next month
  
  // Calculate the pay period start date for a given date
  DateTime getPayPeriodStart(DateTime date) {
    final year = date.year;
    final month = date.month;
    
    // If end_day < start_day, period spans months
    if (endDay < startDay) {
      // Period spans months (e.g., 26-10)
      // If date is before start_day, period started last month
      if (date.day < startDay) {
        return DateTime(year, month - 1, startDay);
      } else {
        return DateTime(year, month, startDay);
      }
    } else {
      // Period within same month (e.g., 11-25)
      if (date.day < startDay) {
        // Period hasn't started yet this month
        return DateTime(year, month - 1, startDay);
      } else {
        return DateTime(year, month, startDay);
      }
    }
  }
  
  // Calculate the pay period end date
  DateTime getPayPeriodEnd(DateTime date) {
    final start = getPayPeriodStart(date);
    
    if (endDay < startDay) {
      // Period spans months: end is next month
      return DateTime(start.year, start.month + 1, endDay, 23, 59, 59);
    } else {
      // Period within same month
      return DateTime(start.year, start.month, endDay, 23, 59, 59);
    }
  }
  
  // Calculate payout date for a pay period
  DateTime getPayoutDate(DateTime periodEndDate) {
    final payoutMonth = periodEndDate.month + payoutMonthOffset;
    final payoutYear = payoutMonthOffset == 1 && payoutMonth == 1
        ? periodEndDate.year + 1
        : periodEndDate.year;
    
    int payoutDayNumber;
    if (payoutDay == "last" || payoutDay == "L") {
      // Last day of month
      payoutDayNumber = DateTime(payoutYear, payoutMonth + 1, 0).day;
    } else {
      payoutDayNumber = int.parse(payoutDay);
    }
    
    return DateTime(payoutYear, payoutMonth, payoutDayNumber);
  }
  
  // Check if a date falls within this period
  bool containsDate(DateTime date) {
    final start = getPayPeriodStart(date);
    final end = getPayPeriodEnd(date);
    return date.isAfter(start.subtract(Duration(days: 1))) && 
           date.isBefore(end.add(Duration(days: 1)));
  }
}
```

### Step 3: Find Current Pay Period

```dart
PayPeriodTemplate? getCurrentPayPeriod(
  List<PayPeriodTemplate> templates, 
  DateTime date
) {
  for (var template in templates) {
    if (template.containsDate(date)) {
      return template;
    }
  }
  return null;
}
```

### Step 4: Generate Pay Period Dates

```dart
class PayPeriodDates {
  final DateTime startDate;
  final DateTime endDate;
  final DateTime payoutDate;
  
  PayPeriodDates({
    required this.startDate,
    required this.endDate,
    required this.payoutDate,
  });
}

PayPeriodDates? getPayPeriodForDate(
  List<PayPeriodTemplate> templates,
  DateTime date
) {
  final template = getCurrentPayPeriod(templates, date);
  if (template == null) return null;
  
  final start = template.getPayPeriodStart(date);
  final end = template.getPayPeriodEnd(date);
  final payout = template.getPayoutDate(end);
  
  return PayPeriodDates(
    startDate: start,
    endDate: end,
    payoutDate: payout,
  );
}
```

## Handling "Last Day of Month"

The `payout_day` field now uses the text value `"last"` instead of the number `1`.

### Parsing Logic

```dart
int getPayoutDayNumber(String payoutDay, int year, int month) {
  if (payoutDay == "last" || payoutDay == "L") {
    // Calculate last day of month
    return DateTime(year, month + 1, 0).day;
  } else {
    return int.parse(payoutDay);
  }
}
```

### Example Usage

```dart
// Template has payout_day: "last"
final payoutDay = template.payoutDay; // "last"
final payoutDate = getPayoutDayNumber(
  payoutDay, 
  periodEndDate.year, 
  periodEndDate.month + template.payoutMonthOffset
);
// Returns: 30 (for November) or 31 (for December), etc.
```

## Migration Strategy

### Phase 1: Dual Support (Recommended)

Support both old and new structures during transition:

```dart
Future<List<PayPeriodTemplate>> getPayPeriodTemplates(String departmentId) async {
  // Try new templates table first
  try {
    final templates = await getTemplatesForDepartment(departmentId);
    if (templates.isNotEmpty) {
      return templates;
    }
  } catch (e) {
    print('Error fetching templates: $e');
  }
  
  // Fallback to legacy fields
  return await getTemplatesFromLegacyFields(departmentId);
}

Future<List<PayPeriodTemplate>> getTemplatesFromLegacyFields(String departmentId) async {
  final dept = await getDepartment(departmentId);
  
  if (dept.payPeriodStartDays == null || dept.payPeriodEndDays == null) {
    return []; // No configuration
  }
  
  // Handle Bi-Weekly differently (requires anchor date)
  if (dept.payPeriodType == "Bi-Weekly") {
    // Bi-Weekly uses week-based calculation, not day-of-month
    // Requires anchor date from department or separate calculation
    // Return empty and use fallback logic
    return [];
  }
  
  final startDays = dept.payPeriodStartDays!.split(',').map((s) => int.parse(s.trim())).toList();
  final endDays = dept.payPeriodEndDays!.split(',').map((s) => int.parse(s.trim())).toList();
  final payoutDays = dept.payoutDays?.split(',').map((s) => s.trim()).toList() ?? [];
  
  final templates = <PayPeriodTemplate>[];
  
  for (int i = 0; i < startDays.length && i < endDays.length; i++) {
    String payoutDay = payoutDays.length > i ? payoutDays[i] : "15";
    // Convert "1" to "last" for legacy data
    if (payoutDay == "1" || payoutDay == "0") {
      payoutDay = "last";
    }
    
    // Determine month offset
    int payoutMonthOffset = endDays[i] < startDays[i] ? 1 : 0;
    
    templates.add(PayPeriodTemplate(
      periodNumber: i + 1,
      startDay: startDays[i],
      endDay: endDays[i],
      payoutDay: payoutDay,
      payoutMonthOffset: payoutMonthOffset,
    ));
  }
  
  return templates;
}
```

### Phase 2: Full Migration

Once all departments have templates:
1. Remove legacy field parsing code
2. Update error handling to require templates
3. Remove fallback logic

## Field IDs Reference

For direct API calls, use these field IDs:

| Field Name | Field ID |
|------------|----------|
| department_id | `fiunMgBrrC9` |
| period_number | `faiQsBfwJtT` |
| start_day | `fjkdULQiY68` |
| end_day | `f6GFoDwhiuS` |
| payout_day | `fn8tD3dpDnQ` |
| payout_month_offset | `fxzeXzvBGt2` |
| is_active | `f26NBqb2bqj` |

**Note:** These field IDs are also available in the generated config file (`lib/fillout-config.generated.ts`) as constants:
- `PAY_PERIOD_TEMPLATES_DEPARTMENT_ID_FIELD_ID`
- `PAY_PERIOD_TEMPLATES_PERIOD_NUMBER_FIELD_ID`
- `PAY_PERIOD_TEMPLATES_START_DAY_FIELD_ID`
- `PAY_PERIOD_TEMPLATES_END_DAY_FIELD_ID`
- `PAY_PERIOD_TEMPLATES_PAYOUT_DAY_FIELD_ID`
- `PAY_PERIOD_TEMPLATES_PAYOUT_MONTH_OFFSET_FIELD_ID`
- `PAY_PERIOD_TEMPLATES_IS_ACTIVE_FIELD_ID`

## Example: Complete Implementation

```dart
class PayPeriodService {
  final FilloutService filloutService;
  
  PayPeriodService(this.filloutService);
  
  Future<PayPeriodDates?> getCurrentPayPeriod(String departmentId) async {
    final templates = await getTemplatesForDepartment(departmentId);
    if (templates.isEmpty) {
      // Fallback to legacy or default
      return getDefaultPayPeriod();
    }
    
    final now = DateTime.now();
    return getPayPeriodForDate(templates, now);
  }
  
  Future<List<PayPeriodTemplate>> getTemplatesForDepartment(String departmentId) async {
    try {
      final response = await filloutService.query(
        tableId: 't7RLTQD7xWd',
        filters: {
          'department_id': {'in': [departmentId]},
          'is_active': {'equals': true}
        },
        sort: [{'field': 'period_number', 'direction': 'asc'}]
      );
      
      return response.records.map((record) {
        return PayPeriodTemplate(
          periodNumber: record.fields['period_number'] as int,
          startDay: record.fields['start_day'] as int,
          endDay: record.fields['end_day'] as int,
          payoutDay: record.fields['payout_day'] as String,
          payoutMonthOffset: record.fields['payout_month_offset'] as int,
        );
      }).toList();
    } catch (e) {
      print('Error fetching templates: $e');
      return [];
    }
  }
  
  PayPeriodDates? getPayPeriodForDate(
    List<PayPeriodTemplate> templates,
    DateTime date
  ) {
    for (var template in templates) {
      if (template.containsDate(date)) {
        final start = template.getPayPeriodStart(date);
        final end = template.getPayPeriodEnd(date);
        final payout = template.getPayoutDate(end);
        
        return PayPeriodDates(
          startDate: start,
          endDate: end,
          payoutDate: payout,
        );
      }
    }
    return null;
  }
}
```

## Testing Checklist

- [ ] Query templates for a department
- [ ] Handle "last" payout day correctly
- [ ] Calculate pay period dates for month-spanning periods (26-10)
- [ ] Calculate pay period dates for same-month periods (11-25)
- [ ] Handle payout month offset correctly
- [ ] Fallback to legacy fields if templates not available
- [ ] Handle edge cases (month boundaries, leap years)
- [ ] Test with multiple departments
- [ ] Verify period ordering (period_number)
- [ ] Test Monthly pay period type (1 template)
- [ ] Test Bi-Monthly pay period type (2 templates)
- [ ] Test Bi-Weekly pay period type (requires anchor date logic)

## Pay Period Type Reference

The `pay_period_type` field in the Departments table uses standard US nomenclature:

| Type | Frequency | Template Records | Description |
|------|-----------|------------------|-------------|
| **Monthly** | 1x per month | 1 | Single pay period per month (e.g., 1st to last day) |
| **Bi-Monthly** | 2x per month | 2 | Two pay periods per month (e.g., 11th-25th, 26th-10th) |
| **Bi-Weekly** | Every 2 weeks | 1* | Pay periods repeat every 14 days from anchor date |

*Bi-Weekly typically uses 1 template record with week-based calculation logic, requiring an anchor date.

## Benefits of New Structure

1. **Clear Relationships**: Templates are explicitly linked to departments
2. **Queryable**: Can filter, sort, and query templates directly
3. **Maintainable**: Easy to add/edit/remove periods
4. **Scalable**: Supports any number of periods per department
5. **Type Safety**: Structured data instead of parsing strings
6. **"Last Day" Clarity**: Uses `"last"` instead of ambiguous `"1"`
7. **Standard Nomenclature**: Uses US-standard pay period type names

## Quick Reference

### Table & Field IDs

- **Table ID:** `t7RLTQD7xWd` (Pay Period Templates)
- **Department Link Field:** `fiunMgBrrC9` (department_id)
- **Period Number Field:** `faiQsBfwJtT` (period_number)
- **Start Day Field:** `fjkdULQiY68` (start_day)
- **End Day Field:** `f6GFoDwhiuS` (end_day)
- **Payout Day Field:** `fn8tD3dpDnQ` (payout_day)
- **Payout Month Offset Field:** `fxzeXzvBGt2` (payout_month_offset)
- **Is Active Field:** `f26NBqb2bqj` (is_active)

### Common Patterns

**Bi-Monthly (Current Setup - 2x per month):**
- Period 1: Start 11, End 25, Payout "last", Offset 0
- Period 2: Start 26, End 10, Payout "15", Offset 1

**Monthly (1x per month):**
- Period 1: Start 1, End "last", Payout "last", Offset 1

**Bi-Weekly (every two weeks):**
- Requires anchor date (e.g., first pay period start date)
- Period repeats every 14 days from anchor
- Typically 1 template record with week-based calculation logic

**Month-Spanning Period Detection:**
```dart
bool spansMonths = template.endDay < template.startDay;
// If true: period spans from one month to next (e.g., Nov 26 - Dec 10)
// If false: period within same month (e.g., Nov 11 - Nov 25)
```

**Last Day Calculation:**
```dart
if (payoutDay == "last" || payoutDay == "L") {
  final lastDay = DateTime(year, month + 1, 0).day;
  return DateTime(year, month, lastDay);
}
```

## Support

If you encounter issues:
1. Check that templates exist for the department
2. Verify `is_active` is true
3. Ensure `department_id` links are correct
4. Check field IDs match the reference table above
5. Verify templates are sorted by `period_number` ascending

For questions or issues, refer to:
- `docs/PAY_PERIOD_SETTINGS_FILLOUT.md` - Complete technical details and implementation notes
- `docs/PAY_PERIOD_IMPLEMENTATION_COMPLETE.md` - Previous implementation documentation

