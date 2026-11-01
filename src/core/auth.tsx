import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

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
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message === 'Invalid login credentials' ? 'E-mail of wachtwoord klopt niet.' : error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
      setMsg(error ? error.message : 'Account aangemaakt. Bevestig via de link in je mailbox en meld je daarna hier aan.')
      if (!error) setMode('in')
    }
    setBusy(false)
  }

  const reset = async () => {
    if (!email) return setMsg('Vul eerst je e-mailadres in.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL })
    setMsg(error ? error.message : 'Je krijgt een mail om je wachtwoord opnieuw in te stellen.')
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <div className="brand big">Vonstruct</div>
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Wachtwoord
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {mode === 'in' ? 'Aanmelden' : 'Account aanmaken'}
        </button>
        {msg && <p className="muted">{msg}</p>}
        <div className="row-links">
          <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'Eerste keer? Account aanmaken' : 'Ik heb al een account'}
          </button>
          {mode === 'in' && (
            <button type="button" className="link" onClick={reset}>
              Wachtwoord vergeten
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
