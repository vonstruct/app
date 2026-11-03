import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'

/**
 * Betalingsschema en facturen (tabel `invoices`, view `app_invoices`). Na een ondertekende offerte maakt de database de schijven
 * (voorschot / levering / saldo, regel `betalingsschijven`); de fase zet ze op "te factureren". Hier: factuur gemaakt (nummer, datum)
 * en betaald aanduiden, meerwerk toevoegen. Later maakt de app de factuur in Yuki en leest ze de betalingen.
 * Met `project`: enkel dat project (tab Facturen), anders alle projecten.
 */
type Inv = {
  id: string; project_code: string; quote_id: string | null; seq: number; kind: string; label: string; pct: number | null
  amount_excl: number; amount_vat: number; amount_incl: number; vat_split: Record<string, { basis: number; btw: number }> | null
  status: string; state: string; ready_at: string | null; invoice_number: string | null; invoice_date: string | null; due_date: string | null
  paid_amount: number | null; paid_at: string | null; note: string | null; client_name: string | null; quote_number: string | null; days_overdue: number | null
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
      {(i.status === 'te factureren' || i.status === 'gepland') && (
        <div className="inv-make">
          <label>Factuurnummer (uit Yuki)<input value={nr} onChange={(e) => setNr(e.target.value)} placeholder="bv. VF2026-0123" /></label>
          <label>Factuurdatum<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" onClick={() => onSave({ status: 'gefactureerd', invoice_number: nr || null, invoice_date: date, due_date: null })}>Gefactureerd</button>
          {i.status === 'gepland' && <button onClick={() => onSave({ status: 'te factureren', ready_at: new Date().toISOString() })}>Nu al factureren</button>}
        </div>
      )}
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
