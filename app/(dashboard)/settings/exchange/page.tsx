import { redirect } from 'next/navigation'

export default function ExchangeSettingsRedirect() {
  redirect('/admin?section=settings')
}
