# Permissions to Create in Fillout Database

## Users
- **rosson@discover-nocode.com**
  - Firebase UID: `QIcvJl1MA3cMw26PwzkJVnmgaJu2`
  
- **andrea@discover-nocode.com**
  - Firebase UID: `6BoZDbgwDWhfdMGIGT6lXcPbaH62`

## Records to Create

### 1. User App Access Table (`tpwLPMUfiwS`)

**For rosson:**
- `user_id`: `QIcvJl1MA3cMw26PwzkJVnmgaJu2`
- `app_id`: `hr`
- `granted_at`: (current timestamp)
- `employee_id`: (optional - link to Employee record if exists)

**For andrea:**
- `user_id`: `6BoZDbgwDWhfdMGIGT6lXcPbaH62`
- `app_id`: `hr`
- `granted_at`: (current timestamp)
- `employee_id`: (optional - link to Employee record if exists)

### 2. User Permissions Table (`t8bkw75uxCC`)

**For each user (rosson and andrea), create 4 records (one for each view):**

#### View: employees
- `user_id`: (user's Firebase UID)
- `app_id`: `hr`
- `view_id`: `employees`
- `resource_type`: (null/empty)
- `resource_id`: (null/empty)
- `actions`: `["read", "write"]`
- `employee_id`: (optional)

#### View: time-tracking
- `user_id`: (user's Firebase UID)
- `app_id`: `hr`
- `view_id`: `time-tracking`
- `resource_type`: (null/empty)
- `resource_id`: (null/empty)
- `actions`: `["read", "write"]`
- `employee_id`: (optional)

#### View: punch-alterations
- `user_id`: (user's Firebase UID)
- `app_id`: `hr`
- `view_id`: `punch-alterations`
- `resource_type`: (null/empty)
- `resource_id`: (null/empty)
- `actions`: `["read", "write"]`
- `employee_id`: (optional)

#### View: pay-periods
- `user_id`: (user's Firebase UID)
- `app_id`: `hr`
- `view_id`: `pay-periods`
- `resource_type`: (null/empty)
- `resource_id`: (null/empty)
- `actions`: `["read", "write"]`
- `employee_id`: (optional)

## Total Records Needed
- 2 User App Access records (one per user)
- 8 User Permissions records (4 views × 2 users)

## Quick Reference
- Database: `aa7a307dc0a191a5`
- User App Access Table: `tpwLPMUfiwS`
- User Permissions Table: `t8bkw75uxCC`

