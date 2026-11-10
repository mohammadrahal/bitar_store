import { Fragment, type ReactElement } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice } from '@/lib/format'
import { refundOutstanding, unitsOnHold } from '@/services/returns.service'
import type { ApiReturn } from '@/lib/api/types'

/**
 * The four acts of a return, shown as four.
 *
 * BL-04 rule 34 makes receiving, deciding, releasing and refunding separate
 * events, none of which triggers another — so the screen states where the
 * return has got to rather than implying a single settlement. The common error
 * this exists to prevent is reading "approved" as "the customer has their
 * money": here, approval ticks step two and leaves four plainly open.
 *
 * A rejected return has no steps three or four, and says so, instead of showing
 * two steps that will never complete.
 */
export function ReturnSteps({ entry }: { entry: ApiReturn }) {
  if (entry.status === 'rejected' || entry.status === 'handed_back') {
    const collected = entry.status === 'handed_back'
    return (
      <ReturnStepsList>
        <Step done label="Goods taken in" detail="Held at the counter" />
        <Step done label="Rejected" detail={entry.decision?.reason ?? 'A manager refused it'} />
        <Step
          done={collected}
          label={collected ? 'Goods collected' : 'Waiting to be collected'}
          detail={
            collected
              ? `By ${entry.handback?.to ?? 'the customer'}`
              : 'The customer still has to take them away'
          }
        />
      </ReturnStepsList>
    )
  }

  const approved = entry.status === 'approved'
  const onHold = unitsOnHold(entry)
  const released = entry.lines.reduce((total, line) => total + line.releasedQty, 0)
  const owed = refundOutstanding(entry)
  const paid = approved && entry.refund !== null && owed === 0

  return (
    <ReturnStepsList>
      <Step
        done
        label="Goods taken in"
        detail={
          entry.custody === 'customer_keeps'
            ? 'Recorded — the customer still has them'
            : `Held at ${entry.receivingBranch.name}`
        }
      />
      <Step
        done={approved}
        label={approved ? 'Approved' : 'Waiting on a decision'}
        detail={
          approved
            ? `By ${entry.decision?.by.name ?? 'a manager'}`
            : 'A manager approves or rejects it'
        }
      />
      <Step
        done={approved && onHold === 0 && released > 0}
        label={
          !approved
            ? 'Release to sale'
            : released === 0
              ? `${onHold} on hold, none released`
              : onHold === 0
                ? `All ${released} back on sale`
                : `${released} released, ${onHold} on hold`
        }
        detail="A manager decides what is fit to sell. Never automatic."
      />
      <Step
        done={paid}
        label={
          !approved
            ? 'Refund'
            : paid
              ? 'Refund paid'
              : `Refund of ${formatPrice(priceOf(entry.refund?.outstanding ?? '0'))} owed`
        }
        detail={approved ? 'Cash or Whish, in one go or in parts' : 'Fixed when it is approved'}
      />
    </ReturnStepsList>
  )
}

function ReturnStepsList({ children }: { children: ReactElement | ReactElement[] }) {
  const steps = (Array.isArray(children) ? children : [children]).filter(Boolean)
  return (
    <ol className="return-steps" aria-label="Where this return has got to">
      {steps.map((step, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <li className="return-step-arrow" aria-hidden="true">
              <ChevronRight size={16} strokeWidth={2} />
            </li>
          ) : null}
          {step}
        </Fragment>
      ))}
    </ol>
  )
}

function Step({ done, label, detail }: { done?: boolean; label: string; detail: string }) {
  return (
    <li className={done ? 'return-step return-step--done' : 'return-step'}>
      <span className="return-step-mark" aria-hidden="true">
        {done ? <Check size={13} /> : null}
      </span>
      <span className="return-step-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </li>
  )
}
