'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Boxes, Package, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Command } from '@/components/ui/command'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
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

/**
 * Search over the catalog from anywhere, on Ctrl/Cmd+K.
 *
 * It also has to work with a barcode scanner, which is a keyboard that types a
 * code in a few milliseconds and presses Enter. That is why Enter is handled
 * before the results arrive: on a scan the debounce has not fired yet and there
 * is nothing highlighted, so a palette that only ever opened the highlighted
 * row would do nothing at all. When the term has the shape of a scanned code,
 * Enter resolves it through `GET /skus/lookup` and goes straight to the variant
 * — the scan is unambiguous, so making someone pick from a list of one would be
 * a step with no decision in it.
 */
export function GlobalSearch() {
  const router = useRouter()
  const mac = useIsMac()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [resolving, setResolving] = useState(false)
  const debounced = useDebouncedValue(term)
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

  /** Enter with nothing highlighted: treat the term as a scanned code. */
  const onEnter = useCallback(
    async (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return
      const code = termRef.current.trim()
      const hits = results.data ?? []
      if (hits.length > 0 || !looksScanned(code)) return
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
    [go, results.data],
  )

  const hits = results.data ?? []
  const searching = debounced.trim().length >= 2

  return (
    <>
      <button type="button" className="global-search-trigger" onClick={() => setOpen(true)}>
        <Search size={16} aria-hidden="true" />
        <span className="global-search-label">Search products, SKUs, barcodes</span>
        <kbd className="global-search-key" aria-hidden="true">
          {mac ? '⌘' : 'Ctrl'} K
        </kbd>
        <span className="sr-only">Open search. Keyboard shortcut: {mac ? 'Command' : 'Control'} K</span>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search products, variants, SKUs and barcodes. Scan a barcode to open its variant."
      >
        <Command.Root
          inline
          open
          mode="none"
          items={hits}
          value={term}
          onValueChange={setTerm}
          itemToStringValue={(hit: SearchHit) => hit.title}
        >
          <Command.Input
            placeholder="Search or scan a barcode…"
            aria-label="Search products, variants, SKUs and barcodes"
            onKeyDown={onEnter}
            autoFocus
          />

          <Command.List>
            {hits.length > 0 && <Command.GroupLabel>Catalog</Command.GroupLabel>}
            {hits.map((hit, index) => {
              const Icon = ICONS[hit.kind]
              return (
                <Command.Item key={`${hit.kind}-${hit.id}`} value={hit} index={index} onClick={() => go(hit.href)}>
                  <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{hit.title}</span>
                    <span className="block truncate text-[length:var(--fs-xs)] text-muted-foreground tabular">
                      {hit.subtitle}
                    </span>
                  </span>
                </Command.Item>
              )
            })}

            {hits.length === 0 && (
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
