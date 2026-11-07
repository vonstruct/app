import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import logo from '../assets/vonstruct-logo.webp'

/**
 * Tweestapsverificatie (MFA, TOTP) voor de beheerder.
 * - Nog geen MFA → scherm "Beveilig je account" (QR-code scannen, code invullen). Niet over te slaan.
 * - MFA ingesteld maar deze sessie nog niet → code van 6 cijfers vragen.
 * De database (is_app_user) geeft beheergegevens enkel vrij met aal2 zodra er een geverifieerde factor is.
 * Portalen (klant, onderaannemer, partner) gebruiken dit niet.
 */
type State = { kind: 'checking' } | { kind: 'ok' } | { kind: 'setup' } | { kind: 'challenge'; factorId: string } | { kind: 'error'; text: string }

export function MfaGate({ session, children }: { session: Session; children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'checking' })

  // 7 nov 2026: een tijdelijke fout (netwerk) sluit je niet meer buiten. Was de controle al gelukt, dan blijft de app open;
  // anders een melding met "Opnieuw proberen". Lukt het ophalen van de factoren niet, dan niet ten onrechte "instellen" tonen.
  const check = useCallback(async () => {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !aal) return setState((s) => (s.kind === 'ok' ? s : { kind: 'error', text: 'De beveiliging kon even niet gecontroleerd worden (verbinding).' }))
    if (aal.currentLevel === 'aal2') return setState({ kind: 'ok' })
    const { data: f, error: fe } = await supabase.auth.mfa.listFactors()
    if (fe || !f) return setState((s) => (s.kind === 'ok' ? s : { kind: 'error', text: 'De beveiliging kon even niet gecontroleerd worden (verbinding).' }))
    const totp = f.totp?.find((x) => x.status === 'verified')
    setState(totp ? { kind: 'challenge', factorId: totp.id } : { kind: 'setup' })
  }, [])

  // enkel bij een andere gebruiker opnieuw controleren, niet bij elke vernieuwing van de login (elk uur)
  useEffect(() => { check() }, [check, session.user.id])

  if (state.kind === 'ok') return <>{children}</>
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-hero-top">
          <img className="auth-logo" src={logo} alt="Vonstruct" />
          <span className="auth-tagline">Custom interiors</span>
        </div>
      </aside>
      <main className="auth-main">
        {state.kind === 'checking' && <p className="muted">Beveiliging controleren…</p>}
        {state.kind === 'error' && (
          <div className="auth-form">
            <p className="auth-msg error">{state.text}</p>
            <button className="primary" onClick={() => { setState({ kind: 'checking' }); check() }}>Opnieuw proberen</button>
            <button className="auth-alt" onClick={() => supabase.auth.signOut()}>Afmelden</button>
          </div>
        )}
        {state.kind === 'challenge' && <Challenge factorId={state.factorId} onDone={check} />}
        {state.kind === 'setup' && <Setup onDone={check} />}
      </main>
    </div>
  )
}

function CodeInput({ onCode, busy }: { onCode: (code: string) => void; busy: boolean }) {
  const [code, setCode] = useState('')
  return (
    <label className="auth-field">
      <span>Code van 6 cijfers</span>
      <input
        className="mfa-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="123456"
        value={code}
        disabled={busy}
        autoFocus
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6)
          setCode(v)
          if (v.length === 6) onCode(v)
        }}
      />
    </label>
  )
}

function Challenge({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [key, setKey] = useState(0)
  const verify = async (code: string) => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (error) { setMsg('Die code klopt niet of is verlopen. Probeer de volgende code.'); setKey((k) => k + 1); return }
    onDone()
  }
  return (
    <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
      <header>
        <h2>Tweede stap</h2>
        <p className="muted">Open je authenticator-app en typ de code voor Vonstruct.</p>
      </header>
      <CodeInput key={key} onCode={verify} busy={busy} />
      {msg && <p className="auth-msg error" role="status">{msg}</p>}
      <button type="button" className="auth-alt" onClick={() => supabase.auth.signOut()}>Afmelden</button>
      <p className="muted small">Gsm kwijt of nieuwe gsm? De tweestapsverificatie kan gereset worden in Supabase (Authentication → Users → MFA); daarna stel je ze hier opnieuw in.</p>
    </form>
  )
}

function Setup({ onDone }: { onDone: () => void }) {
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    let gone = false
    ;(async () => {
      // halfafgewerkte pogingen opruimen, anders weigert Supabase een nieuwe met dezelfde naam
      const { data: f } = await supabase.auth.mfa.listFactors()
      for (const x of f?.all ?? []) if (x.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: x.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Vonstruct ' + new Date().toISOString().slice(0, 10), issuer: 'Vonstruct' })
      if (gone) return
      if (error || !data) return setMsg('Instellen lukt niet: ' + (error?.message ?? 'onbekende fout'))
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    })()
    return () => { gone = true }
  }, [])

  const verify = async (code: string) => {
    if (!enroll) return
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code })
    setBusy(false)
    if (error) { setMsg('Die code klopt niet. Wacht op de volgende code en probeer opnieuw.'); setKey((k) => k + 1); return }
    onDone()
  }

  return (
    <form className="auth-form mfa-setup" onSubmit={(e) => e.preventDefault()}>
      <header>
        <h2>Beveilig je account</h2>
        <p className="muted">Als beheerder log je voortaan in met je wachtwoord én een code van je gsm. Eén keer instellen:</p>
      </header>
      <ol className="mfa-steps">
        <li>Open <b>Microsoft Authenticator</b> (of een andere authenticator-app) en kies <b>+ → Ander account</b>.</li>
        <li>Scan deze QR-code.</li>
      </ol>
      {enroll ? (
        <>
          <img className="mfa-qr" src={enroll.qr} alt="QR-code voor de authenticator-app" />
          <details className="small">
            <summary>Lukt scannen niet? Typ deze sleutel</summary>
            <code className="mfa-secret">{enroll.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </details>
          <ol className="mfa-steps" start={3}><li>Typ de code die de app toont.</li></ol>
          <CodeInput key={key} onCode={verify} busy={busy} />
        </>
      ) : !msg && <p className="muted">QR-code maken…</p>}
      {msg && <p className="auth-msg error" role="status">{msg}</p>}
      <button type="button" className="auth-alt" onClick={() => supabase.auth.signOut()}>Afmelden</button>
    </form>
  )
}
