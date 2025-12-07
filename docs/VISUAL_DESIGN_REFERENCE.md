# Yuki Visual Design Reference
## Complete Visual Specifications & Examples

This document provides comprehensive visual design specifications, code examples, and reference implementations for the Yuki admin portal.

---

## 🎨 Complete CSS Implementation

### Global Styles (`globals.css`)

```css
@import "tailwindcss";

:root {
  /* Light mode only - Education-focused design */
  --background: #ffffff;
  --foreground: #1a1a1a;
  
  /* Glass morphism colors - Light mode optimized */
  --glass-bg-light: rgba(255, 255, 255, 0.85);
  --glass-border-light: rgba(255, 255, 255, 0.9);
  --glass-shadow-light: rgba(0, 0, 0, 0.08);
  
  /* Accent colors - Education theme */
  --accent-blue: #2563eb;
  --accent-purple: #7c3aed;
  --accent-pink: #db2777;
  --accent-orange: #FFB300;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-montserrat);
  --font-mono: var(--font-geist-mono);
}

body {
  color: var(--foreground);
  font-family: var(--font-montserrat), system-ui, sans-serif;
  min-height: 100vh;
  transition: background-color 0.5s ease, color 0.5s ease;
  position: relative;
  overflow-x: hidden;
}

/* Light mode background - Clean education theme */
:root body {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
  background-attachment: fixed;
}

:root body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 50%, rgba(37, 99, 235, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(124, 58, 237, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 40% 20%, rgba(219, 39, 119, 0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Glass morphism utility classes */
.glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
  border-radius: 2rem;
}

.glass-card {
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 2rem;
  padding: 2rem;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
}

.glass-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 
    0 20px 60px 0 rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset;
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.95);
}

.glass-button {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 1.5rem;
  padding: 0.875rem 2rem;
  font-weight: 600;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 
    0 4px 16px 0 rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
}

.glass-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 
    0 8px 24px 0 rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset;
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.95);
}

/* Primary button */
.glass-button.text-white,
.glass-button[class*="!text-white"] {
  background: rgba(37, 99, 235, 0.9);
  border: 1px solid rgba(37, 99, 235, 0.95);
  color: white !important;
}

.glass-button.text-white:hover {
  background: rgba(37, 99, 235, 1);
  border-color: rgba(37, 99, 235, 1);
}

/* Orange button */
.glass-button.orange-button {
  background: rgba(255, 179, 0, 0.9);
  border: 1px solid rgba(255, 179, 0, 0.95);
  color: white !important;
}

.glass-button.orange-button:hover {
  background: rgba(255, 179, 0, 1);
  border-color: rgba(255, 179, 0, 1);
}

.glass-input {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 1.25rem;
  padding: 0.75rem 1.25rem;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 4px 16px 0 rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
}

.glass-input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 
    0 0 0 4px rgba(59, 130, 246, 0.15),
    0 4px 16px 0 rgba(59, 130, 246, 0.2),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset;
  background: rgba(255, 255, 255, 0.85);
  transform: scale(1.02);
}

/* Selection */
::selection {
  background: var(--accent-blue);
  color: white;
}

/* Mobile optimizations */
@media (max-width: 767px) {
  .glass-card {
    padding: 1.5rem;
  }
  
  .glass-button {
    padding: 0.75rem 1.5rem;
  }
  
  .glass,
  .glass-card,
  .glass-button {
    backdrop-filter: blur(10px) saturate(150%);
    -webkit-backdrop-filter: blur(10px) saturate(150%);
  }
}
```

---

## 🎨 Component Code Examples

### GlassCard Component

```tsx
"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  variant?: 'default' | 'elevated' | 'compact';
}

export function GlassCard({
  children,
  className,
  hover = true,
  delay = 0,
  variant = 'default',
}: GlassCardProps) {
  const variants = {
    default: "p-8",
    elevated: "p-8 shadow-xl",
    compact: "p-4",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "glass-card",
        hover && "cursor-pointer",
        variants[variant],
        className
      )}
    >
      {children}
    </motion.div>
  );
}
```

### GlassButton Component

```tsx
"use client";

import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "orange";
  size?: "sm" | "md" | "lg";
}

export function GlassButton({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: GlassButtonProps) {
  const variants = {
    primary: "glass-button text-white border-0 shadow-lg",
    secondary: "glass-button text-foreground",
    ghost: "bg-transparent text-foreground hover:bg-white/10 border-white/20",
    orange: "glass-button orange-button text-white border-0 shadow-lg",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "glass-button font-medium transition-all duration-300",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
```

### GlassInput Component

```tsx
"use client";

import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "glass-input w-full",
            error && "border-red-500 focus:border-red-500",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";
```

### GlassNavbar Component

```tsx
"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { GlassButton } from "./GlassButton";

interface NavItem {
  name: string;
  href: string;
  external?: boolean;
}

interface GlassNavbarProps {
  items?: NavItem[];
  logo?: React.ReactNode;
  user?: {
    name: string;
    email: string;
  };
  onLogout?: () => void;
}

export function GlassNavbar({
  items = [],
  logo,
  user,
  onLogout,
}: GlassNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-50 max-w-7xl w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)]",
        scrolled ? "top-2" : "top-3"
      )}
    >
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass border backdrop-blur-xl bg-white/90 shadow-lg w-full rounded-3xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3">
          <div className="flex items-center justify-between min-h-14 gap-4">
            {/* Logo */}
            {logo && (
              <Link href="/" className="flex items-center group flex-shrink-0">
                {logo}
              </Link>
            )}

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4 flex-1 justify-center">
              {items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative",
                      isActive
                        ? "text-foreground bg-white/10"
                        : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {item.name}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* User Menu / Actions */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="text-sm text-foreground/70 hidden sm:block">
                    {user.name}
                  </span>
                  <GlassButton variant="secondary" size="sm" onClick={onLogout}>
                    Logout
                  </GlassButton>
                </>
              ) : (
                <GlassButton variant="primary" size="sm" asChild>
                  <Link href="/login">Login</Link>
                </GlassButton>
              )}
            </div>
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
```

---

## 📐 Layout Examples

### Login Page

```tsx
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { FormField } from "@/components/ui/FormField";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Login</h1>
        <form className="space-y-4">
          <FormField label="Email" required>
            <GlassInput type="email" placeholder="admin@discover-nocode.com" />
          </FormField>
          <FormField label="Password" required>
            <GlassInput type="password" placeholder="Enter password" />
          </FormField>
          <GlassButton variant="primary" className="w-full" type="submit">
            Sign In
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  );
}
```

### Dashboard Page

```tsx
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { GlassTable } from "@/components/ui/GlassTable";

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8">
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Employees"
          value={150}
          change={12}
          trend="up"
        />
        <StatCard
          title="Hours This Week"
          value={1240}
          change={5}
          trend="up"
        />
        <StatCard
          title="Pending Approvals"
          value={8}
          change={-2}
          trend="down"
        />
        <StatCard
          title="Invoices"
          value={45}
          change={10}
          trend="up"
        />
      </div>

      {/* Recent Activity */}
      <GlassCard>
        <h2 className="text-2xl font-bold mb-4 text-foreground">
          Recent Activity
        </h2>
        <GlassTable
          data={recentActivity}
          columns={activityColumns}
        />
      </GlassCard>
    </div>
  );
}
```

### Data Table Page

```tsx
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassTable } from "@/components/ui/GlassTable";
import { useState } from "react";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-foreground">Employees</h1>
        <GlassButton variant="primary">Add Employee</GlassButton>
      </div>

      <GlassCard>
        <div className="mb-4">
          <GlassInput
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />
        </div>
        <GlassTable
          data={filteredEmployees}
          columns={employeeColumns}
          onRowClick={(row) => handleRowClick(row)}
        />
      </GlassCard>
    </div>
  );
}
```

---

## 🎨 Color Palette Reference

### Primary Colors
```css
/* Blue - Primary Actions */
--accent-blue: #2563eb;
rgba(37, 99, 235, 0.9)  /* Button background */
rgba(37, 99, 235, 0.15) /* Focus ring */

/* Purple - Accent */
--accent-purple: #7c3aed;
rgba(124, 58, 237, 0.04) /* Background gradient */

/* Pink - Accent */
--accent-pink: #db2777;
rgba(219, 39, 119, 0.03) /* Background gradient */

/* Orange - DNC Brand */
--accent-orange: #FFB300;
rgba(255, 179, 0, 0.9)   /* Button background */
```

### Status Colors
```css
/* Success */
--success: #10b981;
rgba(16, 185, 129, 0.1)  /* Background */
rgba(16, 185, 129, 1)    /* Text/Border */

/* Error */
--error: #ef4444;
rgba(239, 68, 68, 0.1)   /* Background */
rgba(239, 68, 68, 1)     /* Text/Border */

/* Warning */
--warning: #f59e0b;
rgba(245, 158, 11, 0.1)  /* Background */
rgba(245, 158, 11, 1)    /* Text/Border */

/* Info */
--info: #3b82f6;
rgba(59, 130, 246, 0.1)  /* Background */
rgba(59, 130, 246, 1)    /* Text/Border */
```

---

## 📐 Spacing Reference

### Component Padding
```css
/* Cards */
.glass-card {
  padding: 2rem; /* 32px */
}

/* Buttons */
.glass-button {
  padding: 0.875rem 2rem; /* 14px vertical, 32px horizontal */
}

/* Inputs */
.glass-input {
  padding: 0.75rem 1.25rem; /* 12px vertical, 20px horizontal */
}
```

### Layout Spacing
```css
/* Page container */
max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8

/* Section spacing */
mb-8  /* 32px between sections */
space-y-8  /* 32px vertical spacing */

/* Card grid */
gap-6  /* 24px between cards */

/* Form fields */
gap-4  /* 16px between fields */
space-y-4  /* 16px vertical spacing */
```

---

## 🎯 Typography Reference

### Font Sizes
```css
/* Headings */
h1: text-4xl md:text-5xl lg:text-6xl  /* 36px - 60px */
h2: text-3xl md:text-4xl lg:text-5xl  /* 30px - 48px */
h3: text-2xl md:text-3xl lg:text-4xl  /* 24px - 36px */
h4: text-xl md:text-2xl lg:text-3xl   /* 20px - 30px */

/* Body */
body: text-base  /* 16px */
small: text-sm   /* 14px */
large: text-lg   /* 18px */
```

### Font Weights
```css
font-bold: 700      /* Headings */
font-semibold: 600  /* Subheadings, buttons */
font-medium: 500    /* Navigation, emphasis */
font-normal: 400    /* Body text */
```

---

## 🎨 Animation Reference

### Standard Transitions
```css
/* Default */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

/* Fast */
transition: all 0.2s ease-out;

/* Smooth */
cubic-bezier(0.4, 0, 0.2, 1)
```

### Framer Motion Examples
```tsx
// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.4 }}
>

// Slide up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4 }}
>

// Hover
<motion.div
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
```

---

**Last Updated**: January 2025  
**Visual Design Reference Version**: 1.0.0
