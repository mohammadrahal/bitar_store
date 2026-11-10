'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { useHandbackReturn } from '@/hooks/use-returns'
import type { ApiReturn } from '@/lib/api/types'

/**
 * Closing a rejected return: the customer collects their goods.
 *
 * This is the only step on a rejected return, and it changes **no business
 * stock** — the goods were never the shop's. What it records is who took them,
 * which is the whole point: a rejected garment sitting behind the counter with
 * nobody named against it is how a dispute starts.
 */
export function ReturnHandbackPanel({ entry, canRecord }: { entry: ApiReturn; canRecord: boolean }) {
  const handback = useHandbackReturn()
  const [recipient, setRecipient] = useState('')

  return (
    <Panel
      title="Hand the goods back"
      description="This return was rejected, so the goods go back to the customer. Recording who collected them closes it."
    >
      <div className="panel-body stack gap-md" style={{ maxWidth: '32rem' }}>
        {entry.decision?.reason ? (
          <p className="muted text-sm" style={{ margin: 0 }}>
            Rejected because: {entry.decision.reason}
          </p>
        ) : null}

        {!canRecord ? (
          <p className="muted text-sm" style={{ margin: 0 }}>
            Recording the handback needs the returns permission.
          </p>
        ) : (
          <>
            <Field label="Collected by" hint="The customer's name, as they give it. 2 to 100 characters.">
              <input
                type="text"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                maxLength={100}
                disabled={handback.isPending}
              />
            </Field>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={handback.isPending || recipient.trim().length < 2}
                onClick={() => handback.mutate({ id: entry.id, recipient: recipient.trim() })}
              >
                {handback.isPending ? 'Recording…' : 'Goods collected'}
              </button>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
