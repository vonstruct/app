import { NavLink, Outlet } from 'react-router'
import { modules } from '../modules/registry'
import { supabase } from './supabase'

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Vonstruct</span>
        <nav>
          {modules
            .filter((m) => m.inMenu !== false)
            .map((m) => (
              <NavLink key={m.id} to={m.path} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
                {m.label}
              </NavLink>
            ))}
        </nav>
        <button className="link" onClick={() => supabase.auth.signOut()}>
          Afmelden
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
