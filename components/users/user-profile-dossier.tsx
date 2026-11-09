'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Download,
  KeyRound,
  Pencil,
  Shield,
  Store,
} from 'lucide-react'
import { ProfilePasswordForm } from '@/components/profile/profile-password-form'
import { UserPermissionFields } from '@/components/users/user-permission-fields'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { useSalesSummaryReport } from '@/hooks/use-reports-api'
import { usePermissionDraft, useSetUserPermissions } from '@/hooks/use-user-permissions'
import { useBranchAccess, useUserAccess, useUsers } from '@/hooks/use-users'
import { initials, formatNumber, formatPrice, formatShortDate } from '@/lib/format'
import { can, isOwnerRole, ROLE_LABELS } from '@/lib/permissions'
import {
  monthToDateRange,
  primaryBranchId,
  profileVariantForRole,
  staffSubjectFromSession,
  tenureLabel,
  userBadgeId,
} from '@/lib/user-profile-display'
import type { StaffUser } from '@/services/users.service'
import type { User } from '@/types'

const EXEC_TABS = [
  { id: 'overview', label: 'Executive overview' },
  { id: 'permissions', label: 'Role & permissions' },
  { id: 'locations', label: 'Boutiques & vaults' },
  { id: 'security', label: 'Security & keys' },
  { id: 'audit', label: 'Audit trail' },
] as const

const EMP_TABS = [
  { id: 'performance', label: 'Performance & sales' },
  { id: 'privileges', label: 'Floor privileges' },
  { id: 'personal', label: 'Personal & employment' },
  { id: 'security', label: 'Credentials' },
] as const

type ExecTab = (typeof EXEC_TABS)[number]['id']
type EmpTab = (typeof EMP_TABS)[number]['id']

function staffToPermissionUser(subject: StaffUser, sessionUser: User, accessGrants?: Record<string, string[]>): User {
  const grants = accessGrants ?? (subject.id === sessionUser.id ? sessionUser.grants : {})
  const flat = [...new Set(Object.values(grants).flat())]
  return {
    id: subject.id,
    name: subject.fullName,
    email: subject.email,
    role: subject.role,
    branchId: subject.branchIds[0] ?? null,
    branchIds: subject.branchIds,
    locations: subject.locations,
    permissions: flat,
    grants,
    canViewCosts: subject.id === sessionUser.id && sessionUser.canViewCosts,
  }
}

export function UserProfileDossier({
  subject,
  context,
  sessionUser,
  onEdit,
}: {
  subject: StaffUser
  context: 'self' | 'admin'
  sessionUser: User
  onEdit?: () => void
}) {
  const variant = profileVariantForRole(subject.role)
  const [execTab, setExecTab] = useState<ExecTab>('overview')
  const [empTab, setEmpTab] = useState<EmpTab>('performance')
  const { data: branches } = useBranches()
  const storedAccess = useUserAccess(subject.id)
  const branchAccess = useBranchAccess(subject.id)
  const permissionDraft = usePermissionDraft(subject.role, subject.id)
  const savePermissions = useSetUserPermissions()
  const { activeLocationId } = usePermission()

  const permissionUser = useMemo(
    () => staffToPermissionUser(subject, sessionUser, storedAccess.data?.grants),
    [sessionUser, storedAccess.data?.grants, subject],
  )

  const branchId = primaryBranchId(subject, activeLocationId)
  const { from, to } = monthToDateRange()
  const salesSummary = useSalesSummaryReport(branchId, from, to)

  const branchName = (id: string) => branches?.find((b) => b.id === id)?.name ?? id.slice(0, 8)
  const jurisdiction =
    subject.role === 'super_admin' || subject.branchAccessMode === 'all'
      ? 'All boutiques & warehouse'
      : subject.branchIds.length > 0
        ? subject.branchIds.map(branchName).join(' · ')
        : subject.locations.map((entry) => branchName(entry.locationId)).join(' · ') || 'No branch assigned'

  const mtdRevenue = salesSummary.data?.totals ? Number(salesSummary.data.totals.revenue) : null
  const mtdSales = salesSummary.data?.totals?.salesCount ?? null

  const tabs = variant === 'executive' ? EXEC_TABS : EMP_TABS
  const activeTab = variant === 'executive' ? execTab : empTab
  const setTab = (id: string) => {
    if (variant === 'executive') setExecTab(id as ExecTab)
    else setEmpTab(id as EmpTab)
  }

  const persistPermissions = () => {
    const changes = permissionDraft.changes()
    if (Object.keys(changes).length === 0) return
    savePermissions.mutate({ id: subject.id, name: subject.fullName, permissions: changes })
  }

  return (
    <div className="identity-dossier-page">
      <header className="identity-dossier-hero">
        <div className="identity-dossier-hero-main">
          <div className="identity-dossier-identity">
            <span className="identity-dossier-avatar" aria-hidden="true">
              {initials(subject.fullName)}
            </span>
            <div>
              <p className="identity-dossier-eyebrow">
                Governance · {context === 'self' ? 'Your profile' : 'Employees & access'} ·{' '}
                {userBadgeId(subject.id)}
              </p>
              <h1 className="identity-dossier-name">{subject.fullName}</h1>
              <p className="identity-dossier-role-line">
                {ROLE_LABELS[subject.role]}
                {subject.isActive ? (
                  <span className="identity-dossier-status identity-dossier-status--on">Active</span>
                ) : (
                  <span className="identity-dossier-status identity-dossier-status--off">Inactive</span>
                )}
              </p>
              <div className="identity-dossier-badges">
                <span className="identity-dossier-badge">{subject.email}</span>
                {isOwnerRole(subject.role) ? (
                  <span className="identity-dossier-badge identity-dossier-badge--gold">Owner access</span>
                ) : (
                  <span className="identity-dossier-badge">{jurisdiction}</span>
                )}
              </div>
            </div>
          </div>
          <dl className="identity-dossier-meta">
            <div>
              <dt>Tenure</dt>
              <dd>{tenureLabel(subject.createdAt || undefined)}</dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{jurisdiction}</dd>
            </div>
            <div>
              <dt>Sign-in</dt>
              <dd>{subject.hasPassword ? 'Password enrolled' : 'No password'}</dd>
            </div>
          </dl>
        </div>
        <div className="identity-dossier-hero-actions">
          {context === 'admin' && onEdit ? (
            <button type="button" className="btn btn-secondary" onClick={onEdit}>
              <Pencil size={16} aria-hidden="true" />
              Edit employee
            </button>
          ) : null}
          {context === 'self' ? (
            <Link href="/account?tab=security" className="btn btn-secondary">
              <KeyRound size={16} aria-hidden="true" />
              Change password
            </Link>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled
            title="Hardware keys and MoF signatory export are not on the API yet"
          >
            <Download size={16} aria-hidden="true" />
            Export security dossier
          </button>
        </div>
      </header>

      <div className="identity-dossier-kpi-grid">
        {variant === 'executive' ? (
          <>
            <article className="identity-dossier-kpi">
              <p className="identity-dossier-kpi-label">Discount authority</p>
              <p className="identity-dossier-kpi-value">{can(permissionUser, 'discounts.apply') ? 'Line discounts' : '—'}</p>
              <p className="muted identity-dossier-kpi-foot">From role &amp; grants</p>
            </article>
            <article className="identity-dossier-kpi">
              <p className="identity-dossier-kpi-label">Stock network</p>
              <p className="identity-dossier-kpi-value">{can(permissionUser, 'stock.view') ? 'In scope' : '—'}</p>
              <p className="muted identity-dossier-kpi-foot">Transfers &amp; balances</p>
            </article>
            <article className="identity-dossier-kpi">
              <p className="identity-dossier-kpi-label">Financial reports</p>
              <p className="identity-dossier-kpi-value">
                {can(permissionUser, 'reports.view_all') || can(permissionUser, 'reports.view_branch') ? 'Granted' : '—'}
              </p>
              <p className="muted identity-dossier-kpi-foot">Branch or network scope</p>
            </article>
            <article className="identity-dossier-kpi identity-dossier-kpi--gold">
              <p className="identity-dossier-kpi-label">Employee administration</p>
              <p className="identity-dossier-kpi-value">{can(permissionUser, 'users.manage') ? 'Full' : '—'}</p>
              <p className="muted identity-dossier-kpi-foot">Users, roles, branch access</p>
            </article>
          </>
        ) : (
          <>
            <article className="identity-dossier-kpi identity-dossier-kpi--gold">
              <p className="identity-dossier-kpi-label">Gross sales (MTD)</p>
              <p className="identity-dossier-kpi-value tabular">
                {salesSummary.isPending ? '…' : mtdRevenue !== null ? <PriceWithLbp usd={mtdRevenue} strong /> : '—'}
              </p>
              <p className="muted identity-dossier-kpi-foot">
                {branchId ? `${branchName(branchId)} · branch total` : 'Pick an active branch'}
                {' · per-advisor split not on API'}
              </p>
            </article>
            <article className="identity-dossier-kpi">
              <p className="identity-dossier-kpi-label">Sales count (MTD)</p>
              <p className="identity-dossier-kpi-value tabular">
                {salesSummary.isPending ? '…' : mtdSales !== null ? formatNumber(mtdSales) : '—'}
              </p>
              <p className="muted identity-dossier-kpi-foot">Same branch window as above</p>
            </article>
            <article className="identity-dossier-kpi">
              <p className="identity-dossier-kpi-label">Cash drawer</p>
              <p className="identity-dossier-kpi-value">{can(permissionUser, 'cash.open') ? 'Till access' : '—'}</p>
              <p className="muted identity-dossier-kpi-foot">
                <Link href="/cash">Open drawer hub</Link>
              </p>
            </article>
            <article className="identity-dossier-kpi">
              <p className="identity-dossier-kpi-label">Commission</p>
              <p className="identity-dossier-kpi-value">—</p>
              <p className="muted identity-dossier-kpi-foot">Accrual rules not on API yet</p>
            </article>
          </>
        )}
      </div>

      <nav className="identity-dossier-tabs" aria-label="Profile sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`identity-dossier-tab${activeTab === tab.id ? ' identity-dossier-tab--active' : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="identity-dossier-stack">
        {variant === 'executive' && execTab === 'overview' && (
          <div className="identity-dossier-columns">
            <div className="identity-dossier-main">
              <Panel title="Personal &amp; contact" description="From the employee record on the server.">
                <div className="panel-body identity-dossier-fields">
                  <Field label="Full legal name">
                    <input className="input" value={subject.fullName} readOnly />
                  </Field>
                  <Field label="Corporate email">
                    <input className="input" value={subject.email} readOnly />
                  </Field>
                  <Field label="Role">
                    <input className="input" value={ROLE_LABELS[subject.role]} readOnly />
                  </Field>
                </div>
              </Panel>
              <Panel title="Administrative jurisdiction" description="Where this identity may operate.">
                <p className="panel-body muted">{jurisdiction}</p>
              </Panel>
            </div>
            <aside className="identity-dossier-aside">
              <Panel title="Cryptographic tokens" description="Hardware MFA is not wired to the API yet.">
                <p className="panel-body muted">Password sign-in only. YubiKey / platform keys pending backend.</p>
              </Panel>
              <Panel title="Credential revocation">
                <p className="panel-body muted">
                  Deactivate the account from the employee list to block sign-in. Token flush requires a future auth API.
                </p>
              </Panel>
            </aside>
          </div>
        )}

        {variant === 'executive' && execTab === 'permissions' && (
          <Panel title="Role &amp; permissions matrix">
            {!permissionDraft.ready ? (
              <Skeleton rows={4} stats={0} />
            ) : (
              <>
                <div className="panel-body">
                  <UserPermissionFields
                    role={subject.role}
                    wanted={permissionDraft.wanted}
                    onChange={(key, allowed) =>
                      permissionDraft.setWanted((current) => ({ ...(current ?? {}), [key]: allowed }))
                    }
                    disabled={context !== 'admin' || isOwnerRole(subject.role)}
                  />
                </div>
                {context === 'admin' && !isOwnerRole(subject.role) ? (
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savePermissions.isPending || Object.keys(permissionDraft.changes()).length === 0}
                      onClick={persistPermissions}
                    >
                      {savePermissions.isPending ? 'Saving…' : 'Save permissions'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </Panel>
        )}

        {variant === 'executive' && execTab === 'locations' && (
          <Panel title="Assigned boutiques &amp; vaults">
            <div className="panel-body identity-dossier-location-grid">
              {subject.branchAccessMode === 'all' ? (
                <article className="identity-dossier-location-card identity-dossier-location-card--primary">
                  <Store size={18} aria-hidden="true" />
                  <strong>All boutiques</strong>
                  <p className="muted">Including branches opened later; warehouse via owner role.</p>
                </article>
              ) : (
                (subject.branchIds.length ? subject.branchIds : subject.locations.map((l) => l.locationId)).map(
                  (id) => (
                    <article key={id} className="identity-dossier-location-card">
                      <Store size={18} aria-hidden="true" />
                      <strong>{branchName(id)}</strong>
                    </article>
                  ),
                )
              )}
              {branchAccess.data ? (
                <p className="muted full">
                  Server branch mode: <strong>{branchAccess.data.mode}</strong>
                </p>
              ) : null}
            </div>
          </Panel>
        )}

        {variant === 'executive' && execTab === 'security' && (
          <Panel title="Security &amp; hardware keys">
            <div className="panel-body">
              {context === 'self' ? (
                <ProfilePasswordForm />
              ) : (
                <p className="muted">Only the signed-in user may change their password.</p>
              )}
            </div>
          </Panel>
        )}

        {variant === 'executive' && execTab === 'audit' && (
          <Panel title="Fiscal sign-offs &amp; audit trail">
            <div className="panel-body">
              <Link href="/audit" className="btn btn-secondary">
                <Shield size={16} aria-hidden="true" />
                Open governance audit log
              </Link>
              <p className="muted identity-dossier-foot">MoF fiscal signatory events are not on the API yet.</p>
            </div>
          </Panel>
        )}

        {variant === 'employee' && empTab === 'performance' && (
          <div className="identity-dossier-columns">
            <Panel title="Branch sales trajectory (MTD)" description={`${from} → ${to}`}>
              {salesSummary.isError ? (
                <ErrorState title="Could not load sales summary" error={salesSummary.error} onRetry={() => void salesSummary.refetch()} />
              ) : salesSummary.isPending ? (
                <Skeleton rows={3} stats={0} />
              ) : (
                <div className="panel-body identity-dossier-mtd-stats">
                  <p>
                    Revenue{' '}
                    <strong className="tabular">{mtdRevenue !== null ? formatPrice(mtdRevenue) : '—'}</strong>
                  </p>
                  <p>
                    Sales <strong className="tabular">{mtdSales ?? '—'}</strong>
                  </p>
                  <p className="muted">Branch totals until per-cashier attribution exists on the API.</p>
                  <Link href="/sales/history" className="btn btn-secondary">
                    Sales history
                  </Link>
                </div>
              )}
            </Panel>
            <aside className="identity-dossier-aside">
              <Panel title="Active drawer">
                <div className="panel-body">
                  <Link href="/cash?section=drawer" className="btn btn-primary">
                    Cash drawer &amp; Z-report
                  </Link>
                </div>
              </Panel>
            </aside>
          </div>
        )}

        {variant === 'employee' && empTab === 'privileges' && (
          <Panel title="Floor clearances &amp; limits">
            <ul className="panel-body identity-dossier-privilege-list">
              <li>
                <strong>Line discounts</strong>
                <span>{can(permissionUser, 'discounts.apply') ? 'May apply' : 'Not granted'}</span>
              </li>
              <li>
                <strong>Sales (branch)</strong>
                <span>{can(permissionUser, 'sales.view_branch') ? 'Branch ledger' : 'Own sales only'}</span>
              </li>
              <li>
                <strong>Cash session</strong>
                <span>
                  {can(permissionUser, 'cash.open')
                    ? 'Open / close drawer'
                    : can(permissionUser, 'cash.accept')
                      ? 'Accept handover'
                      : '—'}
                </span>
              </li>
              <li>
                <strong>Catalog</strong>
                <span>{can(permissionUser, 'catalog.create') ? 'Create & edit' : 'View'}</span>
              </li>
            </ul>
            {!isOwnerRole(subject.role) && permissionDraft.ready && permissionDraft.wanted ? (
              <div className="panel-body">
                <UserPermissionFields
                  role={subject.role}
                  wanted={permissionDraft.wanted}
                  onChange={(key, allowed) =>
                    permissionDraft.setWanted((current) => ({ ...(current ?? {}), [key]: allowed }))
                  }
                  disabled={context !== 'admin'}
                />
                {context === 'admin' ? (
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savePermissions.isPending || Object.keys(permissionDraft.changes()).length === 0}
                      onClick={persistPermissions}
                    >
                      Save permissions
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        )}

        {variant === 'employee' && empTab === 'personal' && (
          <Panel title="Personal &amp; employment">
            <div className="panel-body identity-dossier-fields">
              <Field label="Full name">
                <input className="input" value={subject.fullName} readOnly />
              </Field>
              <Field label="Email">
                <input className="input" value={subject.email} readOnly />
              </Field>
              <Field label="Assigned locations">
                <input className="input" value={jurisdiction} readOnly />
              </Field>
              {subject.createdAt ? (
                <Field label="Commissioned">
                  <input className="input" value={formatShortDate(new Date(subject.createdAt))} readOnly />
                </Field>
              ) : null}
            </div>
          </Panel>
        )}

        {variant === 'employee' && empTab === 'security' && (
          <Panel title="Credentials &amp; tokens">
            <div className="panel-body">
              <p className="muted">RFID, terminal PIN, and 2FA enrollment are not on the API.</p>
              {context === 'self' ? <ProfilePasswordForm /> : null}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

export function AccountIdentityDossier() {
  const { user } = usePermission()
  const users = useUsers()
  const staff = users.data?.find((row) => row.id === user.id)
  const subject = staffSubjectFromSession(user, staff)
  if (users.isPending && !staff) {
    return <Skeleton rows={2} stats={4} />
  }
  return <UserProfileDossier subject={subject} context="self" sessionUser={user} />
}
