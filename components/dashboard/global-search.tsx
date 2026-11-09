'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Boxes, Package, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Command } from '@/components/ui/command'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { filterQuickCommands, useQuickCommands, type QuickCommand } from '@/hooks/use-quick-commands'
import { looksScanned, resolveScannedCode, searchEverything, type SearchHit } from '@/services/global-search.service'

/**
 * Mac shows ⌘K, everything else Ctrl+K. Read once on mount rather than during
 * render, so the server and the first client render agree.
 */
function useIsMac() {
  const [mac, setMac] = useState(false)
  useEffect(() => {
    setMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent))
  }, [])
  return mac
}

const ICONS = { variant: Boxes, product: Package } as const

/** One list for the palette: an operation to run, or a catalog row to open. */
type Row =
  | { type: 'command'; key: string; command: QuickCommand }
  | { type: 'hit'; key: string; hit: SearchHit }

/**
 * Everything the app can do, on Ctrl/Cmd+K, from any page.
 *
 * It started as catalog search and now carries the operations too, because
 * reaching a form was the slow part: sidebar → Inventory → the Transfers tab →
 * "Prepare transfer" is three clicks and two page loads before anyone has
 * picked a single variant. Here it is one keystroke and one Enter, and because
 * the rows come from `useQuickCommands` they are filtered by the permission the
 * server would check. the palette never offers a form that ends in a `403`.
 * Opened with nothing typed it lists those operations rather than an empty
 * box, so the shortcut also answers "what can I do from here?".
 *
 * It also has to work with a barcode scanner, which is a keyboard that types a
 * code in a few milliseconds and presses Enter. That is why Enter is handled
 * before the results arrive: on a scan the debounce has not fired yet and there
 * is nothing highlighted, so a palette that only ever opened the highlighted
 * row would do nothing at all. When the term has the shape of a scanned code,
 * Enter resolves it through `GET /skus/lookup` and goes straight to the variant
 *. the scan is unambiguous, so making someone pick from a list of one would be
 * a step with no decision in it.
 */
export function GlobalSearch() {
  const router = useRouter()
  const mac = useIsMac()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [resolving, setResolving] = useState(false)
  const debounced = useDebouncedValue(term)
  const commands = useQuickCommands()
  /* The scan path reads the term on Enter, which can land between renders. */
  const termRef = useRef(term)
  termRef.current = term

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const results = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchEverything(debounced),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 30_000,
  })

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      setTerm('')
      router.push(href)
    },
    [router],
  )

  const hits = results.data ?? []
  const matchedCommands = useMemo(() => filterQuickCommands(commands, term), [commands, term])

  /**
   * Operations first, catalog rows after.
   *
   * Both live in one `items` array because the primitive drives arrow keys and
   * `aria-activedescendant` from that array. two lists would leave the second
   * unreachable from the keyboard. The headings are rendered between the
   * slices, so it still reads as two groups.
   */
  const rows: Row[] = useMemo(
    () => [
      ...matchedCommands.map((command): Row => ({ type: 'command', key: `cmd-${command.id}`, command })),
      ...hits.map((hit): Row => ({ type: 'hit', key: `${hit.kind}-${hit.id}`, hit })),
    ],
    [matchedCommands, hits],
  )

  const commandCount = matchedCommands.length

  /** Enter with nothing highlighted: treat the term as a scanned code. */
  const onEnter = useCallback(
    async (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return
      const code = termRef.current.trim()
      if (rows.length > 0 || !looksScanned(code)) return
      event.preventDefault()
      setResolving(true)
      try {
        const variantId = await resolveScannedCode(code)
        if (variantId) go(`/inventory/${variantId}`)
        else toast.error(`Nothing matches “${code}”`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not look that code up')
      } finally {
        setResolving(false)
      }
    },
    [go, rows.length],
  )

  const searching = debounced.trim().length >= 2

  return (
    <>
      <button type="button" className="global-search-trigger" onClick={() => setOpen(true)}>
        <Search size={16} aria-hidden="true" />
        <span className="global-search-label">Search or start an action</span>
        <kbd className="global-search-key" aria-hidden="true">
          {mac ? '⌘' : 'Ctrl'} K
        </kbd>
        <span className="sr-only">
          Open the command palette to run an action or search the catalog. Keyboard shortcut:{' '}
          {mac ? 'Command' : 'Control'} K
        </span>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        title="Commands and search"
        description="Start an action, jump to a screen, or search products, variants, SKUs and barcodes. Scan a barcode to open its variant."
      >
        <Command.Root
          inline
          open
          mode="none"
          items={rows}
          value={term}
          onValueChange={setTerm}
          itemToStringValue={(row: Row) => (row.type === 'command' ? row.command.label : row.hit.title)}
        >
          <Command.Input
            placeholder="Type an action, a product, or scan a barcode…"
            aria-label="Run an action or search products, variants, SKUs and barcodes"
            onKeyDown={onEnter}
            autoFocus
          />

          <Command.List>
            {rows.map((row, index) => {
              /* A heading before the first row of each slice, so the groups
                 read as groups without breaking the one flat items array. */
              const heading =
                index === 0 && row.type === 'command' ? (
                  <Command.GroupLabel key="label-actions">Actions</Command.GroupLabel>
                ) : index === commandCount && row.type === 'hit' ? (
                  <Command.GroupLabel key="label-catalog">Catalog</Command.GroupLabel>
                ) : null

              if (row.type === 'command') {
                const { command } = row
                const Icon = command.icon
                return (
                  <Fragment key={row.key}>
                    {heading}
                    <Command.Item value={row} index={index} onClick={() => go(command.href)}>
                      <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{command.label}</span>
                        <span className="block truncate text-[length:var(--fs-xs)] text-muted-foreground">
                          {command.hint}
                        </span>
                      </span>
                      <span className="shrink-0 text-[length:var(--fs-xs)] uppercase tracking-[0.08em] text-muted-foreground">
                        {command.group === 'Start' ? 'New' : 'Open'}
                      </span>
                    </Command.Item>
                  </Fragment>
                )
              }

              const { hit } = row
              const Icon = ICONS[hit.kind]
              return (
                <Fragment key={row.key}>
                  {heading}
                  <Command.Item value={row} index={index} onClick={() => go(hit.href)}>
                    <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{hit.title}</span>
                      <span className="block truncate text-[length:var(--fs-xs)] text-muted-foreground tabular">
                        {hit.subtitle}
                      </span>
                    </span>
                  </Command.Item>
                </Fragment>
              )
            })}

            {rows.length === 0 && (
              <Command.Empty>
                {resolving
                  ? 'Looking that code up…'
                  : !searching
                    ? 'Type at least two characters, or scan a barcode.'
                    : results.isPending
                      ? 'Searching…'
                      : results.isError
                        ? 'Search failed. Try again.'
                        : `Nothing matches “${debounced.trim()}”.`}
              </Command.Empty>
            )}
          </Command.List>

          <Command.Footer>
            <Command.Key>↑</Command.Key>
            <Command.Key>↓</Command.Key>
            <span>to move</span>
            <Command.Key>Enter</Command.Key>
            <span>to open</span>
            <Command.Key>Esc</Command.Key>
            <span>to close</span>
          </Command.Footer>
        </Command.Root>
      </Command.Dialog>
    </>
  )
}
