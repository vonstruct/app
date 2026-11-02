import { NavLink, Outlet } from 'react-router'
import { modules } from '../modules/registry'
import { supabase } from './supabase'
import logo from '../assets/vonstruct-logo.webp'

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <img className="topbar-logo" src={logo} alt="Vonstruct" />
        <nav>
          {modules
            .filter((m) => m.inMenu !== false)
            .map((m) => (
              <NavLink key={m.id} to={m.path} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
                {m.label}
              </NavLink>
            ))}
        </nav>
        <button className="link topbar-out" onClick={() => supabase.auth.signOut()}>
          Afmelden
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
