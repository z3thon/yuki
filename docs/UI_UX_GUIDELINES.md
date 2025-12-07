# Yuki UI/UX Guidelines
## Admin Portal Design Principles & Best Practices

This document outlines the UI/UX guidelines for the Yuki admin portal, ensuring consistency with the DNCWebsite design language while optimizing for administrative workflows.

---

## 🎯 Design Philosophy

### Core Principles
1. **Clarity First**: Administrative interfaces must prioritize clarity and functionality
2. **Efficiency**: Minimize clicks and cognitive load for common tasks
3. **Consistency**: Match DNCWebsite aesthetic while optimizing for admin use
4. **Accessibility**: WCAG 2.1 AA compliant, keyboard navigable
5. **Performance**: Fast, responsive, smooth interactions

### Design Language
- **Glassmorphism**: Frosted glass aesthetic matching DNCWebsite
- **Clean & Professional**: Business-focused, not overly decorative
- **Data-Dense**: Optimized for displaying and managing large amounts of data
- **Action-Oriented**: Clear CTAs and workflow guidance

---

## 📐 Layout Patterns

### Page Structure

#### Standard Admin Page
```
┌─────────────────────────────────────────┐
│  GlassNavbar (sticky)                  │
├─────────────────────────────────────────┤
│  PageContainer (max-w-7xl)             │
│  ┌───────────────────────────────────┐ │
│  │  Page Header                      │ │
│  │  - Title (h1)                     │ │
│  │  - Breadcrumbs (optional)         │ │
│  │  - Actions (buttons)              │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │  Main Content                     │ │
│  │  - GlassCard containers           │ │
│  │  - Data tables                    │ │
│  │  - Forms                          │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Dashboard Layout
```
┌─────────────────────────────────────────┐
│  GlassNavbar                           │
├─────────────────────────────────────────┤
│  PageContainer                         │
│  ┌───────────────────────────────────┐ │
│  │  Dashboard Header                 │ │
│  └───────────────────────────────────┘ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ Stat │ │ Stat │ │ Stat │ │ Stat │ │
│  │ Card │ │ Card │ │ Card │ │ Card │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ │
│  ┌───────────────────────────────────┐ │
│  │  Chart/Graph Container             │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │  Recent Activity Table            │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Grid Systems

#### Card Grid
```tsx
// Responsive card grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <GlassCard>...</GlassCard>
  <GlassCard>...</GlassCard>
  <GlassCard>...</GlassCard>
</div>
```

#### Dashboard Stats Grid
```tsx
// 4-column stats grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard>...</StatCard>
  <StatCard>...</StatCard>
  <StatCard>...</StatCard>
  <StatCard>...</StatCard>
</div>
```

#### Form Grid
```tsx
// 2-column form layout
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <FormField>...</FormField>
  <FormField>...</FormField>
</div>
```

---

## 🎨 Visual Hierarchy

### Typography Scale

#### Page Titles
```tsx
// Main page title
<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8">
  Dashboard
</h1>
```

#### Section Headers
```tsx
// Section header
<h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
  Employee Management
</h2>
```

#### Card Titles
```tsx
// Card title
<h3 className="text-xl font-semibold text-foreground mb-2">
  Recent Activity
</h3>
```

#### Body Text
```tsx
// Standard body text
<p className="text-base text-foreground/70">
  Description text goes here
</p>
```

#### Small Text
```tsx
// Labels, captions
<span className="text-sm text-foreground/60">
  Last updated 2 hours ago
</span>
```

### Color Usage

#### Text Colors
- **Primary Text**: `text-foreground` (#1a1a1a)
- **Secondary Text**: `text-foreground/70` (70% opacity)
- **Tertiary Text**: `text-foreground/60` (60% opacity)
- **Muted Text**: `text-foreground/50` (50% opacity)

#### Accent Colors
- **Primary Actions**: Blue (`#2563eb`)
- **Success**: Green (`#10b981`)
- **Error**: Red (`#ef4444`)
- **Warning**: Yellow (`#f59e0b`)
- **Info**: Blue (`#3b82f6`)

#### Status Colors
- **Approved**: Green
- **Pending**: Yellow/Orange
- **Rejected**: Red
- **Draft**: Gray

---

## 🎯 Component Usage Guidelines

### Buttons

#### Primary Actions
- Use primary blue button for main CTAs
- Use orange button for DNC brand actions
- Place primary actions prominently (top-right, bottom-right)

#### Secondary Actions
- Use secondary glass button for less important actions
- Use ghost button for tertiary actions

#### Button Placement
```tsx
// Page header with actions
<div className="flex justify-between items-center mb-6">
  <h1>Employees</h1>
  <GlassButton variant="primary">Add Employee</GlassButton>
</div>
```

### Forms

#### Form Layout
- Single column on mobile
- Two columns on desktop (when appropriate)
- Clear labels above inputs
- Error messages below inputs
- Submit button at bottom

#### Form Validation
- Real-time validation (on blur)
- Clear error messages
- Visual error states (red border, error icon)
- Success states (green checkmark)

#### Form Example
```tsx
<form className="space-y-6">
  <FormGroup columns={2}>
    <FormField label="First Name" required error={errors.firstName}>
      <GlassInput {...register('firstName')} />
    </FormField>
    <FormField label="Last Name" required error={errors.lastName}>
      <GlassInput {...register('lastName')} />
    </FormField>
  </FormGroup>
  
  <FormField label="Email" required error={errors.email}>
    <GlassInput type="email" {...register('email')} />
  </FormField>
  
  <div className="flex justify-end gap-4">
    <GlassButton variant="secondary" onClick={onCancel}>
      Cancel
    </GlassButton>
    <GlassButton variant="primary" type="submit">
      Save Changes
    </GlassButton>
  </div>
</form>
```

### Data Tables

#### Table Structure
- Clear column headers
- Sortable columns (where applicable)
- Row hover effects
- Clickable rows (if actionable)
- Pagination at bottom
- Search/filter at top

#### Table Example
```tsx
<GlassCard>
  <div className="mb-4">
    <GlassInput
      type="text"
      placeholder="Search employees..."
      className="mb-4"
    />
  </div>
  <GlassTable
    data={employees}
    columns={columns}
    onRowClick={(row) => handleRowClick(row)}
  />
</GlassCard>
```

### Modals

#### Modal Usage
- Use for forms, confirmations, details
- Clear title and close button
- Action buttons at bottom
- Escape key to close
- Click outside to close (optional)

#### Modal Example
```tsx
<GlassModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit Employee"
  size="md"
>
  <form>...</form>
  <div className="flex justify-end gap-4 mt-6">
    <GlassButton variant="secondary" onClick={() => setIsOpen(false)}>
      Cancel
    </GlassButton>
    <GlassButton variant="primary" onClick={handleSave}>
      Save
    </GlassButton>
  </div>
</GlassModal>
```

---

## 🎨 Spacing & Layout

### Page Spacing
- **Page Container**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- **Section Spacing**: `mb-8` or `space-y-8`
- **Card Spacing**: `gap-6` (grid) or `space-y-6` (stack)

### Component Spacing
- **Card Padding**: `p-8` (2rem)
- **Form Field Spacing**: `space-y-4` or `gap-4`
- **Button Spacing**: `gap-4` between buttons
- **Table Padding**: `px-6 py-4` for cells

### Responsive Spacing
```tsx
// Responsive padding
<div className="p-4 sm:p-6 lg:p-8">

// Responsive margin
<div className="mb-4 md:mb-6 lg:mb-8">

// Responsive gap
<div className="gap-4 md:gap-6 lg:gap-8">
```

---

## 🎯 Interaction Patterns

### Hover States
- **Cards**: `translateY(-6px) scale(1.01)`
- **Buttons**: `translateY(-2px) scale(1.02)`
- **Table Rows**: Background highlight
- **Links**: Underline or color change

### Loading States
- **Spinner**: Show spinner in button or container
- **Skeleton**: Show skeleton loaders for content
- **Disabled**: Disable buttons/inputs during loading

### Feedback
- **Success**: Green alert/toast
- **Error**: Red alert/toast
- **Warning**: Yellow alert/toast
- **Info**: Blue alert/toast

### Transitions
- **Standard**: `0.4s cubic-bezier(0.4, 0, 0.2, 1)`
- **Fast**: `0.2s ease-out`
- **Smooth**: Use Framer Motion for complex animations

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (sm-md-lg)
- **Desktop**: > 1024px (lg+)

### Mobile Optimizations
- Single column layouts
- Stacked cards
- Full-width buttons
- Larger touch targets (44px minimum)
- Reduced padding
- Simplified navigation

### Tablet Optimizations
- 2-column grids
- Side-by-side forms
- Optimized table layouts
- Touch-friendly interactions

### Desktop Optimizations
- Multi-column layouts
- Hover states
- Keyboard shortcuts
- Dense information display

---

## ♿ Accessibility Guidelines

### Keyboard Navigation
- All interactive elements keyboard accessible
- Tab order logical
- Focus indicators visible
- Escape key closes modals
- Enter/Space activates buttons

### Screen Readers
- Proper ARIA labels
- Semantic HTML
- Alt text for images
- Form labels associated with inputs
- Error messages announced

### Color Contrast
- Text meets WCAG AA (4.5:1)
- Interactive elements meet WCAG AA (3:1)
- Don't rely on color alone for information

### Focus Management
- Focus trap in modals
- Focus return after modal close
- Visible focus indicators
- Skip links for navigation

---

## 🎨 Admin Portal Specific Patterns

### Dashboard
- **Stats at top**: Key metrics visible immediately
- **Charts in middle**: Visual data representation
- **Activity at bottom**: Recent actions/updates
- **Quick actions**: Common tasks easily accessible

### Data Management
- **Search/filter**: Always visible at top
- **Bulk actions**: Checkbox selection for multiple items
- **Pagination**: Clear navigation through pages
- **Export options**: Download data functionality

### Forms
- **Progressive disclosure**: Show advanced options on demand
- **Inline validation**: Real-time feedback
- **Save drafts**: Auto-save or draft functionality
- **Confirmation dialogs**: For destructive actions

### Tables
- **Sortable columns**: Click to sort
- **Row selection**: Checkbox for bulk actions
- **Row actions**: Dropdown menu per row
- **Expandable rows**: Show details inline

---

## 🎯 Performance Guidelines

### Optimization
- Lazy load heavy components
- Code splitting for routes
- Optimize images (Next.js Image)
- Minimize re-renders (React.memo, useMemo)
- Virtual scrolling for long lists

### Loading States
- Show loading indicators immediately
- Use skeleton loaders for content
- Progressive loading for large datasets
- Optimistic updates where appropriate

### Animation Performance
- Use CSS transforms (not position)
- GPU acceleration (`transform: translateZ(0)`)
- Reduce backdrop-filter on mobile
- Debounce scroll/resize handlers

---

## 📋 Checklist for New Pages

### Design Checklist
- [ ] Matches DNCWebsite glassmorphism aesthetic
- [ ] Responsive on all screen sizes
- [ ] Accessible (keyboard navigable, screen reader friendly)
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Empty states designed
- [ ] Consistent spacing and typography
- [ ] Proper visual hierarchy
- [ ] Clear CTAs and actions

### Functionality Checklist
- [ ] Forms validated
- [ ] API calls error handled
- [ ] Loading states shown
- [ ] Success/error feedback provided
- [ ] Keyboard shortcuts (if applicable)
- [ ] Mobile touch interactions work
- [ ] Performance optimized

---

## 📚 Reference Examples

### Login Page
- Clean, centered layout
- Glass card container
- Clear form fields
- Primary action button
- Error handling

### Dashboard
- Stats cards grid
- Charts/graphs
- Recent activity table
- Quick actions
- Responsive layout

### Data Table Page
- Search/filter at top
- Table with glass styling
- Pagination at bottom
- Row actions
- Bulk selection

### Form Page
- Clear form layout
- Validation feedback
- Save/cancel actions
- Success/error states
- Responsive design

---

**Last Updated**: January 2025  
**UI/UX Guidelines Version**: 1.0.0
