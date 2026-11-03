import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { QuoteDoc, printQuote, quoteTotals, initialChoice, lineOn, type Company, type QLine, type QSignature } from '../core/QuoteDoc'
import { SignaturePad } from '../core/SignaturePad'
import type { Lang } from './i18n'

/** Offertes in het klantenportaal: bekijken, afdrukken, online akkoord geven (naam typen) of weigeren. Via portal_my_quotes / portal_quote_decide. */
type PQuote = { id: string; number: string; title: string | null; status: string; project_code: string; doc_date: string | null; valid_until: string | null; client_name: string | null; client_address: string | null; intro: string | null; closing: string | null; accepted_at: string | null; accepted_name: string | null; declined_at: string | null; lines: QLine[] | null; company: Company | null; btw6?: string | null; signature?: QSignature | null; included?: string | null; excluded?: string | null; planning?: string | null; payment?: string | null; warranty?: string | null; show_groups?: boolean; project_title?: string | null; site?: string | null }

const T = {
  nl: { title: 'Offertes', open: 'Bekijk offerte', back: '← Terug', print: 'Afdrukken / PDF', status: { verstuurd: 'Wacht op je akkoord', aanvaard: 'Aanvaard', geweigerd: 'Niet aanvaard', vervallen: 'Vervallen' } as Record<string, string>,
    agreeTitle: 'Akkoord met deze offerte?', agreeText: (n: string, t: string) => `Door je naam te typen en op "Ik ga akkoord" te klikken, aanvaard je offerte ${n} voor een totaal van ${t} incl. btw. Daarna plannen we samen de volgende stappen.`,
    name: 'Je volledige naam', note: 'Opmerking (optioneel)', agree: 'Ik ga akkoord', decline: 'Liever niet / vraag eerst iets', declineAsk: 'Wat wil je aanpassen of vragen? (optioneel)', done: 'Bedankt! We hebben je akkoord goed ontvangen.', declined: 'Bedankt voor je antwoord. Olivier neemt contact met je op.', accepted: (n: string, d: string) => `Aanvaard door ${n} op ${d}.`, expired: 'Deze offerte is vervallen. Neem contact op voor een nieuwe versie.', valid: (d: string) => `Geldig tot ${d}` , sign: 'Onderteken', signHere: 'Teken hier je handtekening', clear: 'Wissen', read: (n: string) => `Ik heb offerte ${n} en de voorwaarden gelezen, ga akkoord met de inhoud en de gekozen opties, en onderteken ze elektronisch.`, vat6ok: 'Ik bevestig dat de woning ouder is dan 10 jaar en als privéwoning gebruikt wordt (6 % btw).', legal: 'Je elektronische handtekening is rechtsgeldig (Europese eIDAS-verordening). We bewaren je naam, handtekening, e-mailadres, tijdstip, IP-adres en een vingerafdruk van deze versie als bewijs; je krijgt een bevestiging per mail.', yourTotal: 'Jouw totaal incl. btw', pickAll: 'Maak eerst je keuze bij elke keuzegroep.' },
  en: { title: 'Quotations', open: 'View quotation', back: '← Back', print: 'Print / PDF', status: { verstuurd: 'Awaiting your approval', aanvaard: 'Accepted', geweigerd: 'Not accepted', vervallen: 'Expired' } as Record<string, string>,
    agreeTitle: 'Do you agree with this quotation?', agreeText: (n: string, t: string) => `By typing your name and clicking "I agree", you accept quotation ${n} for a total of ${t} incl. VAT. We will then plan the next steps together.`,
    name: 'Your full name', note: 'Remark (optional)', agree: 'I agree', decline: 'Not yet / I have a question', declineAsk: 'What would you like to change or ask? (optional)', done: 'Thank you! We have received your approval.', declined: 'Thank you for your answer. Olivier will contact you.', accepted: (n: string, d: string) => `Accepted by ${n} on ${d}.`, expired: 'This quotation has expired. Please contact us for a new version.', valid: (d: string) => `Valid until ${d}` , sign: 'Sign', signHere: 'Draw your signature here', clear: 'Clear', read: (n: string) => `I have read quotation ${n} and the terms, agree with the content and the chosen options, and sign it electronically.`, vat6ok: 'I confirm the home is older than 10 years and used as a private residence (6 % VAT).', legal: 'Your electronic signature is legally valid (EU eIDAS regulation). As proof we store your name, signature, email address, time, IP address and a fingerprint of this version; you will receive a confirmation by email.', yourTotal: 'Your total incl. VAT', pickAll: 'Please make a choice in every choice group first.' },
  de: { title: 'Angebote', open: 'Angebot ansehen', back: '← Zurück', print: 'Drucken / PDF', status: { verstuurd: 'Wartet auf Ihre Zustimmung', aanvaard: 'Angenommen', geweigerd: 'Nicht angenommen', vervallen: 'Abgelaufen' } as Record<string, string>,
    agreeTitle: 'Sind Sie mit diesem Angebot einverstanden?', agreeText: (n: string, t: string) => `Indem Sie Ihren Namen eingeben und auf „Ich stimme zu“ klicken, nehmen Sie Angebot ${n} über insgesamt ${t} inkl. MwSt. an. Danach planen wir gemeinsam die nächsten Schritte.`,
    name: 'Ihr vollständiger Name', note: 'Bemerkung (optional)', agree: 'Ich stimme zu', decline: 'Noch nicht / ich habe eine Frage', declineAsk: 'Was möchten Sie ändern oder fragen? (optional)', done: 'Vielen Dank! Wir haben Ihre Zustimmung erhalten.', declined: 'Danke für Ihre Antwort. Olivier meldet sich bei Ihnen.', accepted: (n: string, d: string) => `Angenommen von ${n} am ${d}.`, expired: 'Dieses Angebot ist abgelaufen. Bitte kontaktieren Sie uns für eine neue Version.', valid: (d: string) => `Gültig bis ${d}` , sign: 'Unterschreiben', signHere: 'Unterschreiben Sie hier', clear: 'Löschen', read: (n: string) => `Ich habe das Angebot ${n} und die Bedingungen gelesen, bin mit dem Inhalt und den gewählten Optionen einverstanden und unterschreibe es elektronisch.`, vat6ok: 'Ich bestätige, dass die Wohnung älter als 10 Jahre ist und privat genutzt wird (6 % MwSt.).', legal: 'Ihre elektronische Unterschrift ist rechtsgültig (EU-eIDAS-Verordnung). Als Nachweis speichern wir Name, Unterschrift, E-Mail-Adresse, Zeitpunkt, IP-Adresse und einen Fingerabdruck dieser Version; Sie erhalten eine Bestätigung per E-Mail.', yourTotal: 'Ihr Gesamtbetrag inkl. MwSt.', pickAll: 'Bitte treffen Sie zuerst in jeder Auswahlgruppe eine Wahl.' },
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
          const tot = quoteTotals(r.lines ?? [], initialChoice(r.lines ?? []))
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
  const lines = q.lines ?? []
  const open = q.status === 'verstuurd'
  const [choice, setChoice] = useState<Set<string>>(() => initialChoice(lines))
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [png, setPng] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const [vat6, setVat6] = useState(false)
  const [mode, setMode] = useState<'agree' | 'decline'>('agree')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tot = quoteTotals(lines, choice)
  const expired = open && !!q.valid_until && q.valid_until < new Date().toLocaleDateString('sv-SE')
  const needs6 = lines.some((l) => lineOn(l, choice) && Number(l.vat_rate) === 6)
  const toggle = (l: QLine) => {
    if (!open || expired || !l.id) return
    const c = new Set(choice)
    if (l.opt_kind === 'keuze') { for (const x of lines) if (x.opt_kind === 'keuze' && x.opt_group === l.opt_group && x.id) c.delete(x.id); c.add(l.id) }
    else if (c.has(l.id)) c.delete(l.id); else c.add(l.id)
    setChoice(c)
  }
  const ready = name.trim().length >= 3 && !!png && agree && (!needs6 || vat6)
  const sign = async () => {
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('portal_quote_sign', { p_id: q.id, p_name: name.trim(), p_signature: png, p_selected: [...choice], p_vat6: needs6 ? vat6 : null, p_consent: t.read(q.number), p_note: note || null })
    setBusy(false)
    if (error) return setErr(error.message)
    const r = data as { ok: boolean; status?: string }
    if (r?.ok) { setMsg(t.done); onDone() } else setErr(r?.status === 'vervallen' ? t.expired : String(r?.status ?? 'fout'))
  }
  const decline = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('portal_quote_decide', { p_id: q.id, p_accept: false, p_name: name, p_note: note || null })
    setBusy(false)
    if (error) return setErr(error.message)
    if ((data as { ok: boolean })?.ok) { setMsg(t.declined); onDone() }
  }
  return (
    <div className="pquote-view">
      <div className="pquote-bar"><button className="portal-link" onClick={onBack}>{t.back}</button><button onClick={printQuote}>{t.print}</button></div>
      <div className="qpreview"><QuoteDoc q={q} lines={lines} company={q.company ?? {}} lang={lang} btw6={q.btw6} choice={open ? choice : null} onToggle={open && !expired && !msg ? toggle : undefined} signature={q.signature} /></div>
      {msg && <p className="pquote-msg">{msg}</p>}
      {!msg && q.status === 'aanvaard' && <p className="pquote-msg">{t.accepted(q.accepted_name ?? '', dd(q.accepted_at, lang))}</p>}
      {!msg && (q.status === 'vervallen' || expired) && <p className="pquote-msg">{t.expired}</p>}
      {!msg && open && !expired && (
        <section className="pquote-sign">
          <h3>{t.agreeTitle}</h3>
          <div className="pquote-live"><span>{t.yourTotal}</span><b>{eur(tot.incl, lang)}</b></div>
          <div className="seg"><button className={mode === 'agree' ? 'on' : ''} onClick={() => setMode('agree')}>{t.sign}</button><button className={mode === 'decline' ? 'on' : ''} onClick={() => setMode('decline')}>{t.decline}</button></div>
          {mode === 'agree' ? <>
            <input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <SignaturePad onChange={setPng} hint={t.signHere} clearLabel={t.clear} />
            <label className="pquote-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{t.read(q.number)}</label>
            {needs6 && <label className="pquote-check"><input type="checkbox" checked={vat6} onChange={(e) => setVat6(e.target.checked)} />{t.vat6ok}</label>}
            <textarea placeholder={t.note} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="pquote-legal">{t.legal}</p>
            {err && <p className="error">{err}</p>}
            <button className="primary" disabled={busy || !ready} onClick={sign}>{t.sign} · {eur(tot.incl, lang)}</button>
          </> : <>
            <textarea placeholder={t.declineAsk} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            {err && <p className="error">{err}</p>}
            <button disabled={busy} onClick={decline}>{t.decline}</button>
          </>}
        </section>
      )}
    </div>
  )
}
