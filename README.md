# Yuki - AI-First Admin Console

**Yuki** (Japanese for "snow") is the administrative console for DNCTimeTracker. Built with Next.js and deployed on Vercel, Yuki provides AI-first administrative tools for managing payroll, approving punch alterations, viewing invoices, and more.

## 🎯 Purpose

Yuki is designed for administrators to:
- **View hours for payroll** - See all employee hours across pay periods
- **Approve/decline punch alterations** - Review and manage time alteration requests
- **View invoices** - Access and manage client invoices
- **Manage data** - Eventually expand to CRM, Project Management, HR, and more

## 📁 Project Structure

```
yuki/
├── app/                    # Next.js app directory (routes & API)
├── components/             # React components
├── lib/                    # Shared utilities & helpers
├── types/                  # TypeScript type definitions
├── scripts/                # Utility scripts (Python & TypeScript)
├── docs/                   # Documentation
│   ├── setup/             # Setup & configuration guides
│   ├── config/            # Configuration references
│   └── ...                # Architecture & design docs
├── assets/                 # Static assets (images, etc.)
└── README.md              # This file
```

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Deployment**: Vercel
- **Authentication**: Firebase Auth (same project as Flutter app)
- **Backend**: Vercel Serverless Functions
- **Database**: Fillout/Zite Database (via API)
- **AI**: Anthropic Claude (AI-first architecture)

### Architecture Overview

```
Next.js Admin UI (hub.discover-nocode.com)
    ↓
    Firebase Auth (verify admin user)
    ↓
    Vercel Serverless Functions (verify admin + call Fillout API)
    ↓
    Fillout API (with server-side token)
```

**Key Differences from Flutter App:**
- ✅ Uses **Vercel Functions** (not Firebase Functions)
- ✅ **No employee filtering** - Admins see all data
- ✅ **Admin role verification** (custom claims or admin table)
- ✅ **Direct Fillout API calls** (no proxy needed)

## 📁 Project Structure

```
yuki/
├── app/                    # Next.js app directory (routes & API)
│   ├── api/               # API routes (serverless functions)
│   ├── [appId]/           # Dynamic app routes
│   └── sign-in/           # Authentication pages
├── components/             # React components
├── lib/                   # Shared utilities & helpers
├── types/                 # TypeScript type definitions
├── scripts/               # Utility scripts (Python & TypeScript)
├── docs/                  # Documentation
│   ├── setup/            # Setup & configuration guides
│   │   ├── QUICK_START.md
│   │   ├── SETUP.md
│   │   ├── FIREBASE_SETUP.md
│   │   └── ...
│   ├── config/           # Configuration references
│   │   ├── TABLE_IDS.md
│   │   └── PERMISSIONS_TO_CREATE.md
│   └── ...               # Architecture & design docs
├── assets/                # Static assets (images, etc.)
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Firebase project access (same as DNCTimeTracker)
- Fillout API token
- Vercel account

### Installation

1. **Clone and install dependencies**:
```bash
cd Yuki
npm install
```

2. **Set up environment variables** (`.env.local`):
```bash
# Fillout API Configuration
FILLOUT_API_TOKEN=sk_prod_...
FILLOUT_BASE_ID=aa7a307dc0a191a5
FILLOUT_BASE_URL=https://tables.fillout.com/api/v1/bases

# Firebase Admin SDK
FIREBASE_PROJECT_ID=dnc-time-tracker
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Next.js
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dnc-time-tracker
```

3. **Set up admin users**:
```bash
# Option 1: Set Firebase custom claims (recommended)
ts-node scripts/set-admin-claim.ts admin@discover-nocode.com

# Option 2: Add to Fillout Admins table
# Option 3: Add to Vercel environment variables
```

4. **Run development server**:
```bash
npm run dev
```

5. **Open browser**:
```
http://localhost:3000
```

## 📚 Documentation

### Getting Started

1. **[QUICK_START.md](./docs/setup/QUICK_START.md)** - Quick setup guide
2. **[SETUP.md](./docs/setup/SETUP.md)** - Complete setup instructions
3. **[FIREBASE_SETUP.md](./docs/setup/FIREBASE_SETUP.md)** - Firebase configuration
4. **[ENV_SETUP.md](./docs/setup/ENV_SETUP.md)** - Environment variables guide

### Essential Reading

1. **[FILLOUT_DATABASE_SCHEMA.md](./docs/FILLOUT_DATABASE_SCHEMA.md)** - Complete database schema
2. **[FILLOUT_DATABASE_API.md](./docs/FILLOUT_DATABASE_API.md)** - Fillout API reference
3. **[VERCEL_FUNCTIONS_ARCHITECTURE.md](./docs/VERCEL_FUNCTIONS_ARCHITECTURE.md)** - Vercel functions setup
4. **[ADMIN_AUTHENTICATION_SETUP.md](./docs/ADMIN_AUTHENTICATION_SETUP.md)** - Admin auth setup

### Design System Documentation

5. **[DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** - Complete design system matching DNCWebsite aesthetic
6. **[UI_COMPONENT_LIBRARY.md](./docs/UI_COMPONENT_LIBRARY.md)** - UI component specifications and usage
7. **[UI_UX_GUIDELINES.md](./docs/UI_UX_GUIDELINES.md)** - UI/UX guidelines and best practices
8. **[VISUAL_DESIGN_REFERENCE.md](./docs/VISUAL_DESIGN_REFERENCE.md)** - Visual design reference with code examples

### Reference Documentation

- **[FIREBASE_FUNCTIONS_REFERENCE.md](./docs/FIREBASE_FUNCTIONS_REFERENCE.md)** - Firebase Functions code (for reference)
- **[FILLOUT_DATABASE_SUMMARY.md](./docs/FILLOUT_DATABASE_SUMMARY.md)** - Quick database reference
- **[FILLOUT_DATA_MAPPING.md](./docs/FILLOUT_DATA_MAPPING.md)** - Data mapping patterns
- **[PAY_PERIOD_IMPLEMENTATION_COMPLETE.md](./docs/PAY_PERIOD_IMPLEMENTATION_COMPLETE.md)** - Pay period logic

## 🔐 Security

### Authentication
- Firebase Auth with Google Sign-In
- Admin role verification (custom claims or admin table)
- Token verification in all API routes

### API Security
- Fillout API token stored in Vercel environment variables (never exposed)
- All API calls go through Vercel functions (server-side only)
- Admin role required for all data access

### Best Practices
- ✅ Always verify auth token before processing requests
- ✅ Always check admin role before allowing data access
- ✅ Never expose Fillout API token to client
- ✅ Use environment variables for all secrets
- ✅ Log all admin actions for audit trail

## 🗄️ Database

### Fillout/Zite Database

- **Database ID**: `aa7a307dc0a191a5`
- **Base URL**: `https://tables.fillout.com/api/v1/bases`
- **API Token**: Stored in Vercel environment variables

### Key Tables

- **Employees** (`tcNK2zZPcAR`) - All employees
- **Punches** (`t3uPEDXn9wt`) - Time punch records
- **Punch Alterations** (`t5x39cZnrdK`) - Alteration requests
- **Time Cards** (`t4F8J8DfSSN`) - Time cards for payroll
- **Invoices** - Client invoices

See [FILLOUT_DATABASE_SCHEMA.md](./docs/FILLOUT_DATABASE_SCHEMA.md) for complete schema.

## 🎨 Features (Planned)

### Phase 1: Core Admin Features
- [ ] View all employee hours for payroll
- [ ] Approve/decline punch alterations
- [ ] View invoices
- [ ] Employee management

### Phase 2: Enhanced Features
- [ ] Payroll reports
- [ ] Time card management
- [ ] Invoice generation
- [ ] Analytics dashboard

### Phase 3: AI Integration
- [ ] AI-powered insights
- [ ] Automated anomaly detection
- [ ] Smart recommendations
- [ ] Natural language queries

### Phase 4: Expansion
- [ ] CRM features
- [ ] Project management
- [ ] HR management
- [ ] More...

## 🚢 Deployment

### Vercel Deployment

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** automatically on push to main branch

### Custom Domain

- **Production URL**: `hub.discover-nocode.com`
- Configure in Vercel dashboard → Domains

## 🔗 Related Projects

- **[DNCTimeTracker](../DNCTimeTracker/)** - Flutter employee app
- **Firebase Project**: `dnc-time-tracker`
- **Fillout Database**: `aa7a307dc0a191a5`

## 📝 Development Notes

### Key Differences from Flutter App

1. **No Employee Filtering**: Admins see all data (no `employee_id` filtering)
2. **Vercel Functions**: Uses Vercel serverless functions instead of Firebase Functions
3. **Admin Role**: Requires admin role verification (not just authentication)
4. **Direct API Calls**: Calls Fillout API directly (no proxy needed)

### API Patterns

See [VERCEL_FUNCTIONS_ARCHITECTURE.md](./docs/VERCEL_FUNCTIONS_ARCHITECTURE.md) for API implementation patterns.

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📄 License

Private project - All rights reserved

---

**Built with ❄️ by the DNC team**

