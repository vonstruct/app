import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { DateInput } from '../../core/DateInput'

/**
 * Betalingsschema en facturen (tabel `invoices`, view `app_invoices`). Na een ondertekende offerte maakt de database de schijven
 * (voorschot / levering / saldo, regel `betalingsschijven`); de fase zet ze op "te factureren". Hier: factuur gemaakt (nummer, datum)
 * en betaald aanduiden, meerwerk toevoegen. Yuki (Edge Function `yuki`): knop "Factuur maken in Yuki" (concept of meteen geboekt, regel `yuki`)
 * en elk uur de betalingen ophalen (pg_cron `yuki-sync`, ook met de knop "Betalingen ophalen").
 * Met `project`: enkel dat project (tab Facturen), anders alle projecten.
 */
type Inv = {
  id: string; project_code: string; quote_id: string | null; seq: number; kind: string; label: string; pct: number | null
  amount_excl: number; amount_vat: number; amount_incl: number; vat_split: Record<string, { basis: number; btw: number }> | null
  status: string; state: string; ready_at: string | null; invoice_number: string | null; invoice_date: string | null; due_date: string | null
  paid_amount: number | null; paid_at: string | null; note: string | null; client_name: string | null; quote_number: string | null; days_overdue: number | null
  reminders?: number; last_reminder_at?: string | null
  yuki_status?: 'concept' | 'geboekt' | 'fout' | null; yuki_sent_at?: string | null; yuki_message?: string | null; yuki_open_amount?: number | null; yuki_checked_at?: string | null
}
const STATE: Record<string, [string, string]> = {
  gepland: ['Gepland', 'muted'], 'te factureren': ['Te factureren', 'warn'], open: ['Gefactureerd', ''], vervallen: ['Vervallen', 'bad'], betaald: ['Betaald', 'ok'], geannuleerd: ['Geannuleerd', 'muted'],
}
const ORDER = ['vervallen', 'te factureren', 'open', 'gepland', 'betaald', 'geannuleerd']
const d = (v: string | null) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const today = () => new Date().toLocaleDateString('sv-SE')

export function Invoices({ project }: { project?: string }) {
  const [filter, setFilter] = useState<'open' | 'alles'>(project ? 'alles' : 'open')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const q = useQuery<Inv[]>(() => {
    let r = supabase.from('app_invoices').select('*')
    if (project) r = r.eq('project_code', project)
    return r.order('project_code').order('seq')
  }, [project])
  const rows = (q.data ?? []).filter((i) => filter === 'alles' || ['vervallen', 'te factureren', 'open'].includes(i.state))
  if (!project) rows.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state))
  const sum = (f: (i: Inv) => boolean) => (q.data ?? []).filter(f).reduce((a, i) => a + Number(i.amount_incl), 0)

  const save = async (id: string, patch: Partial<Inv>) => {
    const { error } = await supabase.from('invoices').update(patch).eq('id', id)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); q.reload() }
  }
  if (q.loading) return <Loading />
  return (
    <div className="orders">
      <div className="quote-intern">
        <span><small>Te factureren</small><b>{fmtEur(sum((i) => i.status === 'te factureren'))}</b></span>
        <span><small>Openstaand</small><b>{fmtEur(sum((i) => i.state === 'open' || i.state === 'vervallen'))}</b></span>
        <span><small>Waarvan vervallen</small><b className={sum((i) => i.state === 'vervallen') ? 'bad-txt' : ''}>{fmtEur(sum((i) => i.state === 'vervallen'))}</b></span>
        <span><small>Betaald</small><b>{fmtEur(sum((i) => i.status === 'betaald'))}</b></span>
      </div>
      <div className="orders-bar">
        <div className="seg">
          <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Te doen</button>
          <button className={filter === 'alles' ? 'on' : ''} onClick={() => setFilter('alles')}>Alles</button>
        </div>
        {project && <button onClick={() => setAdding((a) => !a)}>+ Meerwerk / andere factuur</button>}
        <SyncButton onDone={q.reload} />
      </div>
      <ErrorBox error={q.error} />
      {adding && project && <NewInvoice project={project} onDone={() => { setAdding(false); q.reload() }} />}
      {!rows.length && <p className="muted">{project ? 'Nog geen facturen. Na een ondertekende offerte verschijnt hier het betalingsschema.' : 'Niets te factureren of op te volgen.'}</p>}
      {rows.map((i) => {
        const [lbl, cls] = STATE[i.state] ?? [i.state, '']
        const isOpen = open === i.id
        return (
          <div key={i.id} className={'order-row' + (isOpen ? ' open' : '')}>
            <div className="order-head" onClick={() => setOpen(isOpen ? null : i.id)}>
              <span className={'jo-pill ' + cls}>{lbl}</span>
              <div className="order-main">
                <strong>{i.label}</strong>
                <div className="muted small">
                  {!project && <><Link to={`/projecten/${i.project_code}?tab=facturen`} onClick={(e) => e.stopPropagation()}>{i.project_code}</Link>{i.client_name ? ' · ' + i.client_name : ''} · </>}
                  {i.invoice_number ? 'factuur ' + i.invoice_number : i.status === 'gepland' ? planned(i.kind) : 'nog geen factuur'}
                  {i.yuki_status && <> · <span className={i.yuki_status === 'fout' ? 'bad-txt' : ''}>Yuki: {YUKI[i.yuki_status]}</span></>}
                </div>
              </div>
              <div className="order-dates small">
                {i.state === 'vervallen' ? <><strong>{i.days_overdue} dagen</strong> over de vervaldag</> : i.status === 'betaald' ? <>betaald {d(i.paid_at)}</> : i.due_date ? <>vervalt {d(i.due_date)}</> : null}
                {i.invoice_date && <div className="muted">gefactureerd {d(i.invoice_date)}</div>}
              </div>
              <div className="order-amt">{fmtEur(i.amount_incl)}</div>
            </div>
            {isOpen && <InvoiceDetail i={i} onSave={(p) => save(i.id, p)} />}
          </div>
        )
      })}
    </div>
  )
}

const YUKI: Record<string, string> = { concept: 'concept (nakijken in Yuki)', geboekt: 'geboekt', fout: 'fout' }

async function callYuki(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('yuki', { body })
  if (error) {
    let msg = error.message
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error } catch { /* */ }
    throw new Error(msg)
  }
  if (data?.ok === false) throw new Error(data.error ?? 'mislukt')
  return data
}

/** Betalingen ophalen uit Yuki (openstaande posten); gebeurt ook elk uur vanzelf. */
function SyncButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  return <button disabled={busy} onClick={async () => {
    setBusy(true)
    try { const r = await callYuki({ action: 'sync_payments', force: true }); toast(r.paid ? `${r.paid} betaling(en) verwerkt` : `Bijgewerkt · ${r.outstanding} openstaand in Yuki`); onDone() }
    catch (e) { toast(String((e as Error).message), 'err') } finally { setBusy(false) }
  }}>{busy ? 'Ophalen…' : 'Betalingen ophalen (Yuki)'}</button>
}

/** Factuur maken in Yuki: pas na jouw klik. Concept = je kijkt na en verstuurt vanuit Yuki; meteen boeken = Rekenregels → Facturen. */
function YukiBlock({ i, onDone }: { i: Inv; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const can = ['te factureren', 'gepland', 'gefactureerd'].includes(i.status) && i.yuki_status !== 'concept' && i.yuki_status !== 'geboekt' && !(i.status === 'gefactureerd' && i.invoice_number)
  const when = (v?: string | null) => (v ? new Date(v).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
  return (
    <div className="inv-yuki">
      {i.yuki_status === 'concept' && <p className="small">In Yuki als <b>concept</b> sinds {when(i.yuki_sent_at)}. Kijk het na en verstuur het vanuit Yuki; zodra het daar geboekt is, zet de app het op gefactureerd.</p>}
      {i.yuki_status === 'geboekt' && <p className="small">Geboekt in Yuki{i.yuki_open_amount != null ? <> · nog open: <b>{fmtEur(i.yuki_open_amount)}</b></> : null}{i.yuki_checked_at ? <span className="muted"> · nagekeken {when(i.yuki_checked_at)}</span> : null}</p>}
      {i.yuki_status === 'fout' && <p className="small bad-txt">Yuki weigerde de factuur: {i.yuki_message}</p>}
      {can && (
        <button className="primary" disabled={busy} onClick={async () => {
          if (!confirm(`Factuur "${i.label}" (${fmtEur(i.amount_incl)}) aanmaken in Yuki?`)) return
          setBusy(true)
          try { const r = await callYuki({ action: 'create_invoice', id: i.id }); toast(r.status === 'geboekt' ? 'Geboekt in Yuki' : 'Als concept in Yuki gezet'); onDone() }
          catch (e) { toast(String((e as Error).message), 'err'); onDone() } finally { setBusy(false) }
        }}>{busy ? 'Bezig…' : i.yuki_status === 'fout' ? 'Opnieuw naar Yuki' : 'Factuur maken in Yuki'}</button>
      )}
    </div>
  )
}

const planned = (k: string) => (k === 'levering' ? 'te factureren zodra het project in plaatsing gaat' : k === 'saldo' ? 'te factureren na oplevering' : 'gepland')

function InvoiceDetail({ i, onSave }: { i: Inv; onSave: (p: Partial<Inv>) => void }) {
  const [nr, setNr] = useState(i.invoice_number ?? '')
  const [date, setDate] = useState(i.invoice_date ?? today())
  const field = (label: string, key: keyof Inv, type = 'date') => (
    <label>{label}<input type={type} defaultValue={(i[key] as string | number | null) ?? ''} onBlur={(e) => {
      const v = e.target.value === '' ? null : type === 'number' ? Number(e.target.value.replace(',', '.')) : e.target.value
      if (v !== (i[key] ?? null)) onSave({ [key]: v } as Partial<Inv>)
    }} /></label>
  )
  return (
    <div className="order-detail">
      <div className="inv-split">
        <span>Excl. btw <b>{fmtEur(i.amount_excl)}</b></span>
        {Object.entries(i.vat_split ?? {}).map(([r, v]) => <span key={r}>{Number(r)} % btw op {fmtEur(v.basis)}: <b>{fmtEur(v.btw)}</b></span>)}
        <span>Incl. btw <b>{fmtEur(i.amount_incl)}</b></span>
      </div>
      <YukiBlock i={i} onDone={() => onSave({})} />
      {(i.status === 'te factureren' || i.status === 'gepland') && (
        <div className="inv-make">
          <label>Of met de hand: factuurnummer<input value={nr} onChange={(e) => setNr(e.target.value)} placeholder="bv. VF2026-0123" /></label>
          <label>Factuurdatum<DateInput value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" onClick={() => onSave({ status: 'gefactureerd', invoice_number: nr || null, invoice_date: date, due_date: null })}>Gefactureerd</button>
          {i.status === 'gepland' && <button onClick={() => onSave({ status: 'te factureren', ready_at: new Date().toISOString() })}>Nu al factureren</button>}
        </div>
      )}
      {i.status === 'gefactureerd' && <Reminder i={i} onDone={() => onSave({})} />}
      {i.status === 'gefactureerd' && (
        <div className="inv-make">
          <button className="primary" onClick={() => onSave({ status: 'betaald', paid_at: today(), paid_amount: i.amount_incl })}>Betaald (volledig)</button>
          <button onClick={() => { const a = prompt('Betaald bedrag (€):', String(i.amount_incl)); if (a) onSave({ paid_amount: Number(a.replace(',', '.')), ...(Number(a.replace(',', '.')) >= Number(i.amount_incl) ? { status: 'betaald' } : {}) }) }}>Deels betaald</button>
        </div>
      )}
      <div className="order-fields">
        {field('Factuurnummer', 'invoice_number', 'text')}
        {field('Factuurdatum', 'invoice_date')}
        {field('Vervaldag', 'due_date')}
        {field('Betaald bedrag', 'paid_amount', 'number')}
        {field('Betaald op', 'paid_at')}
        {field('Notitie', 'note', 'text')}
      </div>
      <div className="seg">
        {['gepland', 'te factureren', 'gefactureerd', 'betaald', 'geannuleerd'].map((s) => <button key={s} className={i.status === s ? 'on' : ''} onClick={() => onSave({ status: s })}>{s}</button>)}
      </div>
    </div>
  )
}

/** Herinnering voor een onbetaalde factuur: vaste tekst (Rekenregels → Berichten, betaling_herinnering), aanpasbaar, verstuurd vanuit info@ na jouw klik. */
function Reminder({ i, onDone }: { i: Inv; onDone: () => void }) {
  const [d, setD] = useState<{ to: string | null; to_name: string | null; subject: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const open = async () => {
    const { data, error } = await supabase.rpc('invoice_reminder_draft', { p_id: i.id })
    if (error) return toast(error.message, 'err')
    setD(data as never)
  }
  const send = async () => {
    if (!d?.to) return toast('De klant heeft geen e-mailadres', 'err')
    setBusy(true)
    const { data: p, error } = await supabase.from('von_proposals').insert({ kind: 'mail', project_code: i.project_code, title: `Betalingsherinnering ${i.invoice_number ?? i.label}`, summary: `aan ${d.to}`, payload: { to: d.to, to_name: d.to_name, subject: d.subject, body: d.body }, source: 'app', agent: 'app' }).select('id').single()
    if (error || !p) { setBusy(false); return toast(error?.message ?? 'mislukt', 'err') }
    const { data: r, error: e2 } = await supabase.functions.invoke('von-action', { body: { action: 'approve', id: p.id, mode: 'send' } })
    setBusy(false)
    const res = r as { ok?: boolean; result?: string; error?: string } | null
    if (e2 || res?.ok === false || res?.error) return toast(res?.error ?? res?.result ?? 'Versturen mislukt', 'err')
    await supabase.from('invoices').update({ reminders: (i.reminders ?? 0) + 1, last_reminder_at: new Date().toISOString() }).eq('id', i.id)
    toast('Herinnering verstuurd naar ' + d.to); setD(null); onDone()
  }
  return (
    <div className="inv-rem">
      {!d ? (
        <div className="inv-make">
          <button className={i.state === 'vervallen' ? 'primary' : ''} onClick={open}>Herinnering sturen</button>
          {(i.reminders ?? 0) > 0 && <span className="muted small">{i.reminders}× herinnerd, laatst {new Date(i.last_reminder_at!).toLocaleDateString('nl-BE')}</span>}
        </div>
      ) : (
        <div className="qedit-head inv-rem-box">
          <label>Aan<input value={d.to ?? ''} onChange={(e) => setD({ ...d, to: e.target.value })} /></label>
          <label>Onderwerp<input value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} /></label>
          <label className="inv-rem-body">Tekst<textarea rows={9} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></label>
          <div className="order-actions"><button className="primary" disabled={busy} onClick={send}>{busy ? 'Versturen…' : 'Versturen'}</button><button onClick={() => setD(null)}>Annuleren</button>
            <span className="muted small">Standaardtekst aanpassen: Rekenregels → Berichten (betaling_herinnering).</span></div>
        </div>
      )}
    </div>
  )
}

function NewInvoice({ project, onDone }: { project: string; onDone: () => void }) {
  const [f, setF] = useState({ label: 'Meerwerk', excl: '', vat: '6' })
  const save = async () => {
    const excl = Number(f.excl.replace(',', '.'))
    if (!excl) return toast('Bedrag ontbreekt', 'err')
    const vat = Math.round(excl * Number(f.vat)) / 100
    const { error } = await supabase.from('invoices').insert({ project_code: project, seq: 50, kind: f.label.toLowerCase().startsWith('meerwerk') ? 'meerwerk' : 'vrij', label: f.label, amount_excl: excl, amount_vat: vat, amount_incl: excl + vat, vat_split: { [f.vat]: { basis: excl, btw: vat } }, status: 'te factureren', ready_at: new Date().toISOString() })
    if (error) toast(error.message, 'err'); else { toast('Toegevoegd'); onDone() }
  }
  return (
    <div className="order-row open"><div className="order-detail">
      <div className="order-fields">
        <label>Omschrijving<input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
        <label>Bedrag excl. btw (€)<input value={f.excl} inputMode="decimal" onChange={(e) => setF({ ...f, excl: e.target.value })} /></label>
        <label>Btw %<select value={f.vat} onChange={(e) => setF({ ...f, vat: e.target.value })}>{['0', '6', '21'].map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      <button className="primary" onClick={save}>Toevoegen</button>
    </div></div>
  )
}
