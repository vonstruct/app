import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

/**
 * Een menu-onderdeel met tabs. Elke tab is een eigen adres, zodat links en terugknop werken.
 * Menu met vijf vaste plaatsen (7 nov 2026): Vandaag · Agenda · Projecten · Inkoop · Relaties. Elk ding heeft één thuis.
 */
export type Tab = { to: string; label: string }
export const AGENDA: Tab[] = [
  { to: '/agenda', label: 'Agenda' },
  { to: '/opdrachten', label: 'Opdrachten' },
  { to: '/capaciteit', label: 'Capaciteit' },
]
export const INKOOP: Tab[] = [
  { to: '/bestellingen', label: 'Bestellingen' },
  { to: '/bestellingen?tab=mailbox', label: 'Uit je mailbox' },
  { to: '/facturen?tab=aankoop', label: 'Aankoopfacturen' },
]
export const PROJECTEN: Tab[] = [
  { to: '/projecten', label: 'Projecten' },
  { to: '/facturen', label: 'Verkoopfacturen' },
  { to: '/cijfers', label: 'Cijfers' },
]
export const INBOX: Tab[] = [{ to: '/inbox', label: 'Mails' }]
export const SETTINGS: Tab[] = [
  { to: '/instellingen', label: 'Overzicht' },
  { to: '/regels', label: 'Rekenregels' },
  { to: '/mails', label: 'Verstuurd door de app' },
  { to: '/portaal', label: 'Portaal (voorbeeld)' },
]

/** actief = zelfde pad, en (als de tab een ?tab= heeft) dezelfde tab */
function useIsOn() {
  const loc = useLocation()
  return (to: string) => {
    const [path, q] = to.split('?')
    const tab = new URLSearchParams(q ?? '').get('tab'), cur = new URLSearchParams(loc.search).get('tab')
    return loc.pathname === path && (tab ?? null) === (cur ?? null)
  }
}

/** Enkel de tabbalk (voor pagina's met een eigen kop, zoals Projecten). */
export function SectionTabs({ tabs }: { tabs: Tab[] }) {
  const isOn = useIsOn()
  return <nav className="section-tabs">{tabs.map((t) => <Link key={t.to} to={t.to} className={isOn(t.to) ? 'on' : ''}>{t.label}</Link>)}</nav>
}

export function Section({ title, intro, tabs, children }: { title: string; intro?: string; tabs: Tab[]; children: ReactNode }) {
  const isOn = useIsOn()
  return (
    <section className="section">
      <div className="section-head">
        <div className="vd-date">{new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
      </div>
      {tabs.length > 1 && <nav className="section-tabs">
        {tabs.map((t) => <Link key={t.to} to={t.to} className={isOn(t.to) ? 'on' : ''}>{t.label}</Link>)}
      </nav>}
      <div className="section-body">{children}</div>
    </section>
  )
}
