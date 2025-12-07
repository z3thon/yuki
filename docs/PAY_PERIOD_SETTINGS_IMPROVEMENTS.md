# Pay Period Settings Data Structure Improvements

## Current Structure Issues

The current structure uses:
- `pay_period_start_days`: "11, 26" (comma-separated days)
- `pay_period_end_days`: "10, 25" (comma-separated days)
- `payout_days`: "15, 1" (comma-separated days, where "1" means "last day of month")

**Problems:**
1. Ambiguous pairing: Which start day pairs with which end day?
2. "1" for last day of month is confusing and error-prone
3. Hard to understand the logic programmatically
4. Doesn't clearly show the relationship between periods

## Suggested Improved Structure

### Option 1: Structured JSON Field (Recommended)

Store pay period configuration as a structured JSON field:

```json
{
  "pay_period_config": {
    "type": "twice_per_month", // "monthly", "twice_per_month", "biweekly"
    "periods": [
      {
        "start_day": 11,
        "end_day": 25,
        "payout_day": "last", // or specific day like 15
        "payout_month_offset": 0 // 0 = same month, 1 = next month
      },
      {
        "start_day": 26,
        "end_day": 10,
        "payout_day": 15,
        "payout_month_offset": 1 // Next month
      }
    ]
  }
}
```

**For "last day of month":**
- Use `"payout_day": "last"` or `"payout_day": "L"` (like cron syntax)
- Or use `"payout_day": -1` (negative number convention)

### Option 2: Separate Fields with Clear Pairing

Keep separate fields but make pairing explicit:

```
pay_period_type: "twice_per_month"

period_1_start_day: 11
period_1_end_day: 25
period_1_payout_day: "last" (or -1)
period_1_payout_month: "current" (or "next")

period_2_start_day: 26
period_2_end_day: 10
period_2_payout_day: 15
period_2_payout_month: "next"
```

### Option 3: Array of Period Objects (Fillout-friendly)

Since Fillout supports linked records, create a "Pay Period Templates" table:

**Pay Period Templates Table:**
- `department_id` (linked to Departments)
- `period_number` (1 or 2)
- `start_day` (number)
- `end_day` (number)
- `payout_day` (number or "last"/-1)
- `payout_month_offset` (0 or 1)

Then link multiple templates to each department.

## Recommended: Option 1 with JSON

**Advantages:**
- Single field to manage
- Clear structure and relationships
- Easy to validate
- Flexible for different pay period types
- Can store additional metadata

**Implementation:**
- Store as a JSON string in a long_text field, or
- Use Fillout's JSON field type if available

**Example for your use case:**

```json
{
  "type": "twice_per_month",
  "periods": [
    {
      "start_day": 11,
      "end_day": 25,
      "payout_day": "last",
      "payout_month_offset": 0
    },
    {
      "start_day": 26,
      "end_day": 10,
      "payout_day": 15,
      "payout_month_offset": 1
    }
  ]
}
```

**For monthly:**
```json
{
  "type": "monthly",
  "periods": [
    {
      "start_day": 1,
      "end_day": "last",
      "payout_day": 5,
      "payout_month_offset": 1
    }
  ]
}
```

**For biweekly:**
```json
{
  "type": "biweekly",
  "periods": [
    {
      "start_day": "monday", // or specific date calculation
      "end_day": "sunday",
      "payout_day": 5,
      "payout_month_offset": 0
    }
  ],
  "start_date": "2025-01-06" // Anchor date for biweekly calculation
}
```

## Handling "Last Day of Month"

### Option A: Special String Value
- Use `"last"` or `"L"` in the payout_day field
- Parse: `if (payoutDay === "last" || payoutDay === "L") { day = getLastDayOfMonth(month) }`

### Option B: Negative Number Convention
- Use `-1` to mean "last day"
- Parse: `if (payoutDay < 0) { day = getLastDayOfMonth(month) + payoutDay + 1 }`
- Allows `-1` = last day, `-2` = second to last, etc.

### Option C: Separate Boolean Flag
- Add `payout_is_last_day_of_month: true/false`
- If true, ignore `payout_day` and use last day

**Recommendation: Option A (`"last"`)** - Most readable and clear.

## Migration Path

1. Keep existing fields for backward compatibility
2. Add new `pay_period_config` JSON field
3. Create migration script to convert old format to new format
4. Update UI to use new structure
5. Eventually deprecate old fields

## Example Calculation Logic

```typescript
function calculatePayoutDate(period: PeriodConfig, periodStartDate: Date): Date {
  const payoutMonth = new Date(periodStartDate);
  payoutMonth.setMonth(payoutMonth.getMonth() + period.payout_month_offset);
  
  let payoutDay: number;
  if (period.payout_day === "last" || period.payout_day === "L") {
    // Get last day of month
    payoutDay = new Date(payoutMonth.getFullYear(), payoutMonth.getMonth() + 1, 0).getDate();
  } else {
    payoutDay = period.payout_day;
  }
  
  return new Date(payoutMonth.getFullYear(), payoutMonth.getMonth(), payoutDay);
}
```

