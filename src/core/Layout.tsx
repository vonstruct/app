import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { modules } from '../modules/registry'
import { supabase } from './supabase'
import logo from '../assets/vonstruct-logo.webp'
import { Von } from './Von'
import { SearchButton } from './Search'
import { ToastHost } from './toast'

/** Aantal dingen in de Inbox: mails die op antwoord wachten + open VON-voorstellen. */
function useCounts() {
  const [n, setN] = useState({ inbox: 0, von: 0 })
  const loc = useLocation()
  useEffect(() => {
    Promise.all([
      supabase.from('app_mail_messages').select('id', { count: 'exact', head: true }).eq('direction', 'in').eq('needs_reply', true).eq('replied', false).is('dismissed_at', null).eq('is_bulk', false).is('proposal_status', null).gt('at', new Date(Date.now() - 30 * 864e5).toISOString()),
      supabase.from('von_proposals').select('id', { count: 'exact', head: true }).eq('status', 'voorstel'),
    ]).then(([a, b]) => setN({ inbox: a.count ?? 0, von: b.count ?? 0 }))
  }, [loc.pathname])
  return n
}

const TAB_ICON: Record<string, string> = {
  overzicht: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5',
  von: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  inbox: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3.5 6l8.5 7 8.5-7',
  agenda: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  projecten: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  relaties: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15.5c1.7.6 2.9 2 3.5 4.5',
}

export function Layout() {
  const counts = useCounts()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  useEffect(() => { setMenu(false) }, [loc.pathname])
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])
  const items = modules.filter((m) => m.inMenu !== false)
  const tabKey = (path: string) => path.replace(/^\//, '').split('/')[0]

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/overzicht" className="topbar-home" aria-label="Vandaag"><img className="topbar-logo" src={logo} alt="Vonstruct" /></Link>
        <nav className="topbar-nav">
          {items.map((m) => (
            <NavLink key={m.id} to={m.path} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
              {m.label}{(counts as Record<string, number>)[m.id] > 0 && <span className="nav-badge">{(counts as Record<string, number>)[m.id]}</span>}
            </NavLink>
          ))}
        </nav>
        <SearchButton />
        <button className="tb-von" onClick={() => window.dispatchEvent(new Event('von-open'))} title="Vraag VON (zijpaneel)">Vraag VON</button>
        <div className="tb-me" ref={menuRef}>
          <button className="tb-avatar" onClick={() => setMenu((x) => !x)} aria-haspopup="menu" aria-expanded={menu} title="Menu">OV</button>
          {menu && (
            <div className="tb-menu" role="menu">
              <div className="tb-menu-head"><b>Olivier Van Dyck</b><span>info@vonstruct.com</span></div>
              <Link to="/instellingen" role="menuitem">Instellingen</Link>
              <Link to="/regels" role="menuitem">Rekenregels</Link>
              <Link to="/mails" role="menuitem">Verstuurd door de app</Link>
              <Link to="/portaal" role="menuitem">Portaal bekijken als …</Link>
              <button role="menuitem" onClick={() => supabase.auth.signOut()}>Afmelden</button>
            </div>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Menu">
        {items.slice(0, 5).map((m) => (
          <NavLink key={m.id} to={m.path} className={({ isActive }) => (isActive ? 'on' : '')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TAB_ICON[tabKey(m.path)] ?? TAB_ICON.projecten} /></svg>
            <span>{m.label}</span>
            {(counts as Record<string, number>)[m.id] > 0 && <span className="tab-badge">{(counts as Record<string, number>)[m.id]}</span>}
          </NavLink>
        ))}
      </nav>
      {loc.pathname !== '/von' && <Von />}
      <ToastHost />
    </div>
  )
}
