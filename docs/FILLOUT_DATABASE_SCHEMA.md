# Fillout Database Schema Design

## Database Information
- **Database ID:** `aa7a307dc0a191a5`
- **Database URL:** `https://build.fillout.com/database/aa7a307dc0a191a5/trwubaBRu4W/v8J1fT1cBsm`
- **API Token:** `sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131`

## Tables Overview

1. **Companies** - Internal companies using the platform
2. **Departments** - Departments within companies
3. **Employees** - Employees belonging to companies and departments
4. **Clients** - External clients that employees track time for
5. **Projects** - Projects belonging to clients
6. **Pay Periods** - Pay period definitions
7. **Time Cards** - Time cards for employees per pay period per client
8. **Punches** - Individual time punch records
9. **Punch Alterations** - Requests to alter punches
10. **Timezones** - Timezone definitions (e.g., "Mountain Time")
11. **Timezone Actual** - Actual timezone implementations with DST (e.g., "Mountain Daylight Time", "Mountain Standard Time")
12. **Client Employee Access** - Many-to-many relationship between Clients and Employees with access dates
13. **Employee Activity** - Employee status history (active, inactive, terminated, etc.)
14. **Client Invoices** - Invoices for clients, with optional labor collection from punches

---

## Table: Companies

**Purpose:** Internal companies using the platform. Allows multi-tenant support.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `name` (Text, Required) - Company name
- `address` (Text, Optional) - Company address
- `contact_info` (Text, Optional) - Contact information
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- One-to-Many → Departments
- One-to-Many → Employees

---

## Table: Departments

**Purpose:** Departments within companies. Each department can configure their own pay period settings.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `company_id` (Relationship → Companies, Required) - Parent company
- `name` (Text, Required) - Department name
- `pay_period_type` (Select, Optional) - Pay period type using US standard nomenclature:
  - **"Monthly"** = 1x per month (1 template record in Pay Period Templates table)
  - **"Bi-Monthly"** = 2x per month (2 template records)
  - **"Bi-Weekly"** = every two weeks (typically 1 template record with week-based calculation)
- `pay_period_start_days` (Text, Optional) - **Legacy field** - Comma-separated start days of month (e.g., "11,26" for bi-monthly)
- `pay_period_end_days` (Text, Optional) - **Legacy field** - Comma-separated end days (e.g., "25,10" where 10 means 10th of next month)
- `payout_days` (Text, Optional) - **Legacy field** - Comma-separated payout days (e.g., "15,1" where 1 means last day of month)
- `pay_period_memo` (Long Text, Optional) - Notes about pay period configuration
- `allow_memo_changes_without_approval` (Boolean, Optional) - Whether employees can change memos without approval
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

**Note:** New code should use the **Pay Period Templates** table instead of parsing the legacy `pay_period_start_days`, `pay_period_end_days`, and `payout_days` fields. The `pay_period_type` field can be used as a quick reference to understand how many templates to expect per department.

### Relationships:
- Many-to-One → Companies (required)
- One-to-Many → Employees

### Notes:
- **Pattern-Based Pay Periods**: Uses comma-separated day numbers that repeat monthly
- **Scalable**: Supports any number of periods per month (1 for monthly, 2 for bi-monthly, 2-3 for bi-weekly)
- **Day Numbers**: Uses day of month (1-31) as the pattern, system calculates periods dynamically
- **End Days**: If end day < start day, it's in the next month (e.g., start 26, end 10 = 26th to 10th of next month)
- **Payout Days**: 0 = last day of month
- **Example Configurations**:
  - Bi-monthly: `pay_period_start_days: "11,26"`, `pay_period_end_days: "25,10"`, `payout_days: "15,0"`
  - Monthly: `pay_period_start_days: "1"`, `pay_period_end_days: "0"`, `payout_days: "0"`
  - Bi-weekly: `pay_period_start_days: "1,15"`, `pay_period_end_days: "14,0"`, `payout_days: "15,0"`
- If pay period fields are not set, the system falls back to default logic (1st-15th, 16th-end)
- These settings are used by the frontend to calculate pay periods dynamically
- Cron functions can use these settings to auto-generate pay period records

---

## Table: Clients

**Purpose:** External clients that employees track time for.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `name` (Text, Required) - Client name
- `contact_info` (Text, Optional) - Contact information
- `is_active` (Boolean, Default: true) - Whether client is active
- `invoice_period_type` (Select, Optional) - Invoice billing period type: "days" or "monthly"
- `invoice_period_days` (Number, Optional) - Number of days for invoice period (only used if `invoice_period_type` is "days")
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- One-to-Many → Projects
- One-to-Many → Client Invoices
- Many-to-Many → Employees (via Client Employee Access)

### Notes:
- If `invoice_period_type` is "days", `invoice_period_days` should be set (e.g., 30 for monthly, 7 for weekly)
- If `invoice_period_type` is "monthly", invoices are generated monthly regardless of `invoice_period_days`

---

## Table: Projects

**Purpose:** Projects belonging to clients.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `client_id` (Relationship → Clients, Required) - Parent client
- `name` (Text, Required) - Project name
- `is_active` (Boolean, Default: true) - Whether project is active
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Clients (required)
- Many-to-Many → Punches (via relationship field)

---

## Table: Employees

**Purpose:** Employees belonging to companies and departments.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `company_id` (Relationship → Companies, Required) - Employee's company
- `department_id` (Relationship → Departments, Required) - Employee's department
- `name` (Text, Required) - Employee full name
- `email` (Email, Required, Unique) - Employee email address
- `photo_url` (File or URL, Optional) - Employee photo
- `pay_rate` (Number/Decimal, Required) - Hourly pay rate
- `employment_type` (Select, Required) - Options: "w2", "contract1099"
- `timezone_id` (Relationship → Timezones, Required) - Employee's timezone preference
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Companies (required)
- Many-to-One → Departments (required)
- Many-to-One → Timezones (required)
- One-to-Many → Time Cards
- One-to-Many → Punches
- One-to-Many → Employee Activity
- Many-to-Many → Clients (via Client Employee Access)

---

## Table: Pay Periods

**Purpose:** Pay period definitions with start, end, and payout dates.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `start_date` (Date, Required) - Period start date
- `end_date` (Date, Required) - Period end date
- `payout_date` (Date, Required) - Date when employees are paid
- `period_type` (Select, Required) - Options: "bi-weekly", "bi-monthly", "monthly"
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- One-to-Many → Time Cards

---

## Table: Time Cards

**Purpose:** Time cards generated for each employee per pay period per client.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `employee_id` (Relationship → Employees, Required) - Employee
- `pay_period_id` (Relationship → Pay Periods, Required) - Pay period
- `client_id` (Relationship → Clients, Required) - Client
- `total_hours` (Number/Decimal, Optional) - Total hours (can be calculated)
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Employees (required)
- Many-to-One → Pay Periods (required)
- Many-to-One → Clients (required)
- One-to-Many → Punches

---

## Table: Punches

**Purpose:** Individual time punch records (punch in/out).

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `employee_id` (Relationship → Employees, Required) - Employee who punched
- `client_id` (Relationship → Clients, Required) - Client for this punch
- `project_ids` (Relationship → Projects, Multiple, Required) - Projects worked on (can select multiple)
- `time_card_id` (Relationship → Time Cards, Optional) - Associated time card
- `invoice_id` (Relationship → Client Invoices, Optional) - Associated invoice (if invoice collects labor)
- `punch_in_time` (DateTime, Required) - Punch in time (stored in UTC)
- `punch_out_time` (DateTime, Optional) - Punch out time (stored in UTC, null if active)
- `memo` (Long Text/Rich Text, Optional) - Notes about the punch
- `timezone_actual_id` (Relationship → Timezone Actual, Required) - Timezone Actual at punch in time (determined from user's timezone selection)
- `punch_out_timezone_actual_id` (Relationship → Timezone Actual, Optional) - Timezone Actual at punch out time (if different)
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Employees (required)
- Many-to-One → Clients (required)
- Many-to-Many → Projects (multiple selection, required)
- Many-to-One → Time Cards (optional)
- Many-to-One → Client Invoices (optional)
- Many-to-One → Timezone Actual (required, for punch in)
- Many-to-One → Timezone Actual (optional, for punch out)
- One-to-Many → Punch Alterations

### Notes:
- `timezone_actual_id` is determined from the user's timezone selection (stored in TimezoneProvider) and the current date/time to account for DST
- The app uses `getTimezoneActualId()` helper function to find the correct Timezone Actual record based on IANA name and DST status

### Notes:
- `invoice_id` is automatically set when punching in if:
  - Client has invoice period settings configured
  - An active invoice exists with `collect_labor = true` and the punch falls within the invoice period
  - Or a new invoice is created if the previous invoice period has ended

### Notes:
- Status can be calculated: if `punch_out_time` is null, status is "active", otherwise "completed"

---

## Table: Punch Alterations

**Purpose:** Requests to alter punches (change time, projects, memo, etc.).

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `punch_id` (Relationship → Punches, Required) - Punch being altered
- `requested_at` (DateTime, Required) - When alteration was requested
- `new_punch_in_time` (DateTime, Optional) - Proposed new punch in time
- `new_punch_out_time` (DateTime, Optional) - Proposed new punch out time
- `new_project_ids` (Relationship → Projects, Multiple, Optional) - Proposed new projects (overwrites punch projects)
- `new_memo` (Long Text/Rich Text, Optional) - Proposed new memo
- `reason` (Text, Optional) - Reason for alteration request
- `status` (Select, Required, Default: "pending") - Options: "pending", "approved", "rejected"
- `reviewed_at` (DateTime, Optional) - When alteration was reviewed
- `review_notes` (Text, Optional) - Notes from reviewer
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Punches (required)
- Many-to-Many → Projects (multiple selection, optional, overwrites punch projects)

### Notes:
- Employee is derived from the related punch
- Reviewed by will be managed in admin software (not stored here)

---

## Table: Timezones

**Purpose:** Timezone definitions (e.g., "Mountain Time", "Eastern Time").

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `name` (Text, Required) - Display name (e.g., "Mountain Time")
- `iana_name` (Text, Optional) - IANA timezone name (e.g., "America/Denver")
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- One-to-Many → Timezone Actual
- One-to-Many → Employees
- One-to-Many → Punches (punch in)
- One-to-Many → Punches (punch out)

---

## Table: Timezone Actual

**Purpose:** Actual timezone implementations with DST (e.g., "Mountain Daylight Time", "Mountain Standard Time").

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `timezone_id` (Relationship → Timezones, Required) - Parent timezone
- `name` (Text, Required) - Display name (e.g., "Mountain Daylight Time")
- `iana_name` (Text, Optional) - IANA timezone name
- `offset_hours` (Number, Required) - UTC offset in hours (e.g., -6, -7)
- `is_dst` (Boolean, Required) - Whether this is daylight saving time
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Timezones (required)

### Notes:
- Each Timezone should have at least 2 Timezone Actual records: one for DST and one for standard time

---

## Table: Client Employee Access

**Purpose:** Many-to-many relationship between Clients and Employees with access dates.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `client_id` (Relationship → Clients, Required) - Client
- `employee_id` (Relationship → Employees, Required) - Employee
- `start_date` (Date, Required) - When access started
- `end_date` (Date, Optional) - When access ended (null means still active)
- `is_favorite` (Checkbox/Boolean, Optional, Default: false) - Whether this client is favorited by the employee
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Clients (required)
- Many-to-One → Employees (required)

### Notes:
- Controls which client cards are visible in the app
- If `end_date` is null, access is still active
- **Uniqueness**: There should only be one active record (end_date is null) per (employee_id, client_id) pair
- **Favorites**: The `is_favorite` field allows employees to mark frequently-used clients for quick access

---

## Table: Employee Activity

**Purpose:** Employee status history (active, inactive, terminated, etc.).

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `employee_id` (Relationship → Employees, Required) - Employee
- `status` (Select, Required) - Options: "active", "inactive", "terminated", "leave", etc.
- `start_date` (Date, Required) - When status started
- `end_date` (Date, Optional) - When status ended (null means status is still in effect)
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Employees (required)

### Notes:
- If `end_date` is null, the status is still in effect
- App only checks if current status is "active" to grant access
- Multiple records can exist for the same employee (history)

---

## Table: Client Invoices

**Purpose:** Invoices generated for clients, which may collect labor from punches or be one-off invoices.

### Fields:
- `id` (Auto-increment/ID) - Primary Key
- `client_id` (Relationship → Clients, Required) - Client this invoice is for
- `start_date` (Date, Optional) - Invoice period start date
- `end_date` (Date, Optional) - Invoice period end date
- `invoice_date` (Date, Optional) - Date the invoice was created/issued
- `collect_labor` (Boolean, Default: false) - Whether this invoice should collect labor from punches
- `total_amount` (Number/Decimal, Optional) - Total invoice amount
- `notes` (Long Text/Rich Text, Optional) - Additional notes or description
- `created_at` (DateTime, Auto) - Creation timestamp
- `updated_at` (DateTime, Auto) - Last update timestamp

### Relationships:
- Many-to-One → Clients (required)

### Notes:
- If `collect_labor` is true, the invoice should include labor hours from punches within the `start_date` and `end_date` range
- If `collect_labor` is false, the invoice is a one-off invoice (e.g., for materials, services, etc.)
- Invoice period dates (`start_date`, `end_date`) are typically set based on the client's `invoice_period_type` and `invoice_period_days` settings

---

## Relationship Summary

### One-to-Many Relationships:
- Companies → Departments
- Companies → Employees
- Departments → Employees
- Clients → Projects
- Clients → Time Cards
- Clients → Client Invoices
- Pay Periods → Time Cards
- Employees → Time Cards
- Employees → Punches
- Employees → Employee Activity
- Time Cards → Punches
- Punches → Punch Alterations
- Timezones → Timezone Actual
- Timezones → Employees
- Timezones → Punches (punch in)
- Timezones → Punches (punch out)

### Many-to-Many Relationships:
- Clients ↔ Employees (via Client Employee Access)
- Projects ↔ Punches (via relationship field with multiple selection)
- Projects ↔ Punch Alterations (via relationship field with multiple selection)

---

## Field Type Mappings

- **Text**: Single-line text
- **Long Text/Rich Text**: Multi-line text with formatting
- **Email**: Email addresses
- **Number/Decimal**: Numeric values (for pay_rate, total_hours, offset_hours)
- **Boolean**: True/false values
- **Date**: Date only (no time)
- **DateTime**: Date and time
- **Select**: Dropdown with predefined options
- **Relationship**: Links to other tables
- **File/URL**: File attachments or URLs

---

## Status Field Options

### Employment Type (Employees):
- `w2`
- `contract1099`

### Period Type (Pay Periods and Departments):
- **"Bi-Weekly"** = every two weeks (typically requires anchor date)
- **"Bi-Monthly"** = 2x per month (US standard nomenclature)
- **"Monthly"** = 1x per month (US standard nomenclature)

### Pay Period Pattern Fields (Departments):
- `pay_period_start_days`: Comma-separated day numbers (e.g., "11,26")
- `pay_period_end_days`: Comma-separated day numbers (e.g., "25,10")
- `payout_days`: Comma-separated day numbers (e.g., "15,0")
- Day numbers: 1-31 (day of month), 0 = last day of month
- Arrays must have same length (one entry per period)
- Pattern repeats every month

### Alteration Status (Punch Alterations):
- `pending`
- `approved`
- `rejected`

### Employee Activity Status:
- `active`
- `inactive`
- `terminated`
- `leave`
- (Add more as needed)

---

## Next Steps

1. Create all fields for each table using the Fillout API
2. Set up all relationships between tables
3. Create initial data (timezones, etc.)
4. Test the schema with sample data
5. Update the Flutter app to use the Fillout API instead of mock data

