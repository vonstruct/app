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

/** Na de kennismaking: Go (klant uitnodigen + welkomstbericht) of Niet doorgaan. */
export function LeadActions({ p, onDone }: { p: ProjectRow; onDone: () => void }) {
  const [tpls, setTpls] = useState<Tpl[]>([])
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [show, setShow] = useState<string | null>(p.phase === 'intake' ? 'welkom' : null)
  const [busy, setBusy] = useState(false)
  const [lang, setLang] = useState('nl')
  useEffect(() => { supabase.from('message_templates').select('key,lang,label,body').then(({ data }) => setTpls((data as Tpl[]) ?? [])) }, [])
  // taal van de klant (instelbaar bij Klant); bepaalt de mail en het bericht
  useEffect(() => {
    if (p.client_id) supabase.from('clients').select('language').eq('id', p.client_id).single().then(({ data }) => setLang((data as { language?: string } | null)?.language ?? 'nl'))
  }, [p])
  if (['closed', 'declined', 'on_hold'].includes(p.phase)) return null
  const early = ['lead', 'intake', 'survey'].includes(p.phase)
  if (!early && p.survey_status === 'submitted' && !show) return null

  const go = async () => {
    if (!p.client_email) return setMsg({ kind: 'err', text: 'Vul eerst het e-mailadres van de klant in (hiernaast bij Klant).' })
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-client', { body: { project_code: p.project_code } })
    setBusy(false)
    const e = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (e) return setMsg({ kind: 'err', text: e })
    setMsg({ kind: 'ok', text: (data as { mode: string }).mode === 'invited'
      ? `Uitnodiging verstuurd naar ${p.client_email}. Stuur nu ook het welkomstbericht via WhatsApp.`
      : `${p.client_email} had al toegang: er is een nieuwe inloglink verstuurd.` })
    setShow('welkom')
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
      <h2>{early ? 'Na de kennismaking' : 'Klantenportaal en vragenlijst'}</h2>
      {p.phase === 'lead' && (
        <>
          <p className="muted">Gaat het project door? <strong>Go</strong> stuurt de klant een uitnodiging per mail (in het {LANG_NAME[lang] ?? lang}, te wijzigen bij Klant) om in te loggen op het klantenportaal en de vragenlijst in te vullen.</p>
          <div className="toolbar">
            <button className="primary" disabled={busy} onClick={go}>{busy ? 'Versturen…' : 'Go: klant uitnodigen'}</button>
            <button onClick={decline}>Niet doorgaan</button>
          </div>
        </>
      )}
      {!early && (
        <>
          <p className="muted">Stuur de klant een uitnodiging per mail (in het {LANG_NAME[lang] ?? lang}) om in te loggen op het klantenportaal en de vragenlijst in te vullen. De fase van het project blijft zoals ze is.</p>
          <div className="toolbar">
            <button className="primary" disabled={busy} onClick={go}>{busy ? 'Versturen…' : 'Vragenlijst sturen'}</button>
            <button className="link" onClick={() => setShow('vragenlijst_herinnering')}>Herinnering vragenlijst</button>
          </div>
        </>
      )}
      {early && p.phase !== 'lead' && (
        <div className="toolbar">
          <span className="chip ok">Klant uitgenodigd</span>
          <button className="link" disabled={busy} onClick={go}>Uitnodiging opnieuw sturen</button>
          {p.survey_status !== 'submitted' && <button className="link" onClick={() => setShow('vragenlijst_herinnering')}>Herinnering vragenlijst</button>}
        </div>
      )}
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
