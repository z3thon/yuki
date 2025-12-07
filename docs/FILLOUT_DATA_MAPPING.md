# Fillout Database to App Data Mapping

## Overview

This document maps the Flutter app's data models to Fillout database tables and fields, ensuring efficient queries and fast page loads.

## Table Mappings

### Employee Model → Employees Table

| App Field | Fillout Field | Type | Notes |
|-----------|---------------|------|-------|
| `id` | `id` | ID | Primary key |
| `name` | `Name` | single_line_text | Primary field |
| `email` | `email` | email | Unique identifier |
| `photoUrl` | `photo_url` | url | Optional |
| `payRate` | `pay_rate` | number | Decimal |
| `employmentType` | `employment_type` | single_select | "w2" or "contract1099" |
| `clientIds` | **Client Employee Access** | linked_record[] | Many-to-many via junction table |
| `companyId` | `company_id` | linked_record | Not in model, but available |
| `departmentId` | `department_id` | linked_record | Not in model, but available |
| `timezoneId` | `timezone_id` | linked_record | Not in model, but available |

**Query Strategy:**
- Cache employee data (rarely changes)
- Fetch `clientIds` from Client Employee Access table where `employee_id` matches and `end_date` is null
- Single query with relationship expansion

---

### Client Model → Clients Table

| App Field | Fillout Field | Type | Notes |
|-----------|---------------|------|-------|
| `id` | `id` | ID | Primary key |
| `name` | `Name` | single_line_text | Primary field |
| `isActive` | `is_active` | checkbox | Filter inactive clients |
| `projectIds` | **Projects** | linked_record[] | Via `client_id` relationship |
| `invoicePeriodType` | `invoice_period_type` | single_select | "days" or "monthly" |
| `invoicePeriodDays` | `invoice_period_days` | number | Number of days (only used if type is "days") |
| `contactInfo` | `contact_info` | single_line_text | Not in model, but available |

**Query Strategy:**
- Filter by `is_active = true`
- Expand Projects relationship in single query
- Cache per employee (based on Client Employee Access)

---

### Project Model → Projects Table

| App Field | Fillout Field | Type | Notes |
|-----------|---------------|------|-------|
| `id` | `id` | ID | Primary key |
| `name` | `Name` | single_line_text | Primary field |
| `clientId` | `client_id` | linked_record | Required relationship |
| `isActive` | `is_active` | checkbox | Filter inactive projects |

**Query Strategy:**
- Filter by `client_id` and `is_active = true`
- Cache per client
- Load with Clients query (relationship expansion)

---

### TimePunch Model → Punches Table

| App Field | Fillout Field | Type | Notes |
|-----------|---------------|------|-------|
| `id` | `id` | ID | Primary key |
| `employeeId` | `employee_id` | linked_record | Required |
| `clientId` | `client_id` | linked_record | Required |
| `projectIds` | `project_ids` | linked_record[] | Many-to-many, multiple selection |
| `punchInTime` | `punch_in_time` | datetime | UTC stored |
| `punchOutTime` | `punch_out_time` | datetime | UTC, null if active |
| `memo` | `memo` | long_text | Optional |
| `status` | **Calculated** | - | `active` if `punch_out_time` is null, else `completed` |
| `alterationId` | **Punch Alteration Requests** | linked_record | Optional, via relationship |
| `timeCardId` | `time_card_id` | linked_record | Optional |
| `timezoneId` | `timezone_id` | linked_record | Timezone at punch in |
| `punchOutTimezoneId` | `punch_out_timezone_id` | linked_record | Optional, if different |

**Query Strategy:**
- Filter by `employee_id` for user's punches
- Sort by `punch_in_time DESC` for recent first
- Expand relationships: `client_id`, `project_ids`, `timezone_id`
- Paginate for large lists (e.g., 50 per page)
- Cache active punch separately (frequent check)

**Status Calculation:**
```dart
PunchStatus status = punchOutTime == null ? PunchStatus.active : PunchStatus.completed;
```

---

### PunchAlteration Model → Punch Alteration Requests Table

| App Field | Fillout Field | Type | Notes |
|-----------|---------------|------|-------|
| `id` | `id` | ID | Primary key |
| `punchId` | `punch_id` | linked_record | Required |
| `employeeId` | **Derived** | - | From `punch_id.employee_id` |
| `requestedAt` | `requested_at` | datetime | UTC |
| `newPunchInTime` | `new_punch_in_time` | datetime | Optional |
| `newPunchOutTime` | `new_punch_out_time` | datetime | Optional |
| `newProjectIds` | `new_project_ids` | linked_record[] | Optional, overwrites punch projects |
| `newMemo` | `new_memo` | long_text | Optional |
| `reason` | `reason` | single_line_text | Optional |
| `status` | `status` | single_select | "pending", "approved", "rejected" |
| `reviewedAt` | `reviewed_at` | datetime | Optional |
| `reviewNotes` | `review_notes` | single_line_text | Optional |
| `reviewedBy` | **Not stored** | - | Managed in admin app |

**Query Strategy:**
- Filter by `punch_id.employee_id` for user's alterations
- Filter by `status = "pending"` for pending count
- Expand `punch_id` relationship to get full punch data

---

### Invoice Model → Client Invoices Table

| App Field | Fillout Field | Type | Notes |
|-----------|---------------|------|-------|
| `id` | `id` | ID | Primary key |
| `clientId` | `client_id` | linked_record | Required relationship |
| `startDate` | `start_date` | date | Invoice period start date |
| `endDate` | `end_date` | date | Invoice period end date |
| `invoiceDate` | `invoice_date` | date | Date invoice was created/issued |
| `collectLabor` | `collect_labor` | checkbox | Whether to collect labor from punches |
| `totalAmount` | `total_amount` | number | Total invoice amount |
| `notes` | `notes` | long_text | Optional notes/description |
| `createdAt` | `created_at` | datetime | Auto-generated |
| `updatedAt` | `updated_at` | datetime | Auto-generated |

**Query Strategy:**
- Filter by `client_id` to get invoices for a specific client
- Filter by `collect_labor = true` to find invoices that need labor collection
- Use `start_date` and `end_date` to match punches for labor collection
- Sort by `invoice_date DESC` for recent invoices first

---

## Query Patterns

### 1. Get Current Employee
**Purpose:** Load employee data for settings, dashboard
**Tables:** Employees
**Query:** Single record by ID
**Cache:** Yes (until logout)

### 2. Get Employee's Clients
**Purpose:** Show client list for punch in/out
**Tables:** Client Employee Access, Clients, Projects
**Query:** 
- Filter Client Employee Access by `employee_id` and `end_date IS NULL`
- Expand `client_id` relationship
- Expand Projects via `client_id`
**Cache:** Yes (refresh on pull-to-refresh)

### 3. Get Active Punch
**Purpose:** Show timer, punch out button
**Tables:** Punches
**Query:** 
- Filter by `employee_id` and `punch_out_time IS NULL`
- Limit 1
- Expand `client_id`, `project_ids`, `timezone_id`
**Cache:** No (check frequently, real-time updates)

### 4. Get Daily Hours
**Purpose:** Dashboard display
**Tables:** Punches
**Query:**
- Filter by `employee_id` and `punch_in_time` within today (timezone-aware)
- Calculate sum of durations
**Cache:** No (calculate on-demand)

### 5. Get Punches History
**Purpose:** Punches screen, time history
**Tables:** Punches, Clients, Projects
**Query:**
- Filter by `employee_id`
- Sort by `punch_in_time DESC`
- Paginate (50 per page)
- Expand `client_id`, `project_ids`
**Cache:** Yes (per page, refresh on pull-to-refresh)

### 6. Get Pay Period Hours
**Purpose:** Stats screen
**Tables:** Punches, Pay Periods
**Query:**
- Filter Punches by `employee_id` and `punch_in_time` within pay period dates
- Calculate sum of durations
**Cache:** No (calculate on-demand)

### 7. Get Pending Alterations Count
**Purpose:** Badge on punches screen
**Tables:** Punch Alteration Requests
**Query:**
- Filter by `punch_id.employee_id` and `status = "pending"`
- Count only
**Cache:** Yes (refresh on screen focus)

### 8. Get Pay Periods
**Purpose:** Paychecks list screen
**Tables:** Pay Periods
**Query:**
- Sort by `start_date DESC`
- Limit to last 24 periods (12 months bi-weekly)
**Cache:** Yes (rarely changes)

### 9. Get Time Cards
**Purpose:** Pay period details
**Tables:** Time Cards, Pay Periods, Clients
**Query:**
- Filter by `employee_id` and `pay_period_id`
- Expand `client_id`, `pay_period_id`
**Cache:** Yes (per pay period)

---

## Efficient Query Strategies

### 1. Relationship Expansion
Fillout supports expanding relationships in queries. Always expand:
- `client_id` → Client name
- `project_ids` → Project names
- `employee_id` → Employee name (when needed)
- `timezone_id` → Timezone name

### 2. Field Selection
Only request fields needed for the screen:
- List views: ID, name, key fields only
- Detail views: All fields

### 3. Filtering
- Always filter by `employee_id` first (most selective)
- Use date ranges for time-based queries
- Filter inactive records (`is_active = true`)

### 4. Pagination
- Use limit/offset for large lists
- Default: 50 records per page
- Load more on scroll

### 5. Caching Strategy
**Cache These:**
- Employee data (until logout)
- Client list (refresh on pull-to-refresh)
- Projects per client (refresh on pull-to-refresh)
- Pay periods (refresh daily)
- Punches history pages (refresh on pull-to-refresh)

**Don't Cache:**
- Active punch (check frequently)
- Daily hours (calculate on-demand)
- Pay period hours (calculate on-demand)

### 6. Batch Queries
When possible, combine related queries:
- Get employee + clients + projects in one request
- Get punches + related clients/projects in one request

---

## API Endpoint Structure

Base URL: `https://tables.fillout.com/api/v1/bases/{baseId}`

### Table IDs
- Companies: `tbjujz4iq6r`
- Departments: `tviEhSR8rfg`
- Employees: `tcNK2zZPcAR`
- Employee Activity: `t2JqUmLFqfA`
- Clients: `te3Gw8PDkS7`
- Client Employee Access: `tt5JxJuYHSQ`
- Projects: `t9gBZ2DumZM`
- Pay Periods: `tk8fyCDXQ8H`
- Time Cards: `t4F8J8DfSSN`
- Punches: `t3uPEDXn9wt`
- Punch Alteration Requests: `t5x39cZnrdK`
- Timezones: `tbrgcTzKeZU`
- Timezones Actual: `tpgwfCYh9PH`

### Query Examples

**Get Employee with Clients:**
```
GET /bases/{baseId}/tables/{employeesTableId}/records/{employeeId}
?expand[]=company_id
&expand[]=department_id
&expand[]=timezone_id
```

**Get Employee's Clients:**
```
GET /bases/{baseId}/tables/{clientEmployeeAccessTableId}/records
?filterByFormula={employee_id} = '{employeeId}'
&filterByFormula={end_date} = BLANK()
&expand[]=client_id
&expand[]=client_id.Projects
```

**Get Active Punch:**
```
GET /bases/{baseId}/tables/{punchesTableId}/records
?filterByFormula=AND({employee_id} = '{employeeId}', {punch_out_time} = BLANK())
&maxRecords=1
&expand[]=client_id
&expand[]=project_ids
&expand[]=timezone_id
```

**Get Punches (Paginated):**
```
GET /bases/{baseId}/tables/{punchesTableId}/records
?filterByFormula={employee_id} = '{employeeId}'
&sort[0][field]=punch_in_time
&sort[0][direction]=desc
&pageSize=50
&offset=0
&expand[]=client_id
&expand[]=project_ids
```

---

## Data Transformation

### Fillout → App Models

**Employee:**
```dart
Employee.fromFillout(Map<String, dynamic> data) {
  id = data['id'];
  name = data['fields']['Name'];
  email = data['fields']['email'];
  photoUrl = data['fields']['photo_url'];
  payRate = data['fields']['pay_rate']?.toDouble() ?? 0.0;
  employmentType = data['fields']['employment_type'] == 'w2' 
    ? EmploymentType.w2 
    : EmploymentType.contract1099;
  // clientIds loaded separately from Client Employee Access
}
```

**TimePunch:**
```dart
TimePunch.fromFillout(Map<String, dynamic> data) {
  id = data['id'];
  employeeId = data['fields']['employee_id'][0]; // linked_record returns array
  clientId = data['fields']['client_id'][0];
  projectIds = List<String>.from(data['fields']['project_ids'] ?? []);
  punchInTime = DateTime.parse(data['fields']['punch_in_time']);
  punchOutTime = data['fields']['punch_out_time'] != null 
    ? DateTime.parse(data['fields']['punch_out_time']) 
    : null;
  memo = data['fields']['memo'];
  status = punchOutTime == null ? PunchStatus.active : PunchStatus.completed;
}
```

### App Models → Fillout

**Create TimePunch:**
```dart
Map<String, dynamic> toFillout() {
  return {
    'fields': {
      'employee_id': [employeeId], // linked_record expects array
      'client_id': [clientId],
      'project_ids': projectIds,
      'punch_in_time': punchInTime.toIso8601String(),
      'punch_out_time': punchOutTime?.toIso8601String(),
      'memo': memo,
      'timezone_id': [timezoneId], // From employee's timezone
    }
  };
}
```

---

## Performance Considerations

1. **Minimize API Calls:** Use relationship expansion to get related data in one call
2. **Cache Aggressively:** Cache employee, clients, projects (rarely change)
3. **Lazy Load:** Load punch details only when viewing detail screen
4. **Pagination:** Always paginate large lists
5. **Background Refresh:** Refresh cache in background, show cached data immediately
6. **Debounce:** Debounce search/filter inputs to avoid excessive queries
7. **Batch Updates:** When possible, batch multiple updates into single request

---

## Error Handling

- **Network Errors:** Show retry button, keep cached data visible
- **404 Errors:** Handle missing records gracefully
- **Rate Limiting:** Implement exponential backoff (50 req/sec limit)
- **Validation Errors:** Show user-friendly error messages
- **Timeout:** Set reasonable timeouts (10-30 seconds)

---

## Testing Queries

Test each query pattern with:
1. Empty results (no data)
2. Single result
3. Multiple results
4. Large datasets (pagination)
5. Network failures
6. Invalid data

