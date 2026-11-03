import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

/** Een menu-onderdeel met tabs (Planning, Instellingen). Elke tab is een eigen adres, zodat links en terugknop werken. */
export type Tab = { to: string; label: string }
export const PLANNING: Tab[] = [
  { to: '/agenda', label: '📅 Agenda' },
  { to: '/opdrachten', label: '👷 Opdrachten' },
  { to: '/taken', label: '✓ Taken' },
]
export const INBOX: Tab[] = [
  { to: '/inbox', label: 'Mails' },
  { to: '/von', label: 'Voorstellen van VON' },
  { to: '/von?tab=taken', label: 'Taken' },
]
export const SETTINGS: Tab[] = [
  { to: '/instellingen', label: 'Overzicht' },
  { to: '/regels', label: 'Rekenregels' },
  { to: '/mails', label: 'Verstuurd door de app' },
  { to: '/portaal', label: 'Portaal (voorbeeld)' },
]

export function Section({ title, intro, tabs, children }: { title: string; intro?: string; tabs: Tab[]; children: ReactNode }) {
  const loc = useLocation()
  // actief = zelfde pad, en (als de tab een ?tab= heeft) dezelfde tab
  const isOn = (to: string) => {
    const [path, q] = to.split('?')
    const tab = new URLSearchParams(q ?? '').get('tab'), cur = new URLSearchParams(loc.search).get('tab')
    return loc.pathname === path && (tab ?? null) === (cur ?? null)
  }
  return (
    <section className="section">
      <div className="section-head">
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
      </div>
      <nav className="section-tabs">
        {tabs.map((t) => <Link key={t.to} to={t.to} className={isOn(t.to) ? 'on' : ''}>{t.label}</Link>)}
      </nav>
      <div className="section-body">{children}</div>
    </section>
  )
}
