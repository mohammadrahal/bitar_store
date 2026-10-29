/**
 * Archives every active style using the Bitar API.
 * Usage (from repo root):
 *   set BITAR_EMAIL=you@example.com
 *   set BITAR_PASSWORD=your-password
 *   node scripts/archive-all-via-api.mjs
 *
 * Or with dev auth on the backend (AUTH_MODE=dev):
 *   set BITAR_DEV_USER_ID=<admin-uuid>
 *   node scripts/archive-all-via-api.mjs
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.BITAR_API_URL ?? 'http://localhost:5000'
const PAGE = 200

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Never revalidate: a 304 carries no body for the caller to parse.
    cache: 'no-store',
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status} ${path}`)
  return data
}

async function authHeaders() {
  const devId = process.env.BITAR_DEV_USER_ID?.trim()
  if (devId) return { 'X-User-Id': devId }

  const email = process.env.BITAR_EMAIL?.trim()
  const password = process.env.BITAR_PASSWORD
  if (!email || !password) {
    throw new Error('Set BITAR_EMAIL + BITAR_PASSWORD, or BITAR_DEV_USER_ID (dev mode backend).')
  }
  const { token } = await request('/auth/login', { method: 'POST', body: { email, password } })
  return { Authorization: `Bearer ${token}` }
}

async function listAllStyles(headers) {
  const styles = []
  for (let offset = 0; ; offset += PAGE) {
    const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset), activeOnly: 'false' })
    const page = await request(`/styles?${q}`, { headers })
    styles.push(...page)
    if (page.length < PAGE) return styles
  }
}

async function main() {
  const headers = await authHeaders()
  const styles = await listAllStyles(headers)
  const active = styles.filter((s) => s.isActive)
  console.log(`Found ${active.length} active style(s) to archive…`)

  let archived = 0
  const errors = []
  for (const style of active) {
    try {
      await request(`/styles/${style.id}`, { method: 'PATCH', headers, body: { isActive: false } })
      archived += 1
      console.log(`  archived ${style.code} — ${style.name}`)
    } catch (error) {
      errors.push({ code: style.code, message: error instanceof Error ? error.message : String(error) })
      console.warn(`  failed ${style.code}: ${errors.at(-1).message}`)
    }
  }

  console.log(`Done. Archived ${archived}/${active.length}.`)
  if (errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
