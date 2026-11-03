import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { HandoverDoc } from '../core/HandoverDoc'
import { SignaturePad } from '../core/SignaturePad'
import { printQuote, type Company } from '../core/QuoteDoc'
import type { Lang } from './i18n'

/** Klantenportaal: oplevering (PV bekijken en ondertekenen), werkpunten, garantie en "Probleem melden". */
type P = {
  project_code: string; title: string | null; warranty_until: string | null; company: Company
  handover: { id: string; status: string; date: string | null; text: string | null; notes: string | null; signature: { name: string; at: string; hash: string; png: string | null } | null } | null
  items: { id: string; title: string; description: string | null; status: string; due: string | null; done_at: string | null; source: string }[]
}
const T = {
  nl: { title: 'Oplevering en nazorg', pv: 'Proces-verbaal van oplevering', toSign: 'Klaar om te ondertekenen', signed: 'Ondertekend', items: 'Werkpunten', open: 'nog af te werken', done: 'klaar', none: 'Geen openstaande punten.', warranty: (d: string) => `Garantie tot ${d}`, report: 'Probleem melden', reportText: 'Merk je iets op? Beschrijf het kort, eventueel met een foto. Olivier volgt het meteen op.', what: 'Wat is er aan de hand?', more: 'Meer uitleg (optioneel)', photo: 'Foto (optioneel)', send: 'Melding versturen', thanks: 'Bedankt, je melding is goed ontvangen.', name: 'Je volledige naam', agree: (c: string) => `Ik heb het proces-verbaal van oplevering voor project ${c} gelezen en aanvaard de oplevering, met de vermelde werkpunten.`, sign: 'Onderteken', signHere: 'Teken hier je handtekening', clear: 'Wissen', ok: 'Bedankt! Het PV is ondertekend; je krijgt een bevestiging per mail.', print: 'Afdrukken / PDF', fromYou: 'jouw melding' },
  en: { title: 'Handover and aftercare', pv: 'Handover report', toSign: 'Ready to sign', signed: 'Signed', items: 'Items', open: 'still to be finished', done: 'done', none: 'No open items.', warranty: (d: string) => `Warranty until ${d}`, report: 'Report a problem', reportText: 'Notice something? Describe it briefly, with a photo if you like. Olivier will follow up right away.', what: 'What is the problem?', more: 'More details (optional)', photo: 'Photo (optional)', send: 'Send report', thanks: 'Thank you, we have received your report.', name: 'Your full name', agree: (c: string) => `I have read the handover report for project ${c} and accept the handover, with the listed items.`, sign: 'Sign', signHere: 'Draw your signature here', clear: 'Clear', ok: 'Thank you! The report is signed; you will receive a confirmation by email.', print: 'Print / PDF', fromYou: 'your report' },
  de: { title: 'Abnahme und Nachbetreuung', pv: 'Abnahmeprotokoll', toSign: 'Bereit zur Unterschrift', signed: 'Unterschrieben', items: 'Offene Punkte', open: 'noch zu erledigen', done: 'erledigt', none: 'Keine offenen Punkte.', warranty: (d: string) => `Garantie bis ${d}`, report: 'Problem melden', reportText: 'Fällt Ihnen etwas auf? Beschreiben Sie es kurz, gerne mit Foto. Olivier kümmert sich sofort darum.', what: 'Was ist das Problem?', more: 'Weitere Angaben (optional)', photo: 'Foto (optional)', send: 'Meldung senden', thanks: 'Danke, wir haben Ihre Meldung erhalten.', name: 'Ihr vollständiger Name', agree: (c: string) => `Ich habe das Abnahmeprotokoll für Projekt ${c} gelesen und nehme die Abnahme mit den aufgeführten Punkten an.`, sign: 'Unterschreiben', signHere: 'Unterschreiben Sie hier', clear: 'Löschen', ok: 'Vielen Dank! Das Protokoll ist unterschrieben; Sie erhalten eine Bestätigung per E-Mail.', print: 'Drucken / PDF', fromYou: 'Ihre Meldung' },
}
const loc = (l: Lang) => (l === 'de' ? 'de-DE' : l === 'en' ? 'en-GB' : 'nl-BE')
const dd = (d: string | null, l: Lang) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString(loc(l), { day: 'numeric', month: 'long', year: 'numeric' }) : '')

export function Aftercare({ lang, preview = false }: { lang: Lang; preview?: boolean }) {
  const [rows, setRows] = useState<P[] | null>(null)
  const load = () => { if (preview) return setRows([]); supabase.rpc('portal_aftercare').then(({ data }) => setRows((data as P[]) ?? [])) }
  useEffect(load, [preview])
  if (!rows?.length) return null
  const t = T[lang]
  return <>{rows.map((p) => <Project key={p.project_code} p={p} lang={lang} onChange={load} t={t} />)}</>
}

function Project({ p, lang, onChange, t }: { p: P; lang: Lang; onChange: () => void; t: (typeof T)['nl'] }) {
  const [openPv, setOpenPv] = useState(() => new URLSearchParams(window.location.search).get('oplevering') === p.handover?.id)
  const [name, setName] = useState('')
  const [png, setPng] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rep, setRep] = useState({ title: '', text: '' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const h = p.handover
  const openItems = p.items.filter((i) => i.status === 'open')
  const sign = async () => {
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('portal_handover_sign', { p_id: h!.id, p_name: name.trim(), p_png: png, p_consent: t.agree(p.project_code) })
    setBusy(false)
    if (error) return setErr(error.message)
    setMsg(t.ok); onChange()
  }
  const report = async () => {
    setBusy(true); setErr(null)
    const photos: string[] = []
    if (file) {
      const path = `${p.project_code}/werkpunten/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`
      const { error } = await supabase.storage.from('project-uploads').upload(path, file, { contentType: file.type })
      if (!error) photos.push(path)
    }
    const { error } = await supabase.rpc('portal_report_issue', { p_code: p.project_code, p_title: rep.title, p_description: rep.text, p_photos: photos })
    setBusy(false)
    if (error) return setErr(error.message)
    setRep({ title: '', text: '' }); setFile(null); setMsg(t.thanks); onChange()
  }
  return (
    <section className="aftercare">
      <h2 className="portal-h">{t.title}{p.title ? ' · ' + p.title : ''}</h2>
      {p.warranty_until && <p className="aftercare-war">{t.warranty(dd(p.warranty_until, lang))}</p>}
      {h && (
        <div className="aftercare-pv">
          <button className={'pquote ' + (h.status === 'verstuurd' ? 'verstuurd' : 'aanvaard')} onClick={() => setOpenPv(!openPv)}>
            <span className="pquote-st">{h.status === 'ondertekend' ? t.signed : t.toSign}</span><b>{t.pv}</b><span>{dd(h.date, lang)}</span><span /><span className="muted">→</span>
          </button>
          {openPv && (
            <>
              <div className="pquote-bar"><span /><button onClick={printQuote}>{t.print}</button></div>
              <div className="qpreview"><HandoverDoc lang={lang} h={{ project_code: p.project_code, project_title: p.title, date: h.date, text: h.text, notes: h.notes }} items={openItems.map((i) => ({ title: i.title, description: i.description, due: i.due }))} company={p.company ?? {}} signature={h.signature ? { name: h.signature.name, at: h.signature.at, hash: h.signature.hash, png: h.signature.png } : null} /></div>
              {h.status === 'verstuurd' && !msg && (
                <section className="pquote-sign">
                  <input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  <SignaturePad onChange={setPng} hint={t.signHere} clearLabel={t.clear} />
                  <label className="pquote-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{t.agree(p.project_code)}</label>
                  {err && <p className="error">{err}</p>}
                  <button className="primary" disabled={busy || !png || !agree || name.trim().length < 3} onClick={sign}>{t.sign}</button>
                </section>
              )}
            </>
          )}
        </div>
      )}
      <h3 className="aftercare-h">{t.items}</h3>
      {p.items.length === 0 ? <p className="muted">{t.none}</p> : (
        <ul className="aftercare-items">
          {p.items.map((i) => <li key={i.id} className={i.status}><span>{i.status === 'klaar' ? '✓' : '○'}</span><div><b>{i.title}</b>{i.description && <small>{i.description}</small>}<small>{i.status === 'klaar' ? t.done + ' ' + dd(i.done_at, lang) : t.open}{i.source === 'klant' ? ' · ' + t.fromYou : ''}</small></div></li>)}
        </ul>
      )}
      {msg && <p className="pquote-msg">{msg}</p>}
      <details className="aftercare-report">
        <summary>{t.report}</summary>
        <p className="muted">{t.reportText}</p>
        <input placeholder={t.what} value={rep.title} onChange={(e) => setRep({ ...rep, title: e.target.value })} />
        <textarea placeholder={t.more} rows={3} value={rep.text} onChange={(e) => setRep({ ...rep, text: e.target.value })} />
        <label className="muted small">{t.photo} <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy || rep.title.trim().length < 3} onClick={report}>{t.send}</button>
      </details>
    </section>
  )
}

/** Portaal onderaannemer/partner: eigen werkpunten afwerken (met foto). */
type Mine = { id: string; project_code: string; title: string; description: string | null; due: string | null; address: string | null; photos: string[] }
const PT = {
  nl: { title: 'Werkpunten', done: 'Klaar', note: 'Wat heb je gedaan? (optioneel)', photo: 'Foto', due: 'tegen', thanks: 'Bedankt!' },
  en: { title: 'Items to fix', done: 'Done', note: 'What did you do? (optional)', photo: 'Photo', due: 'by', thanks: 'Thank you!' },
  de: { title: 'Offene Punkte', done: 'Erledigt', note: 'Was haben Sie gemacht? (optional)', photo: 'Foto', due: 'bis', thanks: 'Danke!' },
}
export function MyPunch({ lang, preview = false }: { lang: Lang; preview?: boolean }) {
  const t = PT[lang]
  const [rows, setRows] = useState<Mine[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const load = () => { if (preview) return; supabase.rpc('portal_my_punch').then(({ data }) => setRows((data as Mine[]) ?? [])) }
  useEffect(load, [preview])
  if (!rows.length) return null
  const done = async (i: Mine) => {
    const photos: string[] = []
    if (file) {
      const path = `${i.project_code}/werkpunten/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`
      const { error } = await supabase.storage.from('project-uploads').upload(path, file, { contentType: file.type })
      if (!error) photos.push(path)
    }
    await supabase.rpc('portal_punch_done', { p_id: i.id, p_note: note, p_photos: photos })
    setOpen(null); setNote(''); setFile(null); load()
  }
  return (
    <section className="aftercare">
      <h2 className="portal-h">{t.title}</h2>
      <ul className="aftercare-items">
        {rows.map((i) => (
          <li key={i.id} className="open">
            <span>○</span>
            <div style={{ flex: 1 }}>
              <b>{i.title}</b>{i.description && <small>{i.description}</small>}
              <small>{i.project_code}{i.address ? ' · ' + i.address : ''}{i.due ? ' · ' + t.due + ' ' + i.due.split('-').reverse().join('/') : ''}</small>
              {open === i.id ? (
                <div className="aftercare-done">
                  <textarea rows={2} placeholder={t.note} value={note} onChange={(e) => setNote(e.target.value)} />
                  <label className="muted small">{t.photo} <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
                  <button className="primary" onClick={() => done(i)}>{t.done}</button>
                </div>
              ) : <button onClick={() => setOpen(i.id)}>{t.done}</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
