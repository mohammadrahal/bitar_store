import { redirect } from 'next/navigation'

/** B2B wholesale lives under Invoices (not till sales). */
export default function B2bRedirectPage() {
  redirect('/sales/invoices')
}
