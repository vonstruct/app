import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import logo from '../assets/vonstruct-logo.webp'
import { Portal, type PortalRole } from '../portal/Portal'

type Role = 'beheerder' | PortalRole

/**
 * Login-poort. Na het inloggen bepaalt Supabase (functie my_role) de rol:
 * beheerder → de volledige app; klant, partner of onderaannemer → het portaal; anders geen toegang.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [role, setRole] = useState<Role | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setRole(undefined)
    supabase.rpc('my_role').then(({ data }) => setRole((data as Role | null) ?? null))
  }, [session])

  if (session === undefined) return <div className="center muted">Laden…</div>
  if (!session) return <Login />
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />
  if (role === undefined) return <div className="center muted">Toegang controleren…</div>
  if (role === 'beheerder') return <>{children}</>
  if (role) return <Portal role={role} />
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-hero-top">
          <img className="auth-logo" src={logo} alt="Vonstruct" />
          <span className="auth-tagline">Custom interiors</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <header>
            <h2>Nog geen toegang</h2>
            <p className="muted">{session.user.email} is nog niet aan een project gekoppeld. Neem contact op met Vonstruct.</p>
          </header>
          <button className="auth-alt" onClick={() => supabase.auth.signOut()}>
            Afmelden
          </button>
        </div>
      </main>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Geen zelfregistratie: klanten, partners en medewerkers krijgen een uitnodiging per mail.
  const linkError = (() => { try { const h = sessionStorage.getItem('authLinkError'); sessionStorage.removeItem('authLinkError'); return h } catch { return null } })()
  const [mode, setMode] = useState<'pw' | 'link'>(linkError ? 'link' : 'pw')
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(
    linkError ? { error: true, text: 'Deze inloglink is al gebruikt of verlopen (een link werkt maar één keer). Vul je e-mailadres in, dan krijg je meteen een nieuwe.' } : null,
  )
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'pw') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ error: true, text: error.message === 'Invalid login credentials' ? 'E-mail of wachtwoord klopt niet.' : error.message })
    } else {
      // via Edge Function send-login-link: mail in huisstijl, enkel naar gekende adressen
      const { error } = await supabase.functions.invoke('send-login-link', { body: { email, kind: 'magiclink' } })
      setMsg(
        error
          ? { error: true, text: 'De inloglink kon niet verstuurd worden. Probeer het over een minuut opnieuw.' }
          : { error: false, text: `Als ${email} bij ons gekend is, krijg je binnen een minuut een mail met een inloglink. Kijk ook bij ongewenste mail.` },
      )
    }
    setBusy(false)
  }

  const reset = async () => {
    if (!email) return setMsg({ error: true, text: 'Vul eerst je e-mailadres in.' })
    const { error } = await supabase.functions.invoke('send-login-link', { body: { email, kind: 'recovery' } })
    setMsg(error ? { error: true, text: 'De mail kon niet verstuurd worden. Probeer het over een minuut opnieuw.' }
      : { error: false, text: `Als ${email} bij ons gekend is, krijg je een mail om een nieuw wachtwoord te kiezen.` })
  }

  return (
    <div className="auth">
      <aside className="auth-hero">
        <svg className="auth-lines" aria-hidden="true" viewBox="20 120 510 600" preserveAspectRatio="xMaxYMin meet">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="90" y="140" width="420" height="520" />
            <line x1="90" y1="270" x2="510" y2="270" />
            <line x1="90" y1="400" x2="510" y2="400" />
            <line x1="90" y1="530" x2="510" y2="530" />
            <line x1="300" y1="140" x2="300" y2="270" />
            <line x1="300" y1="530" x2="300" y2="660" />
            <rect x="110" y="160" width="170" height="90" />
            <rect x="320" y="160" width="170" height="90" />
            <rect x="110" y="550" width="170" height="90" />
            <rect x="320" y="550" width="170" height="90" />
            <line x1="40" y1="140" x2="40" y2="660" strokeDasharray="4 6" />
            <line x1="32" y1="140" x2="48" y2="140" />
            <line x1="32" y1="660" x2="48" y2="660" />
            <line x1="90" y1="700" x2="510" y2="700" strokeDasharray="4 6" />
            <line x1="90" y1="692" x2="90" y2="708" />
            <line x1="510" y1="692" x2="510" y2="708" />
          </g>
        </svg>
        <div className="auth-hero-top">
          <img className="auth-logo" src={logo} alt="Vonstruct" />
          <span className="auth-tagline">Custom interiors</span>
        </div>
        <div className="auth-hero-text" aria-hidden="true">
          <h1>Maatwerk, van eerste schets tot plaatsing.</h1>
          <p>Je ontwerpen, afspraken en planning — altijd op één plek.</p>
        </div>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <header>
            <h2>Welkom</h2>
            <p className="muted">{mode === 'pw' ? 'Meld je aan met je e-mailadres en wachtwoord.' : 'We mailen je een link om meteen in te loggen.'}</p>
          </header>

          <label className="auth-field">
            <span>E-mail</span>
            <input type="email" autoComplete="username" placeholder="naam@voorbeeld.be" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>

          {mode === 'pw' && (
            <label className="auth-field">
              <span className="auth-field-head">
                Wachtwoord
                <button type="button" className="link" onClick={reset}>
                  Vergeten?
                </button>
              </span>
              <span className="auth-pw">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="auth-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}>
                  {showPw ? 'Verberg' : 'Toon'}
                </button>
              </span>
            </label>
          )}

          {msg && <p className={msg.error ? 'auth-msg error' : 'auth-msg'} role="status">{msg.text}</p>}

          <button type="submit" className="primary auth-submit" disabled={busy}>
            {busy ? <span className="auth-spinner" aria-label="Bezig" /> : mode === 'pw' ? 'Aanmelden' : 'Stuur inloglink'}
          </button>

          <div className="auth-or"><span>of</span></div>

          <button type="button" className="auth-alt" onClick={() => { setMode(mode === 'pw' ? 'link' : 'pw'); setMsg(null) }}>
            {mode === 'pw' ? 'Inloggen met een link per mail' : 'Inloggen met wachtwoord'}
          </button>

          <p className="auth-switch muted">Nog geen toegang? Je ontvangt een uitnodiging van Vonstruct zodra je project start.</p>
        </form>
        <footer className="auth-foot muted">© {new Date().getFullYear()} Vonstruct</footer>
      </main>
    </div>
  )
}

/** Na een link "nieuw wachtwoord": wachtwoord kiezen. */
function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return setMsg('Kies minstens 8 tekens.')
    if (pw !== pw2) return setMsg('De twee wachtwoorden zijn niet gelijk.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg(error.message)
    onDone()
  }
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-hero-top">
          <img className="auth-logo" src={logo} alt="Vonstruct" />
          <span className="auth-tagline">Custom interiors</span>
        </div>
      </aside>
      <main className="auth-main">
        <form className="auth-form" onSubmit={save}>
          <header>
            <h2>Nieuw wachtwoord</h2>
            <p className="muted">Kies een wachtwoord van minstens 8 tekens.</p>
          </header>
          <label className="auth-field"><span>Nieuw wachtwoord</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
          <label className="auth-field"><span>Herhaal</span><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          {msg && <p className="auth-msg error">{msg}</p>}
          <button type="submit" className="primary auth-submit" disabled={busy}>Bewaren</button>
        </form>
      </main>
    </div>
  )
}
