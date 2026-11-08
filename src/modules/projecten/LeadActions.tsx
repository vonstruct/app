import { useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import type { ProjectRow } from '../../core/projects'

type Tpl = { key: string; lang: string; label: string; body: string }
const LANG_NAME: Record<string, string> = { nl: 'Nederlands', en: 'Engels', de: 'Duits' }
const LINK = 'https://app.vonstruct.com'

/** Belgisch gsm-nummer naar het formaat van wa.me (32…). */
const waNumber = (phone: string | null) => {
  let d = (phone ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = '32' + d.slice(1)
  return d
}

const fill = (body: string, p: ProjectRow) => {
  const first = (p.client_name ?? '').split(' ')[0]
  return body
    .replaceAll('{voornaam}', first || 'klant')
    .replaceAll('{naam}', p.client_name ?? '')
    .replaceAll('{projectcode}', p.project_code)
    .replaceAll('{link}', LINK)
    .replaceAll('{email}', p.client_email ?? '')
}

/**
 * Aanvraag (8 nov 2026, Olivier): Go = enkel "het project gaat door" (naar Ontwerp; er gaat niets naar de klant), of Niet doorgaan.
 * Apart en optioneel: de klant uitnodigen in het klantenportaal en de vragenlijst sturen (Edge Function invite-client, survey true/false).
 * Er gaat pas een mail naar de klant na een bevestiging.
 */
export function LeadActions({ p, onDone }: { p: ProjectRow; onDone: () => void }) {
  const [tpls, setTpls] = useState<Tpl[]>([])
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [show, setShow] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lang, setLang] = useState('nl')
  const [login, setLogin] = useState<boolean | null>(null)
  useEffect(() => { supabase.from('message_templates').select('key,lang,label,body').then(({ data }) => setTpls((data as Tpl[]) ?? [])) }, [])
  // taal van de klant (instelbaar bij Klant); bepaalt de mail en het bericht
  useEffect(() => {
    if (p.client_id) supabase.from('clients').select('language').eq('id', p.client_id).single().then(({ data }) => setLang((data as { language?: string } | null)?.language ?? 'nl'))
  }, [p])
  // heeft de klant al een login voor het portaal?
  useEffect(() => {
    if (!p.client_email) { setLogin(false); return }
    supabase.rpc('portal_has_login', { p_email: p.client_email }).then(({ data }) => setLogin(data === true))
  }, [p.client_email])
  if (['closed', 'declined', 'on_hold'].includes(p.phase)) return null
  const early = ['lead', 'intake', 'survey', 'measuring'].includes(p.phase)
  const surveyDone = p.survey_status === 'submitted'
  if (!early && surveyDone && login && !show && !msg) return null

  const goAhead = async () => {
    if (!window.confirm('Gaat het project door? Het gaat naar Ontwerp. Er gaat niets naar de klant.')) return
    setBusy(true)
    const { error } = await supabase.from('projects').update({ phase: 'design' }).eq('id', p.project_id)
    setBusy(false)
    if (error) return setMsg({ kind: 'err', text: error.message })
    setMsg({ kind: 'ok', text: 'Het project gaat door: het staat nu op Ontwerp.' })
    onDone()
  }
  const invite = async (survey: boolean) => {
    if (!p.client_email) return setMsg({ kind: 'err', text: 'Vul eerst het e-mailadres van de klant in (bij Klant).' })
    const what = survey ? 'een mail met de vraag om de vragenlijst in te vullen' : login ? 'een nieuwe inloglink voor het klantenportaal' : 'een uitnodiging voor het klantenportaal'
    if (!window.confirm(`Er gaat ${what} naar ${p.client_email} (${LANG_NAME[lang] ?? lang}). Versturen?`)) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-client', { body: { project_code: p.project_code, survey } })
    setBusy(false)
    const e = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (e) return setMsg({ kind: 'err', text: e })
    const invited = (data as { mode: string }).mode === 'invited'
    setMsg({ kind: 'ok', text: survey ? `Vragenlijst gevraagd aan ${p.client_email}${invited ? ' (met een uitnodiging voor het portaal)' : ''}.`
      : invited ? `Uitnodiging verstuurd naar ${p.client_email}. Stuur eventueel ook het welkomstbericht via WhatsApp.` : `Nieuwe inloglink verstuurd naar ${p.client_email}.` })
    if (invited && !survey) setShow('welkom')
    setLogin(true)
    onDone()
  }
  const decline = async () => {
    if (!window.confirm('Dit project op "Niet doorgegaan" zetten?')) return
    await supabase.from('projects').update({ phase: 'declined' }).eq('id', p.project_id)
    setShow('niet_doorgaan')
    onDone()
  }
  const tpl = tpls.find((t) => t.key === show && t.lang === lang) ?? tpls.find((t) => t.key === show && t.lang === 'nl')
  const text = tpl ? fill(tpl.body, p) : ''
  const wa = waNumber(p.client_phone)

  return (
    <div className="panel lead-actions">
      {early && (
        <>
          <h2>Na de kennismaking</h2>
          <p className="muted">Gaat het project door? <strong>Go</strong> zet het project op Ontwerp. Er gaat niets naar de klant.</p>
          <div className="toolbar">
            <button className="primary" disabled={busy} onClick={goAhead}>Go: gaat door</button>
            <button disabled={busy} onClick={decline}>Niet doorgaan</button>
          </div>
        </>
      )}
      <div className="la-portal">
        <h3>Klantenportaal en vragenlijst <span className="muted small">· optioneel</span></h3>
        <p className="muted small">
          {login === null ? '' : login ? 'De klant heeft toegang tot het portaal.' : 'De klant is nog niet uitgenodigd.'}
          {surveyDone ? ' Vragenlijst ingediend.' : p.survey_status === 'open' ? ' Vragenlijst begonnen, nog niet ingediend.' : ''}
          {' '}Er gaat pas iets naar de klant als je hieronder klikt en bevestigt.
        </p>
        <div className="toolbar">
          {login ? <button className="link" disabled={busy} onClick={() => invite(false)}>Inloglink opnieuw sturen</button>
            : <button disabled={busy} onClick={() => invite(false)}>Klant uitnodigen in het portaal</button>}
          {!surveyDone && <button disabled={busy} onClick={() => invite(true)}>Vragenlijst sturen</button>}
          {!surveyDone && login && <button className="link" onClick={() => setShow('vragenlijst_herinnering')}>Herinnering vragenlijst (WhatsApp)</button>}
        </div>
      </div>
      {msg && <p className={msg.kind === 'ok' ? 'notice' : 'auth-msg error'}>{msg.text}</p>}
      {tpl && (
        <div className="msg-box">
          <div className="msg-head"><strong>{tpl.label} <span className="muted">· {LANG_NAME[tpl.lang] ?? tpl.lang}</span></strong><span className="muted small">Pas de tekst aan onder Regels → Berichten</span></div>
          <textarea readOnly rows={5} value={text} />
          <div className="toolbar">
            {wa ? (
              <a className="btn-wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Versturen via WhatsApp</a>
            ) : <span className="muted small">Geen telefoonnummer: vul het in bij Klant om via WhatsApp te sturen.</span>}
            {p.client_email && <a className="btn-plain" href={`mailto:${p.client_email}?subject=${encodeURIComponent('Je project bij Vonstruct (' + p.project_code + ')')}&body=${encodeURIComponent(text)}`}>Per mail</a>}
            <button onClick={() => navigator.clipboard.writeText(text)}>Kopiëren</button>
          </div>
        </div>
      )}
    </div>
  )
}
