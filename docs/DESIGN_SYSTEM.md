# Yuki Design System
## Matching DNCWebsite Glassmorphism Aesthetic

**Domain**: `yuki.discover-nocode.com`  
**Purpose**: Business Administration Portal  
**Design Theme**: Liquid Glass / Glassmorphism (matching DNCWebsite)

---

## 🎨 Design Vision

### Design Principles
- **Glassmorphism/Liquid Glass Aesthetic**: Frosted glass effects with subtle transparency, blur, and depth
- **Modern & Premium**: Sleek, sophisticated interface that reflects professionalism
- **Performance-First**: Lightning-fast load times with optimized assets
- **Mobile-First**: Responsive design that works beautifully on all devices
- **Accessibility**: WCAG 2.1 AA compliant
- **Business-Focused**: Clean, functional interface optimized for administrative tasks

### Visual Elements
- **Glass Cards**: Frosted glass containers with backdrop-filter blur
- **Gradient Overlays**: Subtle gradients for depth and visual interest
- **Smooth Animations**: Micro-interactions and transitions
- **Floating Elements**: Cards that appear to float above the background
- **Accent Colors**: Blue, purple, and pink gradients matching DNCWebsite
- **Light Mode Only**: Clean, professional light theme (matching DNCWebsite)

---

## 🎨 Color Palette

### Base Colors
```css
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
```

### Background Gradient
```css
/* Light mode background - Clean education theme */
background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
background-attachment: fixed;
```

### Background Overlay (Radial Gradients)
```css
background: 
  radial-gradient(circle at 20% 50%, rgba(37, 99, 235, 0.04) 0%, transparent 50%),
  radial-gradient(circle at 80% 80%, rgba(124, 58, 237, 0.04) 0%, transparent 50%),
  radial-gradient(circle at 40% 20%, rgba(219, 39, 119, 0.03) 0%, transparent 50%);
```

### Button Colors
- **Primary Button**: `rgba(37, 99, 235, 0.9)` (Blue) - `#2563eb`
- **Orange Button** (DNC Brand): `rgba(255, 179, 0, 0.9)` - `#FFB300`
- **Secondary Button**: Glass effect with foreground text

---

## 📐 Typography

### Font Family
- **Primary Font**: Montserrat (via `--font-montserrat`)
- **Monospace Font**: Geist Mono (via `--font-geist-mono`)
- **Fallback**: `system-ui, sans-serif`

### Font Sizes
```css
/* Headings */
h1: text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl (font-bold)
h2: text-3xl sm:text-4xl md:text-5xl lg:text-6xl (font-bold)
h3: text-2xl sm:text-3xl md:text-4xl (font-bold)
h4: text-xl sm:text-2xl md:text-3xl (font-semibold)
h5: text-lg sm:text-xl md:text-2xl (font-semibold)
h6: text-base sm:text-lg md:text-xl (font-semibold)

/* Body Text */
body: base font size (16px)
small: text-sm
large: text-lg
```

### Font Weights
- **Bold**: `font-bold` (700) - Headings
- **Semibold**: `font-semibold` (600) - Subheadings, buttons
- **Medium**: `font-medium` (500) - Navigation, emphasis
- **Regular**: `font-normal` (400) - Body text

### Line Heights
- **Headings**: `leading-[1.1]` or `leading-tight`
- **Body**: `leading-relaxed` (1.8) or default
- **Compact**: `leading-normal` (1.5)

---

## 🎭 Glass Morphism Components

### Glass Card
```css
.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 2rem; /* 32px - heavily rounded */
  padding: 2rem;
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 
    0 20px 60px 0 rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset;
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.95);
}
```

### Glass Button
```css
.glass-button {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 1.5rem; /* 24px */
  padding: 0.875rem 2rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 
    0 4px 16px 0 rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 
    0 8px 24px 0 rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset;
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.95);
}
```

### Glass Input
```css
.glass-input {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 1.25rem; /* 20px */
  padding: 0.75rem 1.25rem;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 4px 16px 0 rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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
```

### Glass Navbar
```css
.glass-navbar {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 2rem; /* 32px */
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.02) inset;
}
```

---

## 📏 Spacing System

### Tailwind Spacing Scale
```css
/* Base spacing unit: 4px */
0: 0px
1: 0.25rem (4px)
2: 0.5rem (8px)
3: 0.75rem (12px)
4: 1rem (16px)
5: 1.25rem (20px)
6: 1.5rem (24px)
8: 2rem (32px)
10: 2.5rem (40px)
12: 3rem (48px)
16: 4rem (64px)
20: 5rem (80px)
24: 6rem (96px)
```

### Component Padding
- **Glass Cards**: `p-8` (2rem / 32px)
- **Glass Buttons**: `px-8 py-3` (horizontal: 2rem, vertical: 0.75rem)
- **Glass Inputs**: `px-5 py-3` (horizontal: 1.25rem, vertical: 0.75rem)
- **Navbar**: `px-4 sm:px-6 md:px-8 py-3` (responsive)

### Component Gaps
- **Card Grid**: `gap-6` (1.5rem / 24px)
- **Flex Items**: `gap-4` (1rem / 16px)
- **Form Fields**: `gap-4` (1rem / 16px)
- **Section Spacing**: `space-y-12` (3rem / 48px)

---

## 🎯 Border Radius

### Standard Radius Values
```css
/* Heavily rounded corners (DNCWebsite style) */
--radius-sm: 0.5rem;    /* 8px */
--radius-md: 1rem;     /* 16px */
--radius-lg: 1.5rem;    /* 24px */
--radius-xl: 2rem;      /* 32px - heavily rounded (default for cards) */
--radius-2xl: 3rem;     /* 48px - extra rounded */
```

### Component Radius
- **Glass Cards**: `rounded-3xl` (2rem / 32px)
- **Glass Buttons**: `rounded-2xl` (1.5rem / 24px)
- **Glass Inputs**: `rounded-xl` (1.25rem / 20px)
- **Navbar**: `rounded-3xl` (2rem / 32px)
- **Modals/Dialogs**: `rounded-3xl` (2rem / 32px)

---

## 🌊 Shadows

### Shadow System
```css
/* Glass Card Shadow */
box-shadow: 
  0 8px 32px 0 rgba(0, 0, 0, 0.08),
  0 0 0 1px rgba(0, 0, 0, 0.02) inset;

/* Glass Card Hover Shadow */
box-shadow: 
  0 20px 60px 0 rgba(0, 0, 0, 0.12),
  0 0 0 1px rgba(0, 0, 0, 0.05) inset;

/* Glass Button Shadow */
box-shadow: 
  0 4px 16px 0 rgba(0, 0, 0, 0.06),
  0 0 0 1px rgba(0, 0, 0, 0.02) inset;

/* Glass Button Hover Shadow */
box-shadow: 
  0 8px 24px 0 rgba(0, 0, 0, 0.12),
  0 0 0 1px rgba(0, 0, 0, 0.05) inset;
```

---

## ✨ Animations & Transitions

### Transition Timing
```css
/* Standard transition */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

/* Fast transition */
transition: all 0.2s ease-out;

/* Smooth easing */
cubic-bezier(0.4, 0, 0.2, 1)
```

### Hover Effects
- **Cards**: `translateY(-6px) scale(1.01)`
- **Buttons**: `translateY(-2px) scale(1.02)`
- **Inputs**: `scale(1.02)` on focus

### Framer Motion Defaults
```typescript
// Standard animation
motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: "easeOut" }}

// Hover animation
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

---

## 📱 Responsive Breakpoints

### Tailwind Breakpoints
```css
sm: 640px   /* Small devices (landscape phones) */
md: 768px   /* Medium devices (tablets) */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X Extra large devices */
```

### Mobile Optimizations
- **Reduced blur on mobile**: `blur(10px)` instead of `blur(20px)`
- **Smaller padding**: Reduce padding by 25% on mobile
- **Touch targets**: Minimum 44px × 44px
- **Font sizes**: Responsive scaling with Tailwind classes

---

## 🎨 Component Variants

### Button Variants
1. **Primary**: Blue background (`rgba(37, 99, 235, 0.9)`)
2. **Secondary**: Glass effect with foreground text
3. **Ghost**: Transparent with hover effect
4. **Orange** (DNC Brand): `rgba(255, 179, 0, 0.9)`

### Button Sizes
- **Small**: `px-4 py-2 text-sm`
- **Medium**: `px-6 py-3 text-base` (default)
- **Large**: `px-8 py-4 text-lg`

### Card Variants
- **Default**: Standard glass card
- **Elevated**: Higher shadow, more blur
- **Compact**: Reduced padding (`p-4` instead of `p-8`)

---

## 🔤 Text Styles

### Text Colors
```css
/* Foreground colors */
text-foreground        /* #1a1a1a */
text-foreground/70     /* 70% opacity */
text-foreground/60     /* 60% opacity */
text-foreground/50     /* 50% opacity */

/* Accent colors */
text-blue-600          /* #2563eb */
text-purple-600        /* #7c3aed */
text-pink-600          /* #db2777 */
```

### Text Utilities
- **Truncate**: `truncate` (ellipsis for overflow)
- **Line Clamp**: `line-clamp-2`, `line-clamp-3`
- **Text Selection**: Custom selection color (`--accent-blue`)

---

## 🎯 Layout Patterns

### Container Widths
```css
/* Max widths */
max-w-sm: 24rem   /* 384px */
max-w-md: 28rem   /* 448px */
max-w-lg: 32rem   /* 512px */
max-w-xl: 36rem   /* 576px */
max-w-2xl: 42rem  /* 672px */
max-w-4xl: 56rem  /* 896px */
max-w-6xl: 72rem  /* 1152px */
max-w-7xl: 80rem  /* 1280px */
```

### Grid Patterns
```css
/* Card grid */
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6

/* Admin table */
grid grid-cols-1 lg:grid-cols-4 gap-4
```

---

## 🎨 Admin Portal Specific Components

### Data Table
- Glass card container
- Glass input for search/filter
- Hover effects on rows
- Action buttons with glass styling

### Form Components
- Glass input fields
- Glass select dropdowns
- Glass checkboxes/radios
- Glass textareas
- Form validation with glass alerts

### Dashboard Cards
- Stat cards with glass effect
- Chart containers with glass background
- Metric displays with glass styling

### Modal/Dialog
- Glass backdrop with blur
- Glass modal container
- Glass close button
- Glass action buttons

---

## 📋 Implementation Checklist

### CSS Setup
- [ ] Copy `globals.css` from DNCWebsite
- [ ] Configure Tailwind with custom theme
- [ ] Set up CSS variables
- [ ] Add glass morphism utilities

### Component Library
- [ ] GlassCard component
- [ ] GlassButton component
- [ ] GlassInput component
- [ ] GlassNavbar component
- [ ] GlassModal component
- [ ] GlassTable component
- [ ] GlassForm components

### Pages
- [ ] Login page with glass styling
- [ ] Dashboard with glass cards
- [ ] Data tables with glass containers
- [ ] Forms with glass inputs
- [ ] Modals with glass backdrop

---

## 🎨 Design Tokens Summary

```typescript
export const designTokens = {
  colors: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    accentBlue: '#2563eb',
    accentPurple: '#7c3aed',
    accentPink: '#db2777',
    orange: '#FFB300',
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.85)',
    blur: 'blur(24px) saturate(180%)',
    border: 'rgba(0, 0, 0, 0.08)',
    borderRadius: '2rem',
  },
  spacing: {
    cardPadding: '2rem',
    buttonPadding: '0.875rem 2rem',
    inputPadding: '0.75rem 1.25rem',
  },
  shadows: {
    card: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
    cardHover: '0 20px 60px 0 rgba(0, 0, 0, 0.12)',
    button: '0 4px 16px 0 rgba(0, 0, 0, 0.06)',
  },
  transitions: {
    default: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    fast: 'all 0.2s ease-out',
  },
};
```

---

## 📚 References

- **DNCWebsite Design**: `/Users/z3thon/Dev Projects/DNCWebsite/website/app/globals.css`
- **Component Examples**: `/Users/z3thon/Dev Projects/DNCWebsite/website/components/ui/`
- **Design Principles**: `/Users/z3thon/Dev Projects/DNCWebsite/milestones.md` (lines 1-20)

---

**Last Updated**: January 2025  
**Design System Version**: 1.0.0
