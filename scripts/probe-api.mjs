const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bitar.test', password: 'Password#123' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`login ${res.status}: ${JSON.stringify(data)}`)
  return data.token
}

async function probe(token, path, method = 'GET') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  let body = ''
  try {
    body = await res.text()
    if (body.length > 120) body = body.slice(0, 120) + '…'
  } catch {
    body = ''
  }
  return { status: res.status, body }
}

const paths = [
  '/health',
  '/auth/me',
  '/branches',
  '/warehouse',
  '/categories',
  '/categories?activeOnly=true',
  '/styles?limit=1',
  '/skus?limit=1',
  '/users',
  '/permissions',
  '/users/f957d6bd-0789-4b00-a157-ca68f19c628f/permissions',
  '/users/f957d6bd-0789-4b00-a157-ca68f19c628f/branch-access',
  '/transfers?limit=1',
  '/stock?branchId=x',
  '/stock/overview?limit=1',
  '/replenishment/suggestions',
  '/reports/sales-summary',
  '/reports/top-skus?limit=3',
  '/audit-events?limit=3',
  '/sales/history?from=2026-11-01&to=2026-11-03&limit=1',
  '/dashboard/overview',
]

const token = await login()
console.log('BASE', BASE)
for (const path of paths) {
  const { status, body } = await probe(token, path)
  const flag = status === 404 ? ' *** 404 ***' : status >= 400 ? ' !' : ''
  console.log(`${status}${flag}\t${path}\t${body}`)
}
