import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { DateInput } from '../../core/DateInput'

/**
 * Bestellingen per leverancier (tabel `orders`, view `app_orders` berekent "bestellen vóór" uit
 * nodig-op − levertermijn − buffer). Lijst aanmaken/bijwerken uit de kosten = RPC `orders_generate`.
 * Met `project`: enkel dat project (tab Bestellingen op de projectpagina), anders alle projecten (Planning).
 */
type Order = {
  id: string; project_code: string; supplier: string; ordered_by: string | null; categories: string[] | null
  status: string; needed_by: string | null; needed_by_manual: boolean; lead_days: number | null; lead_days_eff: number
  order_by: string | null; ordered_at: string | null; expected_at: string | null; delivered_at: string | null
  reference: string | null; amount: number | null; n_lines: number; note: string | null; urgency: string; manual?: boolean
  client_name: string | null; project_title: string | null
  shipped_at?: string | null; actual_amount?: number | null; n_docs?: number
  needed_src?: string | null; expected_src?: string | null; lead_src?: string | null
  delivery?: Delivery | null; pickup_by?: string | null; items_text?: string | null
}
/** Hoe een bestelling binnenkomt (7 nov 2026): de leverancier levert, ik haal op, de klant of een onderaannemer haalt op. */
type Delivery = 'levering' | 'ophalen' | 'klant' | 'onderaannemer'
const DELIVERY: [Delivery, string][] = [['levering', 'Levering'], ['ophalen', 'Ik haal op'], ['klant', 'Klant haalt op'], ['onderaannemer', 'Onderaannemer haalt op']]
const how = (o: Order): Delivery => o.delivery ?? 'levering'
const picker = (o: Order) => (how(o) === 'klant' ? 'Klant' : how(o) === 'onderaannemer' ? (o.pickup_by || 'Onderaannemer') : '')
type Line = { id: string; category: string | null; description: string | null; article_no: string | null; qty: number | null; unit: string | null; total: number | null }

const STATUSES = ['te bestellen', 'besteld', 'bevestigd', 'geleverd', 'geannuleerd']
const d = (v: string | null) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '—')
const today = () => new Date().toLocaleDateString('sv-SE')
/** Inkoop in rubrieken (7 nov 2026): te bestellen · op te halen · besteld · binnen; geannuleerd en vervallen enkel bij "Alles". */
type Rub = { key: string; label: string; dateLabel: string; sort: (a: Order, b: Order) => number }
const URANK = ['te laat', 'nu bestellen', 'levertijd onbekend', 'geen deadline', 'later']
const RUBRIEKEN: Rub[] = [
  { key: 'bestellen', label: 'Te bestellen', dateLabel: 'Bestellen vóór', sort: (a, b) => (URANK.indexOf(a.urgency) - URANK.indexOf(b.urgency)) || (a.needed_by ?? '9').localeCompare(b.needed_by ?? '9') },
  { key: 'ophalen', label: 'Op te halen', dateLabel: 'Klaar op', sort: (a, b) => (a.expected_at ?? a.needed_by ?? '9').localeCompare(b.expected_at ?? b.needed_by ?? '9') },
  { key: 'onderweg', label: 'Besteld', dateLabel: 'Verwacht', sort: (a, b) => (a.expected_at ?? '9').localeCompare(b.expected_at ?? '9') },
  { key: 'binnen', label: 'Binnen', dateLabel: 'Binnen op', sort: (a, b) => (b.delivered_at ?? '').localeCompare(a.delivered_at ?? '') },
  { key: 'af', label: 'Geannuleerd of vervallen', dateLabel: '', sort: (a, b) => a.supplier.localeCompare(b.supplier) },
]
const rubriekOf = (o: Order) => (o.status === 'geannuleerd' || o.urgency === 'vervallen' ? 'af' : o.status === 'te bestellen' ? 'bestellen' : o.status === 'geleverd' ? 'binnen' : how(o) === 'ophalen' ? 'ophalen' : 'onderweg')
const statusOf = (o: Order): [string, string] => {
  if (o.status === 'geannuleerd') return ['Geannuleerd', 'muted']
  if (o.urgency === 'vervallen') return ['Niet meer nodig', 'muted']
  if (o.status === 'te bestellen') return ({ 'te laat': ['Te laat', 'bad'], 'nu bestellen': ['Nu bestellen', 'warn'], 'levertijd onbekend': ['Levertijd onbekend', 'warn'] } as Record<string, [string, string]>)[o.urgency] ?? ['Te bestellen', '']
  if (o.status === 'geleverd') return [how(o) === 'levering' ? 'Binnen' : how(o) === 'ophalen' ? 'Opgehaald' : `${picker(o)} heeft opgehaald`, 'ok']
  if (o.urgency === 'komt te laat') return ['Komt te laat', 'bad']
  if (how(o) === 'ophalen') return o.urgency === 'op te halen' ? [o.expected_at && o.expected_at <= today() ? 'Ligt klaar' : 'Nu ophalen', 'warn'] : ['Later ophalen', '']
  if (how(o) !== 'levering') return [`${picker(o)} haalt op`, '']
  if (o.urgency === 'levering te laat') return ['Geleverd?', 'warn']
  if (o.shipped_at) return ['Verzonden', '']
  return [o.status === 'besteld' ? 'Besteld' : 'Bevestigd', '']
}
/**
 * Wat er besteld is (7 nov 2026: meteen de artikels zelf). main = "2 × naam · 178 m naam" (app_orders.items_text, duurste eerst),
 * sub = rubrieken · aantal artikels · aanvulling. Bestelling uit een mail zonder artikellijnen: de artikels uit de mail (niet het onderwerp).
 */
const whatOf = (o: Order): { main: string; sub: string } => {
  const cats = (o.categories ?? []).join(', ')
  const extra = o.note?.startsWith('Aanvulling') ? 'aanvulling (kwam er later bij)' : ''
  if (o.n_lines > 0) return { main: o.items_text || cats || 'artikels', sub: [cats, `${o.n_lines} ${o.n_lines === 1 ? 'artikel' : 'artikels'}`, extra].filter(Boolean).join(' · ') }
  const parts = (o.note ?? '').replace(/^Uit mail:\s*/, '').split(' · ').map((x) => x.trim()).filter(Boolean)
  const main = (parts.length > 1 ? parts.slice(1).join(' · ') : cats || parts[0]) || 'eigen bestelling'
  return { main, sub: main !== cats ? cats : '' }
}
const dd = (v: string | null | undefined) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

/** Waar een datum vandaan komt: feit (uit mail, ingevuld, planning) of aanname (regel). */
export function Src({ s }: { s?: string | null }) {
  if (!s) return null
  const assumed = s.startsWith('aanname')
  return <span className={'src-tag' + (assumed ? ' assumed' : '')} title={assumed ? 'Berekend uit een regel (aanname), geen feit' : 'Feit'}>{s}</span>
}

export function Orders({ project }: { project?: string }) {
  const [filter, setFilter] = useState<'open' | 'alles'>('open')
  const [open, setOpen] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const q = useQuery<Order[]>(() => {
    let r = supabase.from('app_orders').select('*')
    if (project) r = r.eq('project_code', project)
    return r.order('order_by', { ascending: true, nullsFirst: false })
  }, [project])

  // Open = te bestellen + onderweg + binnen in de laatste 14 dagen; Alles = ook oudere, geannuleerde en vervallen
  const rows = useMemo(() => {
    const since = new Date(Date.now() - 14 * 864e5).toLocaleDateString('sv-SE')
    return (q.data ?? []).filter((o) => filter === 'alles'
      || (o.urgency !== 'vervallen' && o.status !== 'geannuleerd' && (o.status !== 'geleverd' || (o.delivered_at ?? '') >= since)))
  }, [q.data, filter])

  const save = async (id: string, patch: Partial<Order>) => {
    const { error } = await supabase.from('orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); q.reload() }
  }
  const setStatus = (o: Order, status: string) => {
    const p: Partial<Order> = { status }
    if (status === 'besteld' && !o.ordered_at) p.ordered_at = today()
    if (status === 'geleverd' && !o.delivered_at) p.delivered_at = today()
    save(o.id, p)
  }
  const generate = async () => {
    if (!project) return
    setBusy(true)
    const { data, error } = await supabase.rpc('orders_generate', { p_code: project })
    setBusy(false)
    if (error) toast(error.message, 'err'); else { toast(`${data} bestellingen bijgewerkt uit de kosten`); q.reload() }
  }

  if (q.loading) return <Loading />
  const total = rows.filter((o) => o.status !== 'geannuleerd').reduce((sum, o) => sum + Number(o.amount ?? 0), 0)
  const groups = RUBRIEKEN.map((r) => ({ ...r, list: rows.filter((o) => rubriekOf(o) === r.key).sort(r.sort) })).filter((g) => g.list.length)

  /** Eén bestelling: vaste kolommen, één knop (Besteld / Geleverd), pijltje = details. */
  const Line = ({ o, showSupplier }: { o: Order; showSupplier: boolean }) => {
    const [lbl, cls] = statusOf(o)
    const rub = rubriekOf(o)
    const isOpen = open === o.id
    const dateCell = rub === 'bestellen' ? o.order_by : rub === 'binnen' ? o.delivered_at : o.expected_at
    const what = whatOf(o)
    return (
      <div className={'inko-item' + (isOpen ? ' open' : '')}>
        <div className="inko-row" onClick={() => setOpen(isOpen ? null : o.id)}>
          <span className={'inko-dot ' + cls} aria-hidden="true" />
          {showSupplier
            ? <span className="inko-first"><b>{o.supplier}</b>{o.ordered_by && !['Zelf', 'Vonstruct'].includes(o.ordered_by) && <small>via {o.ordered_by}</small>}</span>
            : <span className="inko-first"><Link to={`/projecten/${o.project_code}?tab=bestellingen`} onClick={(e) => e.stopPropagation()}>{o.client_name ?? o.project_code}</Link><small>{o.project_code}{o.ordered_by && !['Zelf', 'Vonstruct'].includes(o.ordered_by) ? ` · via ${o.ordered_by}` : ''}</small></span>}
          <span className="inko-what" title={what.main}><span className="inko-items">{what.main}</span>{(what.sub || o.n_docs) ? <small>{what.sub}{o.n_docs ? <span title="mails en bijlagen uit de mailbox">{what.sub ? ' · ' : ''}✉ {o.n_docs}</span> : null}</small> : null}</span>
          <span className="inko-date"><em>nodig op </em>{dd(o.needed_by)}{o.needed_by && o.needed_src && <small>{o.needed_src}</small>}</span>
          <span className="inko-date"><em>{rub === 'bestellen' ? 'bestellen vóór ' : rub === 'binnen' ? 'binnen op ' : rub === 'ophalen' ? 'klaar op ' : 'verwacht '}</em>{dd(dateCell)}{(rub === 'onderweg' || rub === 'ophalen') && o.expected_at && o.expected_src && <small>{o.expected_src}</small>}</span>
          <span className="inko-amt">{o.amount != null ? fmtEur(o.amount) : '—'}</span>
          <span className={'inko-status ' + cls}>{lbl}</span>
          <span className="inko-acts" onClick={(e) => e.stopPropagation()}>
            {rub === 'bestellen' ? <button className="inko-btn" aria-expanded={ordering === o.id} onClick={() => { setOrdering(ordering === o.id ? null : o.id); setOpen(null) }}>Besteld</button>
              : rub === 'ophalen' || rub === 'onderweg' ? <button className="inko-btn" onClick={() => setStatus(o, 'geleverd')}>{how(o) === 'levering' ? 'Geleverd' : 'Opgehaald'}</button>
              : <span className="inko-btn-slot" />}
            <button className="inko-chev" aria-expanded={isOpen} aria-label={isOpen ? 'Details sluiten' : 'Details tonen'} onClick={() => setOpen(isOpen ? null : o.id)}>{isOpen ? '▴' : '▾'}</button>
          </span>
        </div>
        {ordering === o.id && <OrderedForm o={o} onCancel={() => setOrdering(null)} onSave={(pt) => { setOrdering(null); save(o.id, { status: 'besteld', ordered_at: o.ordered_at ?? today(), ...pt }) }} />}
        {isOpen && <OrderDetail o={o} onSave={(pt) => save(o.id, pt)} onStatus={(st) => setStatus(o, st)} />}
      </div>
    )
  }

  return (
    <div className="orders inko">
      <div className="orders-bar">
        <div className="seg">
          <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Open</button>
          <button className={filter === 'alles' ? 'on' : ''} onClick={() => setFilter('alles')}>Alles</button>
        </div>
        <span className="muted">{rows.length} bestellingen · {fmtEur(total)}</span>
        {project && <button onClick={() => setAdding((a) => !a)}>+ Eigen bestelling</button>}
        {project && <button className="primary" disabled={busy} onClick={generate}>{busy ? 'Bezig…' : q.data?.length ? 'Bijwerken uit de kosten' : 'Bestellijst maken uit de kosten'}</button>}
      </div>
      <ErrorBox error={q.error} />
      {adding && project && <NewOrder project={project} onDone={() => { setAdding(false); q.reload() }} />}
      {!rows.length && <p className="muted">{project ? 'Nog geen bestellingen. Maak de lijst uit de kosten van de laatste ontwerpversie.' : 'Niets te bestellen, op te halen of onderweg.'}</p>}
      {groups.map((g) => {
        // Inkoop (alle projecten): per leverancier gegroepeerd; projectpagina: leverancier als eerste kolom
        const bySupplier = project ? [['', g.list] as [string, Order[]]] : [...g.list.reduce((m, o) => m.set(o.supplier, [...(m.get(o.supplier) ?? []), o]), new Map<string, Order[]>())]
        return (
          <section key={g.key} className="inko-rub">
            <h3>{g.label} <span>{g.list.length}</span></h3>
            <div className="inko-cols" aria-hidden="true"><span /><span>{project ? 'Leverancier' : 'Project'}</span><span>Wat</span><span>Nodig op</span><span>{g.dateLabel}</span><span className="r">Bedrag</span><span>Status</span><span /></div>
            {bySupplier.map(([sup, list]) => (
              <div key={sup || 'x'} className="inko-group">
                {!project && <div className="inko-sup"><b>{sup}</b><span>{list.length} {list.length === 1 ? 'bestelling' : 'bestellingen'}{list.some((o) => o.amount != null) ? ' · ' + fmtEur(list.reduce((t, o) => t + Number(o.amount ?? 0), 0)) : ''}</span></div>}
                {list.map((o) => <Line key={o.id} o={o} showSupplier={!!project} />)}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

/** Bestelling die niet uit de kosten komt (toestellen, sanitair, elektro …): `orders.manual = true`. */
function NewOrder({ project, onDone }: { project: string; onDone: () => void }) {
  const [f, setF] = useState({ supplier: '', reference: '', status: 'besteld', ordered_at: today(), expected_at: '', amount: '', note: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.supplier.trim()) return toast('Leverancier ontbreekt', 'err')
    const { data: need } = await supabase.rpc('project_needed_by', { p_code: project })
    const { error } = await supabase.from('orders').insert({
      project_code: project, supplier: f.supplier.trim(), ordered_by: 'Vonstruct', manual: true, status: f.status,
      reference: f.reference || null, ordered_at: f.status === 'te bestellen' ? null : f.ordered_at || null, expected_at: f.expected_at || null,
      amount: f.amount ? Number(f.amount.replace(',', '.')) : null, note: f.note || null, needed_by: need ?? null, n_lines: 0,
    })
    if (error) toast(error.message.includes('duplicate') ? 'Er bestaat al een bestelling bij deze leverancier voor dit project' : error.message, 'err')
    else { toast('Bestelling toegevoegd'); onDone() }
  }
  return (
    <div className="order-row open"><div className="order-detail">
      <p className="muted small">Een bestelling die niet uit de kosten komt, bv. toestellen of sanitair.</p>
      <div className="order-fields">
        <label>Leverancier<input value={f.supplier} onChange={set('supplier')} list="order-suppliers" /></label>
        <label>Status<select value={f.status} onChange={set('status')}>{STATUSES.slice(0, 4).map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Bestelnummer<input value={f.reference} onChange={set('reference')} /></label>
        <label>Besteld op<DateInput value={f.ordered_at} onChange={set('ordered_at')} /></label>
        <label>Verwacht op<DateInput value={f.expected_at} onChange={set('expected_at')} /></label>
        <label>Bedrag (€)<input value={f.amount} onChange={set('amount')} inputMode="decimal" /></label>
        <label>Wat<input value={f.note} onChange={set('note')} placeholder="bv. oven en kookplaat" /></label>
      </div>
      <SupplierList />
      <button className="primary" onClick={save}>Toevoegen</button>
    </div></div>
  )
}
function SupplierList() {
  const q = useQuery<{ name: string }[]>(() => supabase.from('suppliers').select('name').order('name'), [])
  return <datalist id="order-suppliers">{(q.data ?? []).map((s) => <option key={s.name} value={s.name} />)}</datalist>
}

const qtyTxt = (l: Line) => (l.qty != null ? Number(l.qty).toLocaleString('nl-BE', { maximumFractionDigits: 2 }) : '') + (l.unit ? ' ' + l.unit : '')
function copyList(o: Order, lines: Line[]) {
  const txt = [`Bestelling ${o.supplier} – project ${o.project_code}${o.reference ? ' – ' + o.reference : ''}`, '',
    ...lines.map((l) => [qtyTxt(l), l.article_no ?? '', l.description ?? ''].join('\t'))].join('\n')
  navigator.clipboard.writeText(txt).then(() => toast('Lijst gekopieerd'), () => toast('Kopiëren lukt niet', 'err'))
}
function printList(o: Order, lines: Line[]) {
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  const w = window.open('', '_blank')
  if (!w) return toast('Pop-up geblokkeerd', 'err')
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Bestelling ${esc(o.supplier)} ${esc(o.project_code)}</title>
<style>body{font:13px Arial,sans-serif;margin:28px;color:#1d1d1b}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border-bottom:1px solid #ccc;padding:5px 6px;text-align:left}.n{text-align:right;white-space:nowrap}.m{color:#666}</style>
<h1>Bestelling ${esc(o.supplier)}</h1><div class="m">Vonstruct · project ${esc(o.project_code)}${o.client_name ? ' · ' + esc(o.client_name) : ''}${o.reference ? ' · bestelnr ' + esc(o.reference) : ''} · nodig op ${esc(o.needed_by ?? '—')}</div>
<table><tr><th class="n">Aantal</th><th>Art.nr</th><th>Omschrijving</th><th>Rubriek</th></tr>
${lines.map((l) => `<tr><td class="n">${esc(qtyTxt(l))}</td><td>${esc(l.article_no)}</td><td>${esc(l.description)}</td><td class="m">${esc(l.category)}</td></tr>`).join('')}</table>
<script>setTimeout(()=>print(),300)</script>`)
  w.document.close()
}

/** Na "Besteld": hoe komt het binnen, wie haalt op, bestelnummer en (als je het weet) wanneer het klaar is of geleverd wordt. */
function OrderedForm({ o, onSave, onCancel }: { o: Order; onSave: (p: Partial<Order>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ delivery: how(o), pickup_by: o.pickup_by ?? '', reference: o.reference ?? '', expected_at: o.expected_at ?? '' })
  return (
    <form className="inko-form" onSubmit={(e) => { e.preventDefault(); onSave({ delivery: f.delivery, pickup_by: f.delivery === 'onderaannemer' ? (f.pickup_by.trim() || null) : null, reference: f.reference.trim() || null, expected_at: f.expected_at || null }) }}>
      <div className="inko-form-how">
        <span className="lbl">Hoe komt het binnen?</span>
        <DeliveryPick value={f.delivery} onPick={(v) => setF({ ...f, delivery: v })} />
      </div>
      <div className="inko-form-fields">
        {f.delivery === 'onderaannemer' && <label>Welke onderaannemer<SubInput value={f.pickup_by} onChange={(v) => setF({ ...f, pickup_by: v })} /></label>}
        <label>Bestelnummer<input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="als je het hebt" /></label>
        <label>{f.delivery === 'levering' ? 'Levering verwacht op' : 'Klaar om op te halen op'}<DateInput value={f.expected_at} onChange={(e) => setF({ ...f, expected_at: e.target.value })} /></label>
      </div>
      <div className="inko-form-acts">
        <button type="submit" className="primary">Bewaren als besteld</button>
        <button type="button" onClick={onCancel}>Annuleren</button>
      </div>
    </form>
  )
}
function DeliveryPick({ value, onPick }: { value: Delivery; onPick: (v: Delivery) => void }) {
  return (
    <div className="seg inko-how" role="radiogroup" aria-label="Hoe komt het binnen?">
      {DELIVERY.map(([k, label]) => <button type="button" key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onPick(k)}>{label}</button>)}
    </div>
  )
}
/** Naam van de onderaannemer: kiezen uit Relaties of vrij typen. */
function SubInput({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur?: () => void }) {
  const subs = useQuery<{ name: string }[]>(() => supabase.from('subcontractors').select('name').order('name'), [])
  return <>
    <input list="inko-subs" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder="naam" />
    <datalist id="inko-subs">{(subs.data ?? []).map((s) => <option key={s.name} value={s.name} />)}</datalist>
  </>
}

function OrderDetail({ o, onSave, onStatus }: { o: Order; onSave: (p: Partial<Order>) => void; onStatus: (s: string) => void }) {
  const lines = useQuery<Line[]>(() => supabase.from('order_lines').select('id,category,description,article_no,qty,unit,total').eq('order_id', o.id).eq('active', true).order('category'), [o.id])
  // artikel dat je liggen hebt: op voorraad zetten → telt mee in de kost, de open bestellijsten worden vanzelf bijgewerkt
  const canStock = o.status === 'te bestellen' && !o.manual
  const toStock = async (l: Line) => {
    const { error } = await supabase.rpc('stock_set', { p_article_no: l.article_no ?? '', p_description: l.description ?? '', p_supplier: o.supplier, p_active: true })
    toast(error ? 'Niet gelukt: ' + error.message : `${l.description}: op voorraad. Telt mee in de kost, komt niet meer op een bestellijst (terugzetten: Rekenregels → Prijzen → Op voorraad).`, error ? 'err' : 'ok')
    lines.reload()
  }
  const commit = (key: keyof Order, type: string, raw: string) => {
    const v = raw === '' ? null : type === 'number' ? Number(raw) : raw
    if (v === (o[key] ?? null)) return
    if (key === 'needed_by' && v == null) {
      // leeg = weer automatisch uit de planning
      supabase.rpc('project_needed_by', { p_code: o.project_code }).then(({ data }) => onSave({ needed_by: (data as string | null) ?? null, needed_by_manual: false }))
      return
    }
    onSave({ [key]: v, ...(key === 'needed_by' ? { needed_by_manual: true } : {}) } as Partial<Order>)
  }
  // datums als DD/MM/YYYY (DateInput), niet het formaat van de browser
  const field = (label: string, key: keyof Order, type = 'date') => (
    <label>
      {label}
      {type === 'date'
        ? <DateInput defaultValue={(o[key] as string | null) ?? ''} onBlur={(e) => commit(key, type, e.target.value)} />
        : <input type={type} defaultValue={(o[key] as string | number | null) ?? ''} onBlur={(e) => commit(key, type, e.target.value)} />}
    </label>
  )
  // eerst wat er besteld wordt (artikels), dan de mails, dan de gegevens van de bestelling
  const list = lines.data ?? []
  return (
    <div className="order-detail">
      <div className="inko-detail-head">
        <h4>Wat er besteld wordt{list.length ? ` · ${list.length} ${list.length === 1 ? 'artikel' : 'artikels'}` : ''}</h4>
        {list.length > 0 && <span className="order-actions">
          <button onClick={() => copyList(o, list)}>Lijst kopiëren</button>
          <button onClick={() => printList(o, list)}>Afdrukken / PDF</button>
        </span>}
      </div>
      {o.note?.startsWith('Aanvulling') && <p className="small inko-note">Aanvulling: deze artikels kwamen in de kosten bij nadat de eerste bestelling bij {o.supplier} al geplaatst was.</p>}
      {lines.loading ? <Loading /> : list.length ? (
        <table className="order-lines">
          <thead><tr><th className="num">Aantal</th><th>Artikel</th><th className="hide-sm">Art.nr</th><th className="hide-sm">Rubriek</th><th className="num">Totaal</th>{canStock && <th />}</tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}><td className="num">{qtyTxt(l)}</td><td>{l.description}</td><td className="muted hide-sm">{l.article_no}</td><td className="muted hide-sm">{l.category}</td>
                <td className="num">{fmtEur(l.total)}</td>
                {canStock && <td><button className="link small" title="Heb ik liggen: telt mee in de kost, niet meer bestellen (ook in volgende projecten)" onClick={() => toStock(l)}>op voorraad</button></td>}</tr>
            ))}
          </tbody>
        </table>
      ) : <p className="small">{o.note ? o.note.replace(/^Uit mail:\s*/, '') : 'Geen artikellijst: een eigen bestelling. Zet wat het is bij Notitie.'}</p>}
      <OrderMails orderId={o.id} />
      <h4 className="inko-detail-sub">Bestelling</h4>
      <div className="seg">
        {STATUSES.map((s) => <button key={s} className={o.status === s ? 'on' : ''} onClick={() => onStatus(s)}>{s}</button>)}
      </div>
      <div className="inko-form-how">
        <span className="lbl">Hoe komt het binnen?</span>
        <DeliveryPick value={how(o)} onPick={(v) => v !== how(o) && onSave({ delivery: v, ...(v !== 'onderaannemer' ? { pickup_by: null } : {}) })} />
        {how(o) === 'onderaannemer' && <PickupBy o={o} onSave={onSave} />}
      </div>
      <div className="order-fields">
        {field('Nodig op', 'needed_by')}
        {field('Levertermijn (werkdagen)', 'lead_days', 'number')}
        {field('Besteld op', 'ordered_at')}
        {field('Verzonden op', 'shipped_at' as keyof Order)}
        {field(how(o) === 'levering' ? 'Verwacht op' : 'Klaar op', 'expected_at')}
        {field(how(o) === 'levering' ? 'Geleverd op' : 'Opgehaald op', 'delivered_at')}
        {field('Bestelnummer', 'reference', 'text')}
        {field('Notitie', 'note', 'text')}
      </div>
      <p className="muted small">Bestellen doe je zelf bij de leverancier; klik daarna op "Besteld".{o.needed_by_manual ? ' Datum "nodig op" met de hand gezet (leeg maken = weer automatisch uit de planning).' : ''}</p>
    </div>
  )
}

function PickupBy({ o, onSave }: { o: Order; onSave: (p: Partial<Order>) => void }) {
  const [v, setV] = useState(o.pickup_by ?? '')
  return <label className="inko-pickup">Wie<SubInput value={v} onChange={setV} onBlur={() => (v.trim() || null) !== (o.pickup_by ?? null) && onSave({ pickup_by: v.trim() || null })} /></label>
}

/** Mails en bijlagen uit de mailbox die bij deze bestelling horen (mail_documents.order_id). */
function OrderMails({ orderId }: { orderId: string }) {
  type Md = { id: string; kind: string | null; stage: string | null; doc_number: string | null; storage_path: string | null; name: string | null; total_excl: number | null; total_incl: number | null; mail_messages: { subject: string | null; at: string; web_link: string | null } | null }
  const q = useQuery<Md[]>(() => supabase.from('mail_documents').select('id,kind,stage,doc_number,storage_path,name,total_excl,total_incl,mail_messages(subject,at,web_link)').eq('order_id', orderId) as never, [orderId])
  const rows = (q.data ?? []).sort((a, b) => (a.mail_messages?.at ?? '').localeCompare(b.mail_messages?.at ?? ''))
  if (!rows.length) return null
  const open = async (x: Md) => {
    if (!x.storage_path) { if (x.mail_messages?.web_link) window.open(x.mail_messages.web_link, '_blank'); return }
    const w = window.open('', '_blank')
    const { data } = await supabase.functions.invoke('mail-docs', { body: { action: 'url', doc_id: x.id } })
    if (data?.url && w) w.location.href = data.url; else w?.close()
  }
  return (
    <div className="order-mails small">
      <div className="muted">Uit de mailbox</div>
      {rows.map((x) => (
        <div key={x.id} className="order-mail">
          <span>{d(x.mail_messages?.at?.slice(0, 10) ?? null)}</span>
          <span className="jo-pill">{x.stage ?? x.kind}</span>
          <span className="om-subj">{x.mail_messages?.subject}</span>
          {(x.total_excl ?? x.total_incl) != null && <span>{fmtEur(x.total_excl ?? x.total_incl)}</span>}
          <button className="link small" onClick={() => open(x)}>{x.storage_path ? 'bijlage' : 'mail'}</button>
        </div>
      ))}
    </div>
  )
}
