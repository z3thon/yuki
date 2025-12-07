# Yuki Admin Console - Development Milestones

## Overview

Yuki is an AI-first administrative console for managing DNCTimeTracker backend data. The platform supports multiple apps (HR, CRM, Billing) with granular permission-based access control, built on Next.js with Vercel serverless functions.

## Architecture Decisions

### Permission System
- **Storage**: Fillout Database tables (flexible, queryable)
- **Caching**: In-memory cache in Vercel functions (5-minute TTL)
- **Enforcement**: Middleware layer in Vercel functions (server-side only)
- **Granularity**: App-level → View-level → Resource-level → Action-level

### Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with glassmorphic design system
- **Authentication**: Firebase Auth (same project as Flutter app)
- **Backend**: Vercel Serverless Functions
- **Database**: Fillout/Zite Database (via API)
- **AI**: Claude (Anthropic) for view/dashboard generation
- **Port**: localhost:3011

### Security Model
Since Fillout/Zite DB doesn't have built-in RBAC, we implement:
1. **Permission tables** in Fillout Database (User App Access, User Permissions, Views)
2. **Vercel function middleware** that checks permissions before every API call
3. **Query filtering** based on user permissions (server-side only)
4. **AI acts as user** - inherits user's permissions, can't exceed them

**Database Location**: All tables (existing DNCTimeTracker tables and new Yuki permission tables) are stored in Fillout Database (`aa7a307dc0a191a5` - Discover NoCode DB).

---

## Milestone 1: Foundation & Infrastructure ✅

### Completed
- [x] Next.js project initialization with TypeScript and Tailwind
- [x] Port configuration (3011)
- [x] Project structure (app/, components/, lib/, hooks/, types/)
- [x] Glassmorphic design system implementation
- [x] Firebase Auth setup (client + admin)
- [x] Fillout API wrapper library
- [x] Permission system architecture
- [x] Vercel API routes (auth, permissions, fillout proxy)
- [x] App switcher component (HR, CRM, Billing)
- [x] Shared layout with collapsible sidebar
- [x] HR app infrastructure with placeholder views

### Files Created
- Core configuration: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`
- Types: `types/index.ts`
- Libraries: `lib/apps.ts`, `lib/firebase.ts`, `lib/firebase-admin.ts`, `lib/fillout.ts`, `lib/permissions.ts`
- Components: `components/AppSwitcher.tsx`, `components/Sidebar.tsx`, `components/Layout.tsx`
- API Routes: `app/api/auth/verify/route.ts`, `app/api/permissions/check/route.ts`, `app/api/fillout/proxy/route.ts`
- App Routes: `app/[appId]/layout.tsx`, `app/[appId]/page.tsx`, `app/[appId]/[viewId]/page.tsx`

---

## Milestone 2: Permission System Implementation ✅

### Completed
- [x] Create Fillout table management utilities (`lib/fillout-tables.ts`)
- [x] Implement permission fetching from Fillout (`lib/permission-tables.ts`)
- [x] Add permission caching layer (in-memory, 5min TTL) ✅
- [x] Create permission middleware functions (`lib/permissions.ts`)
- [x] Create API endpoints for permission management (`/api/admin/permissions`, `/api/admin/views`)
- [x] Update Fillout API documentation with new discoveries
- [x] Create Fillout Database tables:
  - `User App Access` (`tpwLPMUfiwS`) - Controls which apps users can access ✅
  - `User Permissions` (`t8bkw75uxCC`) - Granular permissions (app/view/resource/action) ✅
  - `Views` (`t1F3H9vT9Gr`) - Stores user-created and default views/dashboards ✅
  - All tables created in Fillout Database (`aa7a307dc0a191a5`)
- [x] Add `employee_id` relationships to all permission tables (links to Employees table)
- [x] Create Python script for table creation (`scripts/create_permission_tables.py`)
- [x] Update types and code to support employee relationships
- [x] Add employee lookup utilities (`lib/employee-lookup.ts`)

### Remaining Tasks (Future)
- [ ] Test permission system end-to-end
- [ ] Build permission management UI (admin only)
- [ ] Add permission checks to Fillout proxy (enhance existing implementation)

### Database Schema

**All tables are stored in Fillout Database** (`aa7a307dc0a191a5` - Discover NoCode DB)

#### User App Access Table (Fillout Database)
```
- id (Auto-increment)
- user_id (Text, Required) - Firebase UID (for authentication)
- employee_id (Linked Record → Employees, Optional) - Employee record ID
- app_id (Select: "hr", "crm", "billing", Required)
- granted_at (DateTime, Auto)
- created_at (DateTime, Auto)
- updated_at (DateTime, Auto)
```

**Note**: `employee_id` links to Employees table, allowing queries by employee, company, or department.

#### User Permissions Table (Fillout Database)
```
- id (Auto-increment)
- user_id (Text, Required) - Firebase UID (for authentication)
- employee_id (Linked Record → Employees, Optional) - Employee record ID
- app_id (Select: "hr", "crm", "billing", Required)
- view_id (Text, Optional) - If null, applies to all views
- resource_type (Text, Optional) - e.g., "employee", "punch", "invoice"
- resource_id (Text, Optional) - If null, applies to all resources
- actions (Text, Multiple) - ["read", "write", "delete", "approve"]
- created_at (DateTime, Auto)
- updated_at (DateTime, Auto)
```

**Note**: `employee_id` links to Employees table for data relationships and filtering.

#### Views Table (Fillout Database)
```
- id (Auto-increment)
- app_id (Select: "hr", "crm", "billing", Required)
- name (Text, Required)
- description (Long Text, Optional)
- is_default (Boolean, Default: false)
- is_custom (Boolean, Default: true)
- created_by (Text, Optional) - Firebase UID
- employee_id (Linked Record → Employees, Optional) - Employee record ID
- shared_with (Text, Multiple, Optional) - Firebase UIDs
- config (Long Text, JSON) - View configuration
- created_at (DateTime, Auto)
- updated_at (DateTime, Auto)
```

**Note**: `employee_id` links to Employees table, enabling queries by employee, company, or department.

---

## Milestone 3: HR App - Core Views 🎯 (Next)

### Overview
Build the core views for the HR app to manage employees, time tracking, punch alterations, and pay periods. All views will respect user permissions and filter data based on employee relationships.

### Tasks
- [ ] **Employees View** (Priority 1)
  - List all employees with search/filter
  - View employee details (name, email, company, department, pay rate)
  - Edit employee information (with permission check)
  - Filter by company/department (using employee_id relationships)
  - Respect user permissions (filter by employee_id if user has limited access)
  
- [ ] **Time Tracking View** (Priority 2)
  - List all punches with filters (date range, employee, client)
  - View punch details (in/out times, duration, client)
  - Edit punches (with permission check)
  - Export time data
  - Filter by employee_id relationships
  
- [ ] **Punch Alterations View** (Priority 3)
  - List pending alterations
  - Approve/decline alterations (requires 'approve' permission)
  - View alteration history
  - Filter by status, employee, date
  - Show employee details via employee_id relationship
  
- [ ] **Pay Periods View** (Priority 4)
  - Dashboard showing hours by pay period
  - Filter by employee, client, date range
  - View time card totals
  - Export payroll data
  - Aggregate by employee_id relationships

### API Endpoints Needed
- `GET /api/hr/employees` - List employees (with permission filtering by employee_id)
- `GET /api/hr/employees/[id]` - Get employee details
- `PATCH /api/hr/employees/[id]` - Update employee (check write permission)
- `GET /api/hr/punches` - List punches (filter by employee_id relationships)
- `GET /api/hr/punches/[id]` - Get punch details
- `PATCH /api/hr/punches/[id]` - Update punch (check write permission)
- `GET /api/hr/alterations` - List alterations (filter by employee_id)
- `GET /api/hr/alterations/[id]` - Get alteration details
- `POST /api/hr/alterations/[id]/approve` - Approve alteration (check approve permission)
- `POST /api/hr/alterations/[id]/decline` - Decline alteration (check approve permission)
- `GET /api/hr/pay-periods` - Get pay period data (aggregate by employee_id)

### Implementation Notes
- All endpoints must check user permissions before returning data
- Filter data based on employee_id relationships (user can only see employees they have access to)
- Use Fillout API with proper filters (employee_id relationships)
- Respect permission actions: read, write, delete, approve
- Cache permission checks using existing permission cache system
- **All data comes from Fillout Database** - both existing DNCTimeTracker tables and new Yuki permission tables

---

## Milestone 4: Billing App Infrastructure

### Tasks
- [ ] Create billing app routes and layout
- [ ] **Invoices View**
  - List all invoices
  - Create new invoices
  - View invoice details
  - Edit invoices
  - Generate invoice PDFs
  
- [ ] **Time Cards View**
  - View time cards by client
  - Calculate totals
  - Export for billing
  
- [ ] **Client Management View**
  - List clients
  - View client details
  - Manage client settings

---

## Milestone 5: CRM App Infrastructure

### Tasks
- [ ] Create CRM app routes and layout
- [ ] **Clients View**
  - List all clients
  - View client details
  - Edit client information
  - Manage client projects
  
- [ ] **Projects View**
  - List projects by client
  - View project details
  - Track project time
  
- [ ] **Employee-Client Assignments**
  - Assign employees to clients
  - Manage access dates
  - View assignment history

---

## Milestone 6: AI Integration - View Generation

### Tasks
- [ ] Set up Claude API integration
- [ ] Create AI service layer
- [ ] **AI View Builder**
  - Natural language to view conversion
  - Generate queries based on user intent
  - Create dashboard configurations
  - Validate permissions before creation
  
- [ ] **AI Data Assistant**
  - Answer questions about data
  - Generate reports
  - Suggest insights
  
- [ ] **AI Data Updates**
  - Update records based on natural language
  - Validate permissions before updates
  - Log all AI actions

### AI Features
- Users can ask: "Show me all employees who worked more than 40 hours last week"
- AI generates a view with appropriate filters
- AI respects user permissions (can't see data they don't have access to)
- AI can update data: "Set John's pay rate to $25/hour" (if user has write permission)
- **All AI queries and updates go to Fillout Database** - AI reads from and writes to Fillout tables

### Future: V2 Features
- **Python Script Generation**: AI can write Python scripts for web scraping or data processing
- Scripts run in secure sandbox environment
- Results stored in Fillout Database tables
- User can review and approve scripts before execution

---

## Milestone 7: Advanced Features

### Tasks
- [ ] **View Sharing**
  - Share custom views with other users
  - Set sharing permissions
  - View usage analytics
  
- [ ] **Export & Reporting**
  - Export data to CSV/Excel
  - Generate PDF reports
  - Schedule automated reports
  
- [ ] **Notifications**
  - Alert on pending alterations
  - Pay period reminders
  - Custom notification rules
  
- [ ] **Audit Logging**
  - Log all data changes
  - Track who made changes
  - View audit history

---

## Milestone 8: Performance & Optimization

### Tasks
- [ ] Implement view caching (Fillout → Vercel cache)
- [ ] Optimize Fillout API calls (batch requests)
- [ ] Add pagination to all list views
- [ ] Implement virtual scrolling for large datasets
- [ ] Add loading states and skeletons
- [ ] Optimize bundle size

---

## Milestone 9: Testing & Documentation

### Tasks
- [ ] Write unit tests for permission system
- [ ] Write integration tests for API routes
- [ ] Write E2E tests for critical flows
- [ ] Create user documentation
- [ ] Create developer documentation
- [ ] Create API documentation

---

## Milestone 10: Deployment & Production

### Tasks
- [ ] Set up Vercel deployment
- [ ] Configure environment variables
- [ ] Set up monitoring and error tracking
- [ ] Configure custom domain (hub.discover-nocode.com)
- [ ] Set up CI/CD pipeline
- [ ] Performance testing
- [ ] Security audit

---

## Permission System Details

### Permission Hierarchy
1. **App Access** - Can user access the app? (User App Access table)
2. **View Access** - Can user see this view? (User Permissions table, view_id)
3. **Resource Access** - Can user access this resource type? (User Permissions table, resource_type)
4. **Action Permission** - Can user perform this action? (User Permissions table, actions)

### Example Permission Checks
```typescript
// Check if user can read employees in HR app
checkPermission({
  userId: "user123",
  appId: "hr",
  viewId: "employees",
  resourceType: "employee",
  action: "read"
})

// Check if user can approve alterations
checkPermission({
  userId: "user123",
  appId: "hr",
  viewId: "punch-alterations",
  resourceType: "alteration",
  action: "approve"
})
```

### AI Permission Inheritance
- AI inherits the user's permissions
- AI cannot exceed user's access level
- All AI actions are logged with user ID
- AI-generated queries are filtered by permissions before execution

---

## Database Tables Reference

**All tables are stored in Fillout Database** (`aa7a307dc0a191a5` - Discover NoCode DB)

### Existing Tables (from DNCTimeTracker - Fillout Database)
All existing DNCTimeTracker tables are in the same Fillout Database:
- Employees (`tcNK2zZPcAR`)
- Punches (`t3uPEDXn9wt`)
- Punch Alterations (`t5x39cZnrdK`)
- Time Cards (`t4F8J8DfSSN`)
- Clients
- Projects
- Pay Periods
- Client Invoices
- Client Employee Access
- Employee Activity

### New Tables (for Yuki - Fillout Database)
All new Yuki permission tables are in the same Fillout Database:
- **User App Access** (`tpwLPMUfiwS`) - Controls app access, linked to Employees ✅
- **User Permissions** (`t8bkw75uxCC`) - Granular permissions, linked to Employees ✅
- **Views** (`t1F3H9vT9Gr`) - User-created views/dashboards, linked to Employees ✅
- AI Scripts (V2 - will be in Fillout Database)
- Audit Logs (future - will be in Fillout Database)

**Note**: All tables (existing and new) are in the same Fillout Database instance, allowing relationships between tables (e.g., `employee_id` linked records).

---

## Next Steps

1. **Install dependencies**: `npm install`
2. **Set up environment variables**: Create `.env.local` (see `.env.example`)
3. **Permission tables**: Already created in Fillout Database ✅
4. **Test authentication**: Verify Firebase Auth works
5. **Build HR views**: Start with Employees view (data from Fillout Database)
6. **Implement AI integration**: Set up Claude API (will query Fillout Database)

---

**Last Updated**: January 2025
**Version**: 0.1.0

