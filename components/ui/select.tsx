'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Trigger variants mirror the two shapes the app already had: `field` matches
 * `.field input`, `inline` matches the toolbar and topbar controls.
 */
const selectTriggerVariants = cva(
  "group/select flex items-center gap-2 rounded-md border border-border text-foreground whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 data-[popup-open]:border-ring data-disabled:pointer-events-none data-disabled:opacity-55 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Same metrics as `.field input`: 40px tall, 14px type on the page ground. */
        field: 'w-full justify-between bg-background px-3 text-[length:var(--fs-md)] hover:border-accent/50',
        /* Same metrics as the old toolbar control: card ground, 13px type. */
        inline: 'justify-between bg-card px-3 text-[length:var(--fs-sm)] hover:border-accent/50',
      },
      size: {
        default: 'h-10',
        sm: 'h-8 px-2.5 text-[length:var(--fs-xs)]',
      },
    },
    defaultVariants: { variant: 'field', size: 'default' },
  },
)

function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root {...props} />
}

function SelectTrigger({
  className,
  variant,
  size,
  children,
  ...props
}: SelectPrimitive.Trigger.Props & VariantProps<typeof selectTriggerVariants>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        data-slot="select-icon"
        className="text-muted-foreground transition-transform duration-150 group-data-[popup-open]/select:rotate-180"
      >
        <ChevronDown />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        'min-w-0 truncate text-left data-[placeholder]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Portal, positioner and popup in one part, the way shadcn ships it.
 * `alignItemWithTrigger` is off so the popup always drops below the trigger
 * instead of overlaying it.
 */
function SelectContent({
  className,
  children,
  sideOffset = 4,
  align = 'start',
  ...props
}: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        data-slot="select-positioner"
        sideOffset={sideOffset}
        align={align}
        alignItemWithTrigger={false}
        className="z-60"
        {...props}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'max-h-[min(24rem,var(--available-height))] w-max max-w-[min(24rem,var(--available-width))] min-w-[max(12rem,var(--anchor-width))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1 text-foreground shadow-[0_8px_24px_hsl(var(--foreground)/.12)] origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0',
            className,
          )}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "grid grid-cols-[1rem_1fr] items-center gap-2 rounded-md py-2 pr-3 pl-2 text-[length:var(--fs-sm)] text-muted-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-55 data-highlighted:bg-muted data-highlighted:text-foreground data-selected:text-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator data-slot="select-item-indicator" className="text-accent">
        <Check className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText data-slot="select-item-text" className="whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn('py-1', className)} {...props} />
}

function SelectGroupLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-group-label"
      className={cn(
        'px-2 py-1.5 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  selectTriggerVariants,
  SelectValue,
}
