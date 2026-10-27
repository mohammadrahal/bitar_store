'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { VariantQuantityDialog } from '@/components/stock-control/variant-quantity-dialog'
import { Panel } from '@/components/shared/panel'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useDispose } from '@/hooks/use-stock-control'

export function DisposalTab({ branchId }: { branchId: string }) {
  const dispose = useDispose()
  const idempotency = useIdempotencyKey()
  const [open, setOpen] = useState(false)

  return (
    <Panel title="Dispose of stock" description="Write off units that cannot be sold. Each disposal needs a reason and creates an adjustment document.">
      <div className="panel-body stack">
        <p className="notice">
          To dispose of units already on hold, use Dispose on the Holds tab. Here you can write off available units directly.
        </p>
        <div>
          <button type="button" className="btn btn-danger-outline" onClick={() => setOpen(true)}>
            <Trash2 size={16} aria-hidden="true" />
            Dispose of available units
          </button>
        </div>
      </div>
      {open && (
        <VariantQuantityDialog
          branchId={branchId}
          title="Dispose of units"
          description="The units leave on hand and available stock. This cannot be undone."
          confirmLabel="Dispose"
          tone="danger"
          pending={dispose.isPending}
          onCancel={() => setOpen(false)}
          onConfirm={(input) =>
            dispose.mutate(
              { input: { ...input, branchId }, key: idempotency.current() },
              {
                onSuccess: () => {
                  idempotency.reset()
                  setOpen(false)
                },
              },
            )
          }
        />
      )}
    </Panel>
  )
}
