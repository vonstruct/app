import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

/** Een menu-onderdeel met tabs (Planning, Instellingen). Elke tab is een eigen adres, zodat links en terugknop werken. */
export type Tab = { to: string; label: string }
export const PLANNING: Tab[] = [
  { to: '/agenda', label: '📅 Agenda' },
  { to: '/opdrachten', label: '👷 Opdrachten' },
  { to: '/taken', label: '✓ Taken' },
]
export const SETTINGS: Tab[] = [
  { to: '/instellingen', label: 'Overzicht' },
  { to: '/regels', label: 'Rekenregels' },
  { to: '/mails', label: 'Mails' },
  { to: '/portaal', label: 'Portaal (voorbeeld)' },
]

export function Section({ title, intro, tabs, children }: { title: string; intro?: string; tabs: Tab[]; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
      </div>
      <nav className="section-tabs">
        {tabs.map((t) => <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'on' : '')}>{t.label}</NavLink>)}
      </nav>
      <div className="section-body">{children}</div>
    </section>
  )
}
