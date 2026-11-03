import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import logo from '../assets/vonstruct-logo.webp'
import { LangPicker, Portal, type PortalRole } from '../portal/Portal'
import { ActionResult } from '../portal/ActionResult'
import { MfaGate } from './Mfa'
import { storeLang, storedLang, tr, type Lang } from '../portal/i18n'

type Role = 'beheerder' | PortalRole

/**
 * Login-poort. Na het inloggen bepaalt Supabase (functie my_role) de rol:
 * beheerder → de volledige app; klant, partner of onderaannemer → het portaal; anders geen toegang.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  // bevestiging via een link in de mail: publiek, zonder inloggen
  if (window.location.hash.startsWith('#/actie')) return <ActionResult />
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
  if (role === 'beheerder') return <MfaGate session={session}>{children}</MfaGate>
  if (role) return <Portal role={role} />
  const t = tr(storedLang())
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
            <h2>{t.noAccess}</h2>
            <p className="muted">{t.noAccessText(session.user.email ?? '')}</p>
          </header>
          <button className="auth-alt" onClick={() => supabase.auth.signOut()}>
            {t.signOut}
          </button>
        </div>
      </main>
    </div>
  )
}

function Login() {
  const [lang, setLang] = useState<Lang>(storedLang)
  const t = tr(lang)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Geen zelfregistratie: klanten, partners en medewerkers krijgen een uitnodiging per mail.
  const linkError = (() => { try { const h = sessionStorage.getItem('authLinkError'); sessionStorage.removeItem('authLinkError'); return h } catch { return null } })()
  const [mode, setMode] = useState<'pw' | 'link'>(linkError ? 'link' : 'pw')
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(
    linkError ? { error: true, text: tr(storedLang()).linkUsed } : null,
  )
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'pw') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ error: true, text: error.message === 'Invalid login credentials' ? t.wrongPw : error.message })
    } else {
      // via Edge Function send-login-link: mail in huisstijl, enkel naar gekende adressen
      const { error } = await supabase.functions.invoke('send-login-link', { body: { email, kind: 'magiclink', lang } })
      setMsg(error ? { error: true, text: t.linkFail } : { error: false, text: t.linkSent(email) })
    }
    setBusy(false)
  }

  const reset = async () => {
    if (!email) return setMsg({ error: true, text: t.emailFirst })
    const { error } = await supabase.functions.invoke('send-login-link', { body: { email, kind: 'recovery', lang } })
    setMsg(error ? { error: true, text: t.mailFail } : { error: false, text: t.resetSent(email) })
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
          <h1>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-lang"><LangPicker lang={lang} label={t.language} onPick={(l) => { setLang(l); storeLang(l); setMsg(null) }} /></div>
        <form className="auth-form" onSubmit={submit}>
          <header>
            <h2>{t.welcome}</h2>
            <p className="muted">{mode === 'pw' ? t.loginPw : t.loginLink}</p>
          </header>

          <label className="auth-field">
            <span>{t.email}</span>
            <input type="email" autoComplete="username" placeholder={t.emailPh} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>

          {mode === 'pw' && (
            <label className="auth-field">
              <span className="auth-field-head">
                {t.password}
                <button type="button" className="link" onClick={reset}>
                  {t.forgot}
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
                <button type="button" className="auth-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? t.hide : t.show}>
                  {showPw ? t.hide : t.show}
                </button>
              </span>
            </label>
          )}

          {msg && <p className={msg.error ? 'auth-msg error' : 'auth-msg'} role="status">{msg.text}</p>}

          <button type="submit" className="primary auth-submit" disabled={busy}>
            {busy ? <span className="auth-spinner" aria-label="…" /> : mode === 'pw' ? t.signIn : t.sendLink}
          </button>

          <div className="auth-or"><span>{t.or}</span></div>

          <button type="button" className="auth-alt" onClick={() => { setMode(mode === 'pw' ? 'link' : 'pw'); setMsg(null) }}>
            {mode === 'pw' ? t.useLink : t.usePw}
          </button>

          <p className="auth-switch muted">{t.noAccessYet}</p>
        </form>
        <footer className="auth-foot muted">© {new Date().getFullYear()} Vonstruct</footer>
      </main>
    </div>
  )
}

/** Na een link "nieuw wachtwoord": wachtwoord kiezen. */
function NewPassword({ onDone }: { onDone: () => void }) {
  const t = tr(storedLang())
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return setMsg(t.pwShort)
    if (pw !== pw2) return setMsg(t.pwDiff)
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
            <h2>{t.newPw}</h2>
            <p className="muted">{t.newPwIntro}</p>
          </header>
          <label className="auth-field"><span>{t.newPw}</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
          <label className="auth-field"><span>{t.repeat}</span><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          {msg && <p className="auth-msg error">{msg}</p>}
          <button type="submit" className="primary auth-submit" disabled={busy}>{t.save}</button>
        </form>
      </main>
    </div>
  )
}
