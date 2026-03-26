---
description: Swarm Resistance design system -- auth UI patterns, dark gaming theme, accessibility, animations
---

You are building UI for **Swarm Resistance**, a dark sci-fi Web3 gaming platform. Follow this design system exactly. Do not invent new colors, fonts, or patterns -- use what exists.

---

## Color System

### Backgrounds
- **Page background:** `bg-void-primary` (#0F0F23) with subtle radial gradients (phoenix 5% opacity at 20% 30%, resistance 8% at 80% 70%)
- **Card/panel background:** `bg-[#0f1f38]` or `bg-void-secondary` (#1A1A2E)
- **Glass panels:** `glass-cyan` / `glass-resistance` (rgba + backdrop-blur)
- **Elevated surfaces:** Use `hologram` class (rgba(59,130,246,0.1) + blur)

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `phoenix-primary` | #FF8C00 | Primary CTA, highlights, energy |
| `phoenix-light` | #FFB84D | Gradients, hover states |
| `resistance-light` | #3B82F6 | Secondary actions, borders, links |
| `resistance-glow` | #60A5FA | Hover glows, active states |
| `hud-cyan` | #22d3ee | HUD elements, tech borders, input focus |
| `energy-green` / `success-green` | #22C55E | Success states |
| `warning-orange` | #FB923C | Warnings |
| Red 500 | #EF4444 | Errors, destructive actions |
| `energy-purple` | #8B5CF6 | Energy bars, special elements |

### Text Colors
- **Primary text:** `text-white` or `text-stellar-white`
- **Secondary text:** `text-gray-300`
- **Muted text:** `text-gray-400` / `text-neutral-light`
- **Accent text:** `text-cyan-400` / `text-phoenix-primary`
- **Error text:** `text-red-400`

---

## Typography

### Font Families
- **Headings / tech labels:** `font-orbitron` (Orbitron, monospace) -- always with `tracking-wide` or `tracking-widest`
- **Body text:** `font-inter` (Inter, sans-serif) -- default, no class needed
- **Data / code values:** `font-jetbrains` (JetBrains Mono)
- **Alternative headings:** `font-exo` (Exo 2) -- used sparingly

### Responsive Sizes (use these Tailwind classes)
- Hero heading: `text-heading-xl` (clamp 2rem-3.5rem)
- Section heading: `text-heading-lg` (clamp 1.75rem-2.5rem)
- Card heading: `text-heading-md` (clamp 1.5rem-1.875rem)
- Sub-heading: `text-heading-sm` (clamp 1.125rem-1.25rem)
- Body: `text-body-md` (1rem) or `text-body-lg` (clamp 1rem-1.125rem)
- Small/caption: `text-body-sm` (0.875rem) or `text-caption` (0.75rem)

### Text Effects
- Phoenix gradient: `text-phoenix-gradient` (CSS class, gradient text fill)
- Glow: `text-shadow-phoenix` / `text-shadow-resistance` / `text-shadow-hologram`

---

## Component Patterns

### Buttons
Use the existing `<Button>` component from `components/elements/Button.jsx`:
```jsx
<Button variant="primary" size="md">Connect Wallet</Button>   // Phoenix orange gradient
<Button variant="secondary" size="md">Cancel</Button>          // Blue outline
<Button variant="danger" size="sm">Disconnect</Button>         // Red
```

**Button rules:**
- Always `font-orbitron tracking-widest uppercase`
- Corner bracket decorators: `< text >` (built into Button component)
- Corner accent elements on all 4 corners (built in)
- Min-height 44px (touch target -- WCAG)
- Hover: `scale(1.05) translateY(-2px)` + shadow glow
- Tap: `scale(0.95)`
- Disabled: `opacity-50 cursor-not-allowed`, no hover effects
- Loading state: swap text for spinner icon, keep button width stable

**CSS button classes** (when not using the component):
- `.btn-phoenix-primary` -- orange gradient, dark text
- `.btn-resistance-secondary` -- transparent, blue border
- `.btn-phoenix-primary-glass` / `.btn-secondary-glass` -- frosted glass variants

### Cards / Panels
Use `<HUDCard>` from `components/elements/Card.jsx`:
```jsx
<HUDCard color="cyan">...</HUDCard>
<HUDCard color="orange" borderAnimation>...</HUDCard>
```

**Card rules:**
- `backdrop-blur-lg` + colored border at 30% opacity
- 4 corner accents (positioned absolute, border + glow dot)
- Edge accents on sides
- Hover: `translateY(-4px) scale(1.02)` + border brightens
- Content padding: `p-4 md:p-6`

**CSS card classes:**
- `.phoenix-card` -- orange-tinted glass
- `.resistance-card` -- blue-tinted glass
- `.hologram-card` -- standard HUD panel

### Modals (Auth-critical)
```
Structure:
  AnimatePresence
    motion.div (backdrop)  -- fixed inset-0 z-50 bg-black/80 backdrop-blur-sm
      motion.div (modal)   -- relative, centered, max-w-sm/md, rounded-lg
        Header             -- bg-[#0f1f38] border-b border-cyan-500/30 px-5 py-4
        Content            -- p-5 bg-void-primary
        Footer/Actions     -- px-5 pb-5, flex gap-3
```

**Modal animations:**
```jsx
// Backdrop
initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}

// Modal panel
initial={{ opacity: 0, scale: 0.9, y: -10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.9, y: -10 }}
transition={{ duration: 0.3 }}
```

**Modal rules:**
- Close on backdrop click (onClick on backdrop div)
- Close on Escape key (`useEffect` with keydown listener)
- Trap focus inside modal (first focusable element on open)
- Prevent body scroll when open (`overflow-hidden` on body)
- Mobile: modal should be near-full-width with `mx-4`
- Title: `font-orbitron text-cyan-400 text-center`

### Inputs / Form Fields (Auth-critical)
```
Standard input classes:
  bg-transparent or bg-[#0f1f38]
  border border-cyan-500/20
  rounded-lg
  px-4 py-3
  text-white placeholder-gray-500
  font-inter text-body-md
  min-h-[44px]
  transition-all duration-300

Focus state:
  focus:border-cyan-500/50
  focus:outline-none
  focus:ring-1 focus:ring-cyan-500/30
  focus:bg-[#0f1f38]

Error state:
  border-red-500/50
  bg-red-500/10
  + error message below in text-red-400 text-body-sm

Disabled state:
  opacity-50 cursor-not-allowed bg-void-secondary
```

**Input rules:**
- Min font 16px on mobile (prevents iOS zoom)
- Always pair with `<label>` (can be sr-only for icon inputs)
- `aria-invalid="true"` + `aria-describedby` linking to error message
- `autocomplete` attribute on all auth inputs (email, password, one-time-code)

### OTP / Code Input Pattern
```jsx
// 6-digit OTP: array of single-char inputs
<div className="flex gap-2 justify-center">
  {[0,1,2,3,4,5].map(i => (
    <input
      key={i}
      type="text"
      inputMode="numeric"
      maxLength={1}
      className="w-12 h-14 text-center text-xl font-jetbrains
                 bg-[#0f1f38] border border-cyan-500/20 rounded-lg
                 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30
                 transition-all duration-200"
      aria-label={`Digit ${i + 1}`}
    />
  ))}
</div>
```
- Auto-advance to next input on digit entry
- Handle paste: distribute digits across inputs
- Backspace: clear current, move to previous
- `inputMode="numeric"` for mobile number pad

---

## Auth-Specific UI Patterns

### Login/Connect Flow States
Design for these states with clear visual transitions:

1. **Idle** -- Primary CTA visible, no loading
2. **Loading** -- Button shows spinner, disable all interactive elements, show status text
3. **Wallet Selection** -- List of wallet options (MetaMask, WalletConnect, Coinbase) as selectable cards
4. **Awaiting Confirmation** -- Pulse animation, "Confirm in your wallet..." message
5. **OTP/Email Verification** -- Code input grid, resend timer, "Check your email" messaging
6. **Success** -- Brief success flash (green glow, checkmark), then redirect
7. **Error** -- Red-bordered message box, retry option, specific error text

### Wallet Option Cards
```jsx
<button className="w-full flex items-center gap-4 p-4
                    bg-[#0f1f38] border border-cyan-500/20 rounded-lg
                    hover:border-cyan-500/40 hover:bg-[#1a2f4a]
                    transition-all duration-300 group">
  <img src={walletIcon} className="w-8 h-8" alt="" />
  <span className="font-inter text-white group-hover:text-cyan-400">MetaMask</span>
  <ChevronRight className="ml-auto text-gray-500 group-hover:text-cyan-400" />
</button>
```

### Status Messages
```
Success: bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3
Warning: bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg p-3
Error:   bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3
Info:    bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg p-3
```

### Loading Spinners
- Use `Loader` icon from lucide-react with `animate-spin`
- Color matches context: cyan for general, phoenix for primary actions
- Size: `w-5 h-5` inline with text, `w-8 h-8` standalone

---

## Accessibility Requirements (Auth forms are critical)

### Focus Management
- Modal open: auto-focus first interactive element
- Modal close: return focus to trigger element
- Tab order must be logical (top-to-bottom, left-to-right)
- Visible focus ring: `ring-1 ring-cyan-500/30` (never `outline-none` without replacement)
- Skip decorative elements in tab order (`tabIndex={-1}`)

### ARIA Labels
- All inputs: `aria-label` or associated `<label>`
- Error messages: `role="alert"` + `aria-live="polite"`
- Loading states: `aria-busy="true"` on container, `aria-label` on spinner
- Modal: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- OTP inputs: `aria-label="Digit N of 6"`
- Wallet buttons: descriptive `aria-label="Connect with MetaMask"`

### Keyboard Navigation
- Enter/Space activates buttons and wallet options
- Escape closes modals and dropdowns
- Tab cycles through focusable elements
- Arrow keys navigate wallet option list
- No keyboard traps -- always escapable

### Screen Reader
- Status changes announced via `aria-live` regions
- "Connecting..." / "Connected successfully" / "Connection failed" announced
- Don't rely on color alone for state (add icons + text)

---

## Responsive Rules

### Breakpoints
```
xs: 475px   -- phone landscape
sm: 640px   -- large phone
md: 768px   -- tablet (bottom nav hides)
lg: 1024px  -- desktop (sidebar appears, content offset 256px)
xl: 1280px  -- wide desktop
3xl: 1920px -- ultrawide
```

### Auth Modal Responsive Behavior
- **Mobile (< md):** Full-width modal with `mx-4`, rounded-lg. Consider bottom-sheet drawer for wallet selection.
- **Tablet (md-lg):** Centered modal, `max-w-sm`
- **Desktop (lg+):** Centered modal, `max-w-md`, account for sidebar offset

### Touch Targets
- All interactive elements: min `44x44px` (WCAG 2.5.5)
- Buttons: min-height already set in `.btn-*` classes
- Links in text: adequate padding or `py-2` wrapper
- `touch-manipulation` on interactive elements (prevents double-tap zoom)

### Mobile-Specific
- Base font: 14px (html scales via media query)
- Reduced blur: `blur(4-6px)` instead of `blur(8-12px)` for performance
- Reduced motion: respect `prefers-reduced-motion` (already in index.css)
- Input font >= 16px to prevent iOS auto-zoom

---

## Animation Standards

### Framer Motion Defaults
```jsx
// Page/section entrance
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, ease: "easeOut" }}

// Staggered children
transition={{ staggerChildren: 0.1 }}

// Button hover
whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(255, 140, 0, 0.4)" }}
whileTap={{ scale: 0.95 }}

// Modal (see Modal section above)
```

### CSS Animations (existing keyframes)
- `animate-pulse-phoenix` -- 2s orange glow pulse
- `animate-pulse-resistance` -- 2s blue glow pulse
- `animate-pulse-cyan` -- 2s cyan glow pulse
- `animate-float` -- 3s gentle float up/down
- `animate-hologram-flicker` -- 3s opacity flicker
- `shimmer` -- 3s gradient sweep (on buttons)

### Timing Guidelines
| Context | Duration | Easing |
|---------|----------|--------|
| Hover/focus | 200-300ms | ease |
| Modal open/close | 300ms | easeOut |
| Page transition | 500ms | easeOut |
| Content reveal | 500ms | easeOut |
| Stagger delay | 100-200ms | -- |
| Loading pulse | 2s | ease-in-out, infinite |
| Background ambient | 3-6s | ease-in-out, infinite |

### Reduced Motion
Already handled globally in index.css:
```css
@media (prefers-reduced-motion: reduce) {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}
```
No additional work needed -- but ensure Framer Motion animations also check:
```jsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Or use framer-motion's useReducedMotion() hook
```

---

## File References

When building auth UI, reuse these existing components from the Swarm Resistance frontend:
- `Button.jsx` -- standard button with all variants
- `Card.jsx` -- HUDCard with corner accents
- `EnergyBar.jsx` -- progress bar pattern
- `PurchaseModal.jsx` -- modal pattern reference
- `Web3AuthProvider.jsx` -- current auth context (being replaced by SignaKit)

### Do NOT
- Invent new colors outside the palette
- Use rounded-full on rectangular containers (use rounded-lg or rounded-xl)
- Skip the corner accent pattern on major cards
- Use white backgrounds anywhere
- Forget `font-orbitron` on headings and labels
- Use raw Tailwind shadows instead of the project's glow/pulse shadows
- Create auth flows without loading + error states
- Hardcode pixel values for responsive layouts (use Tailwind breakpoints)
