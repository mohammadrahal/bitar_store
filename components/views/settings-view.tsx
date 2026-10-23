'use client'

import { useRef, useState } from 'react'
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardUI } from '@/components/dashboard/dashboard-ui-provider'
import { Field, PageHeader, Panel } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { datedFilename, downloadFile } from '@/lib/csv'

const currencies = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'LBP']

export function SettingsView() {
  const { settings } = useInventory().state
  return <SettingsForm key={`${settings.userName}|${settings.currency}`} />
}

function SettingsForm() {
  const { state, updateSettings, importData, resetToDemo, clearAll } = useInventory()
  const { confirm } = useDashboardUI()
  const [userName, setUserName] = useState(state.settings.userName)
  const [currency, setCurrency] = useState(state.settings.currency)
  const [nameError, setNameError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = userName !== state.settings.userName || currency !== state.settings.currency

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!userName.trim()) {
      setNameError('Enter your name. It is recorded on every stock movement.')
      return
    }
    setNameError(undefined)
    const result = updateSettings({ userName, currency })
    if (result.ok) toast.success('Settings saved')
    else toast.error(result.error)
  }

  function exportBackup() {
    downloadFile(datedFilename('bitar-inventory-backup', 'json'), JSON.stringify(state, null, 2), 'application/json')
    toast.success('Backup downloaded')
  }

  async function onImport(file: File) {
    const ok = await confirm({
      title: 'Replace all data with this backup?',
      description: 'Current branches, products, stock, and history will be overwritten. Export a backup first if you might need it.',
      confirmLabel: 'Import backup',
      tone: 'danger',
    })
    if (!ok) return
    const result = importData(await file.text())
    if (result.ok) toast.success('Backup imported')
    else toast.error(result.error)
  }

  return (
    <>
      <PageHeader title="Settings" description="Your profile, display preferences, and data management." />

      <div className="settings-grid">
        <Panel title="Profile & preferences" description="Your name is recorded on every stock movement you make.">
          <form className="panel-body form-grid" onSubmit={save} noValidate>
            <Field label="Your name" error={nameError}>
              <input value={userName} onChange={(e) => setUserName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <div className="full form-actions">
              <button type="submit" className="btn btn-primary" disabled={!dirty}>
                Save changes
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Data" description="Inventory is saved in this browser. Export regularly to keep a backup.">
          <div className="panel-body settings-actions">
            <div className="settings-row">
              <div>
                <strong>Export backup</strong>
                <p>Download every branch, product, stock level, and movement as JSON.</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={exportBackup}>
                <Download size={16} /> Export
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Import backup</strong>
                <p>Restore from a previously exported JSON file.</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void onImport(file)
                }}
              />
            </div>
            <div className="settings-row">
              <div>
                <strong>Reset demo data</strong>
                <p>Replace everything with the sample Bitar Fashion dataset.</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  if (await confirm({ title: 'Reset to demo data?', description: 'All current data will be replaced with sample data.', confirmLabel: 'Reset', tone: 'danger' })) {
                    resetToDemo()
                    toast.success('Demo data restored')
                  }
                }}
              >
                <RotateCcw size={16} /> Reset
              </button>
            </div>
            <div className="settings-row danger-zone">
              <div>
                <strong>Clear all data</strong>
                <p>Remove every branch, product, and movement. This cannot be undone.</p>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (await confirm({ title: 'Clear all data?', description: 'This permanently removes all branches, products, stock, and history from this browser.', confirmLabel: 'Clear everything', tone: 'danger' })) {
                    clearAll()
                    toast.success('All data cleared')
                  }
                }}
              >
                <Trash2 size={16} /> Clear
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  )
}
