# Task: Full-height sidebar + smooth fade-in for data (Bitar frontend)

Two UI changes. Keep the existing architecture rules (component → hook → service). Do not change any data logic.

---

## 1. Sidebar: fill the screen and show every link

**Problem:** the sidebar scrolls with the page and gets cut off. "Users" is half hidden at the bottom, and anything below it is unreachable.

**Fix:**

1. The dashboard shell (`app/(dashboard)/layout.tsx`) becomes a full-viewport layout:
   - Outer wrapper: `flex h-dvh overflow-hidden`
   - Sidebar: `sticky top-0 h-dvh flex flex-col shrink-0`
   - Main column: `flex-1 flex flex-col min-w-0 overflow-hidden`; the page content area inside it gets `flex-1 overflow-y-auto`. Only the content scrolls, never the whole window.
2. Inside the sidebar:
   - Logo block: `shrink-0`
   - Nav list: `flex-1 overflow-y-auto min-h-0`, so if links ever outgrow the screen, the nav scrolls instead of being clipped
   - If there is a footer (user info, collapse button), make it `shrink-0` at the bottom
3. Make the nav items more compact so every link fits on a normal laptop screen (768px tall) without scrolling:
   - Item height around 40px (`h-10`), gap `gap-1`, icon 18px, text `text-sm`
   - Keep the active style exactly as now (brass left border + tinted background)
4. Collapsed state: keep it working. Icons centered, tooltips with the label.
5. Mobile (below `lg`): the sidebar becomes a sheet/drawer opened from a menu button in the header, using the shadcn `Sheet` component. Same nav component inside, so links are defined once.

Check it at 1366×768, 1440×900 and 390×844 (mobile). Every link visible or reachable, no double scrollbars, no horizontal scroll.

---

## 2. Fade-in animations with Framer Motion

Install: `npm i motion` (the current Framer Motion package, imported from `motion/react`). If the project already has `framer-motion`, use that instead and do not install both.

### Shared components

Create `components/motion/` with these, and use only these in screens (no inline motion config scattered around):

```tsx
// components/motion/fade-in.tsx
"use client";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

export function FadeIn({ delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay }}
      {...props}
    />
  );
}
```

```tsx
// components/motion/stagger.tsx
"use client";
import { motion, useReducedMotion } from "motion/react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export function StaggerList({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={container} initial={reduce ? false : "hidden"} animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={item}>{children}</motion.div>;
}
```

For table rows, add `MotionTr` using `motion.tr` with the same `item` variants, and a `MotionTbody` with the `container` variants, so tables keep valid HTML.

### Page transition

Add `app/(dashboard)/template.tsx` that wraps `children` in `<FadeIn>`. A template re-mounts on every route change, so each page fades in when you navigate. Do not put this in `layout.tsx` (layouts don't re-mount).

### Where to use it

- **Page header** (eyebrow, title, description, action button): `FadeIn`
- **Preview banner, filter bar, cards**: `FadeIn` with small increasing delays (0, 0.05, 0.1)
- **Stat cards on the dashboard**: `StaggerList` + `StaggerItem`
- **Table rows** (inventory, products, invoices, transfers, sales, users, receiving, replenishment): `MotionTbody` + `MotionTr`
- **Loading → data:** show the skeleton while TanStack Query is loading, then animate the real rows in. Wrap the switch in `AnimatePresence mode="wait"` with the skeleton fading out (`exit={{ opacity: 0 }}`, 0.15s) so they never overlap.
- **Empty states** ("0 invoices"): `FadeIn`

### Rules

- Only animate `opacity` and `transform`. Never animate height, width or layout on tables.
- Stagger only the **first 20 rows**. Rows after that appear without delay (pass `custom={index}` and set delay to 0 when index ≥ 20), so big tables don't feel slow.
- Do **not** re-animate rows when data refetches in the background or a filter changes. Animate on first load only: key the `MotionTbody` on the query key's identity (e.g. branch + page), not on the data.
- Respect reduced motion (`useReducedMotion`, already in the components above).
- Do not animate the sidebar, header or dialogs beyond what shadcn already does.
- Keep durations under 400ms. It should feel smooth, not slow.

---

## Acceptance checks

- [ ] At 1366×768, every sidebar link (Overview through Users and anything below) is visible without scrolling the page.
- [ ] Scrolling a long table scrolls only the content area. The sidebar and header stay fixed.
- [ ] No double scrollbars, no horizontal scroll at any width.
- [ ] Mobile shows a menu button that opens the same nav in a drawer.
- [ ] Navigating between pages fades the new page in.
- [ ] Tables show the skeleton, then rows fade in with a short stagger, and background refetches don't replay the animation.
- [ ] With "reduce motion" on in the OS, nothing animates.
- [ ] Type check and lint pass.

Reply with the files you changed and a short note for anything you couldn't do.