import type { ReactNode } from 'react'

export const Loading = () => <p className="muted">Laden…</p>
export const ErrorBox = ({ error }: { error: string | null }) => (error ? <p className="error">{error}</p> : null)

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: ReactNode }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === active} className={t.id === active ? 'tab active' : 'tab'} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="stat">
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
)
