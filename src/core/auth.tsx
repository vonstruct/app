import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import logo from '../assets/vonstruct-logo.webp'

/** Login-poort: zonder geldige sessie én toegang (tabel app_users) zie je niets. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setAllowed(null)
    supabase.rpc('is_app_user').then(({ data }) => setAllowed(data === true))
  }, [session])

  if (session === undefined) return <div className="center muted">Laden…</div>
  if (!session) return <Login />
  if (allowed === null) return <div className="center muted">Toegang controleren…</div>
  if (!allowed)
    return (
      <div className="center card">
        <h2>Geen toegang</h2>
        <p>{session.user.email} staat niet op de lijst met gebruikers.</p>
        <button onClick={() => supabase.auth.signOut()}>Afmelden</button>
      </div>
    )
  return <>{children}</>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Geen zelfregistratie: klanten, partners en medewerkers krijgen een uitnodiging per mail.
  const [mode, setMode] = useState<'pw' | 'link'>('pw')
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const redirectTo = window.location.origin + window.location.pathname

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'pw') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ error: true, text: error.message === 'Invalid login credentials' ? 'E-mail of wachtwoord klopt niet.' : error.message })
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
      setMsg(
        error
          ? { error: true, text: error.message.includes('Signups not allowed') ? 'Dit e-mailadres is niet bij ons gekend. Neem contact op met Vonstruct.' : error.message }
          : { error: false, text: `We stuurden een inloglink naar ${email}. Open de mail op dit toestel.` },
      )
    }
    setBusy(false)
  }

  const reset = async () => {
    if (!email) return setMsg({ error: true, text: 'Vul eerst je e-mailadres in.' })
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setMsg(error ? { error: true, text: error.message } : { error: false, text: 'Je krijgt een mail om je wachtwoord opnieuw in te stellen.' })
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
