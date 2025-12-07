# Yuki UI Component Library
## Glassmorphism Components for Admin Portal

This document provides detailed specifications for all UI components in the Yuki admin portal, matching the DNCWebsite design system.

---

## 📦 Core Components

### GlassCard

**Purpose**: Primary container component for all content cards

**Props**:
```typescript
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;      // Enable hover effects (default: true)
  delay?: number;       // Animation delay in ms (default: 0)
  variant?: 'default' | 'elevated' | 'compact';
}
```

**Usage**:
```tsx
<GlassCard hover={true} variant="default">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</GlassCard>
```

**Styles**:
- Background: `rgba(255, 255, 255, 0.85)`
- Backdrop blur: `blur(24px) saturate(180%)`
- Border: `1px solid rgba(0, 0, 0, 0.08)`
- Border radius: `2rem` (32px)
- Padding: `2rem` (32px)
- Shadow: `0 8px 32px 0 rgba(0, 0, 0, 0.08)`

**Variants**:
- **default**: Standard glass card
- **elevated**: Higher shadow, more blur
- **compact**: Reduced padding (`p-4` instead of `p-8`)

---

### GlassButton

**Purpose**: Primary button component with glass styling

**Props**:
```typescript
interface GlassButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}
```

**Usage**:
```tsx
<GlassButton variant="primary" size="md" onClick={handleClick}>
  Submit
</GlassButton>
```

**Variants**:
- **primary**: Blue background (`rgba(37, 99, 235, 0.9)`)
- **secondary**: Glass effect with foreground text
- **ghost**: Transparent with hover effect
- **orange**: DNC brand orange (`rgba(255, 179, 0, 0.9)`)

**Sizes**:
- **sm**: `px-4 py-2 text-sm`
- **md**: `px-6 py-3 text-base` (default)
- **lg**: `px-8 py-4 text-lg`

**Styles**:
- Border radius: `1.5rem` (24px)
- Font weight: `600`
- Transition: `all 0.4s cubic-bezier(0.4, 0, 0.2, 1)`
- Hover: `translateY(-2px) scale(1.02)`

---

### GlassInput

**Purpose**: Text input with glass styling

**Props**:
```typescript
interface GlassInputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}
```

**Usage**:
```tsx
<GlassInput
  type="text"
  placeholder="Enter name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

**Styles**:
- Background: `rgba(255, 255, 255, 0.7)`
- Border: `1px solid rgba(255, 255, 255, 0.8)`
- Border radius: `1.25rem` (20px)
- Padding: `0.75rem 1.25rem`
- Focus: `scale(1.02)` with blue border

---

### GlassTextarea

**Purpose**: Multi-line text input with glass styling

**Props**:
```typescript
interface GlassTextareaProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}
```

**Usage**:
```tsx
<GlassTextarea
  placeholder="Enter description"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={4}
/>
```

**Styles**: Same as GlassInput

---

### GlassSelect

**Purpose**: Dropdown select with glass styling

**Props**:
```typescript
interface GlassSelectProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  children: ReactNode;
}
```

**Usage**:
```tsx
<GlassSelect value={status} onChange={(e) => setStatus(e.target.value)}>
  <option value="">Select status</option>
  <option value="pending">Pending</option>
  <option value="approved">Approved</option>
</GlassSelect>
```

**Styles**: Same as GlassInput

---

### GlassCheckbox

**Purpose**: Checkbox input with glass styling

**Props**:
```typescript
interface GlassCheckboxProps {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  label?: string;
}
```

**Usage**:
```tsx
<GlassCheckbox
  checked={isChecked}
  onChange={(e) => setIsChecked(e.target.checked)}
  label="I agree to the terms"
/>
```

---

### GlassRadio

**Purpose**: Radio button input with glass styling

**Props**:
```typescript
interface GlassRadioProps {
  value?: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  label?: string;
}
```

**Usage**:
```tsx
<GlassRadio
  value="option1"
  checked={selected === "option1"}
  onChange={(e) => setSelected(e.target.value)}
  label="Option 1"
/>
```

---

## 🎯 Admin-Specific Components

### GlassTable

**Purpose**: Data table with glass styling

**Props**:
```typescript
interface GlassTableProps {
  data: any[];
  columns: ColumnDef[];
  className?: string;
  onRowClick?: (row: any) => void;
  loading?: boolean;
}
```

**Usage**:
```tsx
<GlassTable
  data={employees}
  columns={employeeColumns}
  onRowClick={(row) => handleRowClick(row)}
/>
```

**Styles**:
- Container: GlassCard wrapper
- Header: Glass background with subtle border
- Rows: Hover effect with glass highlight
- Borders: Subtle glass borders

---

### GlassModal

**Purpose**: Modal dialog with glass backdrop

**Props**:
```typescript
interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}
```

**Usage**:
```tsx
<GlassModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit Employee"
  size="md"
>
  <form>...</form>
</GlassModal>
```

**Styles**:
- Backdrop: `rgba(0, 0, 0, 0.5)` with blur
- Container: GlassCard styling
- Border radius: `2rem` (32px)
- Padding: `2rem` (32px)

---

### GlassAlert

**Purpose**: Alert/notification with glass styling

**Props**:
```typescript
interface GlassAlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}
```

**Usage**:
```tsx
<GlassAlert
  variant="success"
  title="Success"
  message="Employee updated successfully"
  onClose={() => setAlert(null)}
/>
```

**Variants**:
- **success**: Green accent
- **error**: Red accent
- **warning**: Yellow accent
- **info**: Blue accent

---

### GlassBadge

**Purpose**: Status badge with glass styling

**Props**:
```typescript
interface GlassBadgeProps {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<GlassBadge variant="success">Approved</GlassBadge>
```

---

### GlassSpinner

**Purpose**: Loading spinner with glass styling

**Props**:
```typescript
interface GlassSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Usage**:
```tsx
<GlassSpinner size="md" />
```

---

### GlassSkeleton

**Purpose**: Loading skeleton with glass styling

**Props**:
```typescript
interface GlassSkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}
```

**Usage**:
```tsx
<GlassSkeleton width="100%" height="20px" variant="text" />
```

---

## 📊 Dashboard Components

### StatCard

**Purpose**: Display statistics/metrics in glass card

**Props**:
```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;        // Percentage change
  trend?: 'up' | 'down'; // Trend direction
  icon?: ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<StatCard
  title="Total Employees"
  value={150}
  change={12}
  trend="up"
  icon={<UsersIcon />}
/>
```

---

### ChartContainer

**Purpose**: Container for charts with glass styling

**Props**:
```typescript
interface ChartContainerProps {
  title?: string;
  children: ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<ChartContainer title="Hours by Week">
  <LineChart data={chartData} />
</ChartContainer>
```

---

## 🎨 Layout Components

### GlassNavbar

**Purpose**: Navigation bar with glass styling

**Props**:
```typescript
interface GlassNavbarProps {
  logo?: ReactNode;
  items: NavItem[];
  user?: User;
  onLogout?: () => void;
  className?: string;
}
```

**Usage**:
```tsx
<GlassNavbar
  logo={<Logo />}
  items={navItems}
  user={currentUser}
  onLogout={handleLogout}
/>
```

**Styles**:
- Background: `rgba(255, 255, 255, 0.9)`
- Backdrop blur: `blur(20px) saturate(180%)`
- Border radius: `2rem` (32px)
- Sticky positioning

---

### GlassSidebar

**Purpose**: Sidebar navigation with glass styling

**Props**:
```typescript
interface GlassSidebarProps {
  items: NavItem[];
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}
```

**Usage**:
```tsx
<GlassSidebar
  items={sidebarItems}
  isOpen={isSidebarOpen}
  onClose={() => setIsSidebarOpen(false)}
/>
```

---

### PageContainer

**Purpose**: Main page container with consistent spacing

**Props**:
```typescript
interface PageContainerProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}
```

**Usage**:
```tsx
<PageContainer maxWidth="7xl">
  <h1>Dashboard</h1>
  <DashboardContent />
</PageContainer>
```

---

## 📋 Form Components

### FormField

**Purpose**: Form field wrapper with label and error

**Props**:
```typescript
interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<FormField label="Email" error={errors.email} required>
  <GlassInput type="email" {...register('email')} />
</FormField>
```

---

### FormGroup

**Purpose**: Group of form fields

**Props**:
```typescript
interface FormGroupProps {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}
```

**Usage**:
```tsx
<FormGroup columns={2}>
  <FormField label="First Name">...</FormField>
  <FormField label="Last Name">...</FormField>
</FormGroup>
```

---

## 🎯 Component Implementation Notes

### Animation
- Use Framer Motion for all animations
- Standard transition: `0.4s cubic-bezier(0.4, 0, 0.2, 1)`
- Hover effects: `translateY(-2px) scale(1.02)`

### Accessibility
- All interactive elements must be keyboard accessible
- Proper ARIA labels for screen readers
- Focus states clearly visible
- WCAG 2.1 AA compliant

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly targets (minimum 44px × 44px)

### Performance
- Lazy load heavy components
- Optimize backdrop-filter usage
- Use CSS transforms for animations
- GPU acceleration for smooth animations

---

## 📚 Component Examples

### Login Page
```tsx
<PageContainer maxWidth="md">
  <GlassCard className="max-w-md mx-auto">
    <h1 className="text-3xl font-bold mb-6">Login</h1>
    <form className="space-y-4">
      <FormField label="Email" required>
        <GlassInput type="email" />
      </FormField>
      <FormField label="Password" required>
        <GlassInput type="password" />
      </FormField>
      <GlassButton type="submit" variant="primary" className="w-full">
        Sign In
      </GlassButton>
    </form>
  </GlassCard>
</PageContainer>
```

### Dashboard
```tsx
<PageContainer maxWidth="7xl">
  <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <StatCard title="Employees" value={150} change={12} trend="up" />
    <StatCard title="Hours This Week" value={1240} change={5} trend="up" />
    <StatCard title="Pending Approvals" value={8} change={-2} trend="down" />
    <StatCard title="Invoices" value={45} change={10} trend="up" />
  </div>
  <GlassCard>
    <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
    <GlassTable data={recentActivity} columns={activityColumns} />
  </GlassCard>
</PageContainer>
```

### Data Table
```tsx
<GlassCard>
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-2xl font-bold">Employees</h2>
    <GlassButton variant="primary">Add Employee</GlassButton>
  </div>
  <GlassInput
    type="text"
    placeholder="Search employees..."
    className="mb-4"
  />
  <GlassTable
    data={employees}
    columns={employeeColumns}
    onRowClick={(row) => handleRowClick(row)}
  />
</GlassCard>
```

---

**Last Updated**: January 2025  
**Component Library Version**: 1.0.0
