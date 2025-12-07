# Pay Rate History Table Schema

## Table: Employee Pay Rate History

**Purpose:** Track historical changes to employee pay rates with start and end dates.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `employee_id` (Relationship → Employees, Required) - Employee
- `pay_rate` (Number/Decimal, Required) - Hourly pay rate for this period
- `start_date` (Date, Required) - When this pay rate became effective
- `end_date` (Date, Optional) - When this pay rate ended (null means still active)
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Employees (required)

### Notes:
- If `end_date` is null, the pay rate is still active
- When a new pay rate is set:
  1. Find the previous active pay rate record (end_date is null)
  2. Set its end_date to the start_date of the new rate
  3. Create a new pay rate history record with the new rate and start_date
  4. Update the employee's pay_rate field
- Multiple records can exist for the same employee (history)
- The current pay rate is stored in both the Employees table (pay_rate) and the most recent Pay Rate History record

### Table ID:
- To be created in Fillout dashboard
- Add to TABLE_IDS.md once created
