/** Dial codes the phone field offers. Lebanon is first and the default. */
export const COUNTRY_DIALS = [
  { dial: '+961', region: 'Lebanon' },
  { dial: '+973', region: 'Bahrain' },
  { dial: '+20', region: 'Egypt' },
  { dial: '+33', region: 'France' },
  { dial: '+49', region: 'Germany' },
  { dial: '+964', region: 'Iraq' },
  { dial: '+39', region: 'Italy' },
  { dial: '+962', region: 'Jordan' },
  { dial: '+965', region: 'Kuwait' },
  { dial: '+968', region: 'Oman' },
  { dial: '+974', region: 'Qatar' },
  { dial: '+966', region: 'Saudi Arabia' },
  { dial: '+34', region: 'Spain' },
  { dial: '+963', region: 'Syria' },
  { dial: '+90', region: 'Turkey' },
  { dial: '+971', region: 'United Arab Emirates' },
  { dial: '+44', region: 'United Kingdom' },
  { dial: '+1', region: 'United States / Canada' },
] as const

export type CountryDial = (typeof COUNTRY_DIALS)[number]['dial']

export const DEFAULT_DIAL: CountryDial = '+961'

const DIALS_BY_LENGTH = [...COUNTRY_DIALS].sort((a, b) => b.dial.length - a.dial.length)

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function nationalNumberOf(value: string): string {
  return parsePhone(value).national
}

/** Longest matching dial, so +961 is not read as an unknown +9. */
export function parsePhone(value: string): { dial: CountryDial; national: string } {
  const trimmed = value.trim()
  if (!trimmed) return { dial: DEFAULT_DIAL, national: '' }

  const international = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed
  const compact = international.replace(/[\s()-]/g, '')
  const match = DIALS_BY_LENGTH.find((entry) => compact === entry.dial || compact.startsWith(entry.dial))
  if (match) {
    return { dial: match.dial, national: digitsOnly(compact.slice(match.dial.length)) }
  }

  return { dial: DEFAULT_DIAL, national: digitsOnly(compact) }
}

export function composePhone(dial: string, national: string): string {
  const digits = digitsOnly(national)
  if (!digits) return ''
  return `${dial} ${digits}`
}
