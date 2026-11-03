import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { QuoteDoc, printQuote, quoteTotals, type Company, type QLine } from '../core/QuoteDoc'
import type { Lang } from './i18n'

/** Offertes in het klantenportaal: bekijken, afdrukken, online akkoord geven (naam typen) of weigeren. Via portal_my_quotes / portal_quote_decide. */
type PQuote = { id: string; number: string; title: string | null; status: string; project_code: string; doc_date: string | null; valid_until: string | null; client_name: string | null; client_address: string | null; intro: string | null; closing: string | null; accepted_at: string | null; accepted_name: string | null; declined_at: string | null; lines: QLine[] | null; company: Company | null; btw6?: string | null; included?: string | null; excluded?: string | null; planning?: string | null; payment?: string | null; warranty?: string | null; show_groups?: boolean; project_title?: string | null; site?: string | null }

const T = {
  nl: { title: 'Offertes', open: 'Bekijk offerte', back: '← Terug', print: 'Afdrukken / PDF', status: { verstuurd: 'Wacht op je akkoord', aanvaard: 'Aanvaard', geweigerd: 'Niet aanvaard', vervallen: 'Vervallen' } as Record<string, string>,
    agreeTitle: 'Akkoord met deze offerte?', agreeText: (n: string, t: string) => `Door je naam te typen en op "Ik ga akkoord" te klikken, aanvaard je offerte ${n} voor een totaal van ${t} incl. btw. Daarna plannen we samen de volgende stappen.`,
    name: 'Je volledige naam', note: 'Opmerking (optioneel)', agree: 'Ik ga akkoord', decline: 'Liever niet / vraag eerst iets', declineAsk: 'Wat wil je aanpassen of vragen? (optioneel)', done: 'Bedankt! We hebben je akkoord goed ontvangen.', declined: 'Bedankt voor je antwoord. Olivier neemt contact met je op.', accepted: (n: string, d: string) => `Aanvaard door ${n} op ${d}.`, expired: 'Deze offerte is vervallen. Neem contact op voor een nieuwe versie.', valid: (d: string) => `Geldig tot ${d}` },
  en: { title: 'Quotations', open: 'View quotation', back: '← Back', print: 'Print / PDF', status: { verstuurd: 'Awaiting your approval', aanvaard: 'Accepted', geweigerd: 'Not accepted', vervallen: 'Expired' } as Record<string, string>,
    agreeTitle: 'Do you agree with this quotation?', agreeText: (n: string, t: string) => `By typing your name and clicking "I agree", you accept quotation ${n} for a total of ${t} incl. VAT. We will then plan the next steps together.`,
    name: 'Your full name', note: 'Remark (optional)', agree: 'I agree', decline: 'Not yet / I have a question', declineAsk: 'What would you like to change or ask? (optional)', done: 'Thank you! We have received your approval.', declined: 'Thank you for your answer. Olivier will contact you.', accepted: (n: string, d: string) => `Accepted by ${n} on ${d}.`, expired: 'This quotation has expired. Please contact us for a new version.', valid: (d: string) => `Valid until ${d}` },
  de: { title: 'Angebote', open: 'Angebot ansehen', back: '← Zurück', print: 'Drucken / PDF', status: { verstuurd: 'Wartet auf Ihre Zustimmung', aanvaard: 'Angenommen', geweigerd: 'Nicht angenommen', vervallen: 'Abgelaufen' } as Record<string, string>,
    agreeTitle: 'Sind Sie mit diesem Angebot einverstanden?', agreeText: (n: string, t: string) => `Indem Sie Ihren Namen eingeben und auf „Ich stimme zu“ klicken, nehmen Sie Angebot ${n} über insgesamt ${t} inkl. MwSt. an. Danach planen wir gemeinsam die nächsten Schritte.`,
    name: 'Ihr vollständiger Name', note: 'Bemerkung (optional)', agree: 'Ich stimme zu', decline: 'Noch nicht / ich habe eine Frage', declineAsk: 'Was möchten Sie ändern oder fragen? (optional)', done: 'Vielen Dank! Wir haben Ihre Zustimmung erhalten.', declined: 'Danke für Ihre Antwort. Olivier meldet sich bei Ihnen.', accepted: (n: string, d: string) => `Angenommen von ${n} am ${d}.`, expired: 'Dieses Angebot ist abgelaufen. Bitte kontaktieren Sie uns für eine neue Version.', valid: (d: string) => `Gültig bis ${d}` },
}
const loc = (l: Lang) => (l === 'de' ? 'de-DE' : l === 'en' ? 'en-GB' : 'nl-BE')
const eur = (v: number, l: Lang) => v.toLocaleString(loc(l), { style: 'currency', currency: 'EUR' })
const dd = (d: string | null, l: Lang) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString(loc(l), { day: 'numeric', month: 'long', year: 'numeric' }) : '')

export function Quotes({ lang, preview = false, initial }: { lang: Lang; preview?: boolean; initial?: string | null }) {
  const t = T[lang]
  const [rows, setRows] = useState<PQuote[] | null>(null)
  const [open, setOpen] = useState<string | null>(initial ?? null)
  const load = () => { if (preview) return setRows([]); supabase.rpc('portal_my_quotes').then(({ data }) => setRows((data as PQuote[]) ?? [])) }
  useEffect(load, [preview])
  if (!rows?.length) return null
  const q = rows.find((r) => r.id === open)
  if (q) return <QuoteView q={q} lang={lang} onBack={() => setOpen(null)} onDone={load} />
  return (
    <>
      <h2 className="portal-h">{t.title}</h2>
      <div className="pquotes">
        {rows.map((r) => {
          const tot = quoteTotals(r.lines ?? [])
          return (
            <button key={r.id} className={'pquote ' + r.status} onClick={() => setOpen(r.id)}>
              <span className="pquote-st">{t.status[r.status] ?? r.status}</span>
              <b>{r.number}</b><span>{r.title}</span>
              <span className="pquote-tot">{eur(tot.incl, lang)}</span>
              <span className="muted">{r.status === 'verstuurd' ? t.valid(dd(r.valid_until, lang)) : t.open} →</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function QuoteView({ q, lang, onBack, onDone }: { q: PQuote; lang: Lang; onBack: () => void; onDone: () => void }) {
  const t = T[lang]
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'agree' | 'decline'>('agree')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tot = quoteTotals(q.lines ?? [])
  const expired = q.status === 'verstuurd' && !!q.valid_until && q.valid_until < new Date().toLocaleDateString('sv-SE')
  const decide = async (accept: boolean) => {
    setBusy(true)
    const { data, error } = await supabase.rpc('portal_quote_decide', { p_id: q.id, p_accept: accept, p_name: name, p_note: note || null })
    setBusy(false)
    if (error) return setMsg(error.message)
    if ((data as { ok: boolean })?.ok) { setMsg(accept ? t.done : t.declined); onDone() }
  }
  return (
    <div className="pquote-view">
      <div className="pquote-bar"><button className="portal-link" onClick={onBack}>{t.back}</button><button onClick={printQuote}>{t.print}</button></div>
      <div className="qpreview"><QuoteDoc q={q} lines={q.lines ?? []} company={q.company ?? {}} lang={lang} btw6={q.btw6} /></div>
      {msg && <p className="pquote-msg">{msg}</p>}
      {!msg && q.status === 'aanvaard' && <p className="pquote-msg">{t.accepted(q.accepted_name ?? '', dd(q.accepted_at, lang))}</p>}
      {!msg && (q.status === 'vervallen' || expired) && <p className="pquote-msg">{t.expired}</p>}
      {!msg && q.status === 'verstuurd' && !expired && (
        <section className="pquote-sign">
          <h3>{t.agreeTitle}</h3>
          <div className="seg"><button className={mode === 'agree' ? 'on' : ''} onClick={() => setMode('agree')}>{t.agree}</button><button className={mode === 'decline' ? 'on' : ''} onClick={() => setMode('decline')}>{t.decline}</button></div>
          {mode === 'agree' ? <>
            <p>{t.agreeText(q.number, eur(tot.incl, lang))}</p>
            <input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <textarea placeholder={t.note} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="primary" disabled={busy || name.trim().length < 3} onClick={() => decide(true)}>{t.agree}</button>
          </> : <>
            <textarea placeholder={t.declineAsk} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            <button disabled={busy} onClick={() => decide(false)}>{t.decline}</button>
          </>}
        </section>
      )}
    </div>
  )
}
