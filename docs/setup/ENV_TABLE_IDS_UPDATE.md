# Update .env.local with All Table IDs

## Summary

All table IDs from the Fillout database have been fetched and documented. Add these to your `.env.local` file.

## What to Add to .env.local

Add this section to your `.env.local` file (after the existing Fillout configuration):

```bash
# ============================================
# Fillout Table IDs (Database ID: aa7a307dc0a191a5)
# ============================================
# All table IDs from the Fillout database for reference

# Permission Tables
USER_APP_ACCESS_TABLE_ID=tpwLPMUfiwS
USER_PERMISSIONS_TABLE_ID=t8bkw75uxCC
VIEWS_TABLE_ID=t1F3H9vT9Gr

# HR App Tables
COMPANIES_TABLE_ID=tbjujz4iq6r
DEPARTMENTS_TABLE_ID=tviEhSR8rfg
EMPLOYEES_TABLE_ID=tcNK2zZPcAR
EMPLOYEE_ACTIVITY_TABLE_ID=t2JqUmLFqfA
PAY_RATE_HISTORY_TABLE_ID=t4Va6eDRwTF
CLIENTS_TABLE_ID=te3Gw8PDkS7
CLIENT_INVOICES_TABLE_ID=trSRiSKg4h5
CLIENT_EMPLOYEE_ACCESS_TABLE_ID=tt5JxJuYHSQ
PROJECTS_TABLE_ID=t9gBZ2DumZM
PAY_PERIODS_TABLE_ID=tk8fyCDXQ8H
TIME_CARDS_TABLE_ID=t4F8J8DfSSN
PUNCHES_TABLE_ID=t3uPEDXn9wt
PUNCH_ALTERATION_REQUESTS_TABLE_ID=t5x39cZnrdK
TIMEZONES_TABLE_ID=tbrgcTzKeZU
TIMEZONES_ACTUAL_TABLE_ID=tpgwfCYh9PH

# CRM/Billing Tables
OPPORTUNITIES_TABLE_ID=t3ephfTMjtf
CONTRACTS_TABLE_ID=ta1vDzU6ZUm
TASKS_TABLE_ID=toBcYFBgw7u
SUBTASKS_TABLE_ID=t5kuJ3BNJLA
SPRINTS_TABLE_ID=taWCNaKRfDZ

# NoCode Community Tables
NOCODE_LEADERS_TABLE_ID=trwubaBRu4W
NOCODE_TOOLS_TABLE_ID=tbRGciwF8sM
NOCODE_COMMUNITIES_TABLE_ID=tfx9zy2okHB
```

## Changes Made

1. ✅ **Updated `env.example`** - Added all 26 table IDs
2. ✅ **Updated `lib/fillout-table-ids.ts`** - Added all table IDs with environment variable support
3. ✅ **Created `scripts/fetch-all-table-ids.ts`** - Script to fetch all tables from database
4. ✅ **Fixed pay rate history integration** - Now uses the correct table ID `t4Va6eDRwTF`

## Benefits

- **Single source of truth** - All table IDs in one place
- **Easy reference** - No need to search codebase for table IDs
- **Environment-based** - Can override defaults via `.env.local`
- **Future-proof** - Easy to add new tables

## Next Steps

1. Copy the table IDs above into your `.env.local` file
2. Restart your development server to load the new environment variables
3. The code will automatically use these table IDs from environment variables

## Regenerating Table IDs

If tables are added/removed from the database, run:

```bash
npx tsx scripts/fetch-all-table-ids.ts
```

This will output the updated list of table IDs to add to `.env.local`.
