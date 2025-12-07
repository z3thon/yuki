# Fillout Database Integration - Summary

## Quick Reference

### Database Information
- **Database ID**: `aa7a307dc0a191a5`
- **Database URL**: https://build.fillout.com/database/aa7a307dc0a191a5/trwubaBRu4W/v8J1fT1cBsm
- **API Token**: `sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131`

### Documentation Files
1. **FILLOUT_DATABASE_API.md** - Complete API reference and endpoint documentation
2. **FILLOUT_DATABASE_SCHEMA.md** - Detailed schema design with all tables, fields, and relationships
3. **FILLOUT_SETUP_GUIDE.md** - Step-by-step setup instructions
4. **setup_fillout_database.sh** - Bash script for automated setup
5. **setup_fillout_database.py** - Python script for automated setup (recommended)

## Tables Overview

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| **Companies** | Internal companies using the platform | → Departments, → Employees |
| **Departments** | Departments within companies | ← Companies, → Employees |
| **Employees** | Employees belonging to companies/departments | ← Companies, ← Departments, ← Timezones, → Time Cards, → Punches, → Employee Activity |
| **Clients** | External clients for time tracking | → Projects, ↔ Employees (via Client Employee Access) |
| **Projects** | Projects belonging to clients | ← Clients, ↔ Punches (many-to-many) |
| **Pay Periods** | Pay period definitions | → Time Cards |
| **Time Cards** | Time cards per employee/pay period/client | ← Employees, ← Pay Periods, ← Clients, → Punches |
| **Punches** | Individual time punch records | ← Employees, ← Clients, ↔ Projects, ← Time Cards, ← Timezones |
| **Punch Alterations** | Requests to alter punches | ← Punches, ↔ Projects |
| **Timezones** | Timezone definitions | → Timezone Actual, → Employees, → Punches |
| **Timezone Actual** | DST variants of timezones | ← Timezones |
| **Client Employee Access** | Many-to-many: Clients ↔ Employees | ← Clients, ← Employees |
| **Employee Activity** | Employee status history | ← Employees |

## Key Design Decisions

### 1. Multi-Tenant Support
- **Companies** table allows multiple companies to use the same platform
- Employees belong to a specific company
- Departments belong to a specific company

### 2. Client Access Control
- **Client Employee Access** table controls which employees can track time for which clients
- Includes start/end dates for access periods
- Null `end_date` means access is still active

### 3. Employee Status Tracking
- **Employee Activity** table tracks status history (active, inactive, terminated, etc.)
- Multiple records per employee for historical tracking
- Null `end_date` means status is still in effect
- App checks for "active" status to grant access

### 4. Timezone Handling
- Employees have a timezone preference
- Each punch stores timezone at punch in time
- Optional punch out timezone if employee moved between timezones
- **Timezone Actual** table stores DST variants (e.g., "Mountain Daylight Time" vs "Mountain Standard Time")

### 5. Pay Period Flexibility
- Supports bi-weekly, bi-monthly, and monthly periods
- Separate start date, end date, and payout date
- Time cards auto-generated for active employees with client access

### 6. Project Tracking
- Projects belong to clients
- Punches can be associated with multiple projects (many-to-many)
- Punch alterations can change project associations

## Field Creation Checklist

### Base Tables (No Dependencies)
- [ ] Companies - name, address, contact_info
- [ ] Clients - name, contact_info, is_active
- [ ] Timezones - name, iana_name

### First Level Dependencies
- [ ] Departments - company_id (→ Companies), name
- [ ] Projects - client_id (→ Clients), name, is_active
- [ ] Timezone Actual - timezone_id (→ Timezones), name, iana_name, offset_hours, is_dst

### Employee Tables
- [ ] Employees - company_id (→ Companies), department_id (→ Departments), name, email, photo_url, pay_rate, employment_type, timezone_id (→ Timezones)
- [ ] Employee Activity - employee_id (→ Employees), status, start_date, end_date

### Access Tables
- [ ] Client Employee Access - client_id (→ Clients), employee_id (→ Employees), start_date, end_date

### Pay Period Tables
- [ ] Pay Periods - start_date, end_date, payout_date, period_type
- [ ] Time Cards - employee_id (→ Employees), pay_period_id (→ Pay Periods), client_id (→ Clients), total_hours

### Punch Tables
- [ ] Punches - employee_id (→ Employees), client_id (→ Clients), project_ids (↔ Projects), time_card_id (→ Time Cards), punch_in_time, punch_out_time, memo, timezone_id (→ Timezones), punch_out_timezone_id (→ Timezones)
- [ ] Punch Alterations - punch_id (→ Punches), requested_at, new_punch_in_time, new_punch_out_time, new_project_ids (↔ Projects), new_memo, reason, status, reviewed_at, review_notes

## Next Steps

1. **Get Table IDs**: Use the Fillout dashboard or API to get all table IDs
2. **Run Setup Script**: Execute `setup_fillout_database.py` or `setup_fillout_database.sh`
3. **Verify Schema**: Check all fields and relationships in Fillout dashboard
4. **Populate Initial Data**: Add timezones, create first company, departments, employees
5. **Test**: Create test pay periods, time cards, and punches
6. **Integrate**: Update Flutter app to use Fillout API instead of mock data

## API Usage Examples

### Get Database Info
```bash
curl -X GET \
  -H "Authorization: Bearer sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131" \
  "https://api.fillout.com/v1/databases/aa7a307dc0a191a5"
```

### Create a Record
```bash
curl -X POST \
  -H "Authorization: Bearer sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "name": "Acme Corporation",
      "address": "123 Main St"
    }
  }' \
  "https://api.fillout.com/v1/databases/aa7a307dc0a191a5/tables/{TABLE_ID}/records"
```

### List Records
```bash
curl -X GET \
  -H "Authorization: Bearer sk_prod_kZl0PNiWMPe2bPIIHcqFCJyDIPqKHmaPi6P4YYc0Dcud4CWQMoeQfzXS5EMfOfdG3KgV2FzGrAy2hOevMHXrxnbFqZvUyVvw99z_35131" \
  "https://api.fillout.com/v1/databases/aa7a307dc0a191a5/tables/{TABLE_ID}/records"
```

## Important Notes

1. **API Endpoint Structure**: Fillout API endpoints may vary. Test different base URLs:
   - `https://api.fillout.com/v1`
   - `https://tables.fillout.com/api/v1`

2. **Field Types**: Fillout may use `"link"` instead of `"relationship"` for relationship fields. Check API documentation.

3. **Rate Limits**: Maximum 50 requests per second. Contact support for higher limits.

4. **Error Handling**: All API errors return consistent format with error code and message.

5. **Relationships**: Many-to-many relationships use relationship fields with `many-to-many` type, not junction tables (except Client Employee Access which is a junction table with additional fields).

## Support Resources

- [Fillout Database Overview](https://www.fillout.com/help/database/overview)
- [Fillout Database API Reference](https://support.fillout.com/help/database/api)
- [Field Types Documentation](https://www.fillout.com/help/database/field-types)
- Fillout Support: support@fillout.com

