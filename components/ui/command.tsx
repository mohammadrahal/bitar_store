'use client'

import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A command palette, in the shadcn shape but built on `@base-ui/react`'s
 * Autocomplete rather than cmdk — base-ui is this project's primitive layer
 * (see `components/ui/select.tsx`), and it already owns the parts a palette
 * needs: the input/list relationship, `aria-activedescendant` roving focus and
 * arrow-key navigation.
 *
 * The list is rendered `inline` with `open` held true, so it sits inside the
 * dialog instead of in a popup of its own, and `mode="none"` leaves filtering
 * to the caller: results come from the server, and re-filtering them in the
 * browser would hide matches the API found on fields the browser cannot see,
 * such as a barcode this session has never loaded.
 */
function CommandDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/32 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150" />
        <DialogPrimitive.Popup
          className={cn(
            'fixed left-1/2 top-[12vh] z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2',
            'rounded-lg border border-border bg-card shadow-[0_16px_48px_hsl(var(--foreground)/0.18)]',
            'outline-none data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0',
            'transition-[opacity,scale] duration-150',
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function CommandInput({
  placeholder,
  'aria-label': ariaLabel,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Input>) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4">
      <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <AutocompletePrimitive.Input
        className="h-12 w-full min-w-0 border-0 bg-transparent text-[length:var(--fs-md)] text-foreground outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        aria-label={ariaLabel}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof AutocompletePrimitive.List>) {
  return (
    <AutocompletePrimitive.List
      className={cn('max-h-[min(380px,60vh)] overflow-y-auto overscroll-contain p-2', className)}
      {...props}
    />
  )
}

function CommandGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-2 text-[length:var(--fs-xs)] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  )
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof AutocompletePrimitive.Item>) {
  return (
    <AutocompletePrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2 text-[length:var(--fs-sm)] text-foreground',
        'data-[highlighted]:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function CommandEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-6 text-center text-[length:var(--fs-sm)] text-muted-foreground">{children}</p>
}

function CommandFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[length:var(--fs-xs)] text-muted-foreground">
      {children}
    </div>
  )
}

/** A keyboard hint rendered as a key cap. */
function CommandKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[length:var(--fs-xs)] text-muted-foreground">
      {children}
    </kbd>
  )
}

export const Command = {
  Root: AutocompletePrimitive.Root,
  Dialog: CommandDialog,
  Input: CommandInput,
  List: CommandList,
  GroupLabel: CommandGroupLabel,
  Item: CommandItem,
  Empty: CommandEmpty,
  Footer: CommandFooter,
  Key: CommandKey,
}
