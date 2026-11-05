import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'

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
}
type Line = { id: string; category: string | null; description: string | null; article_no: string | null; qty: number | null; unit: string | null; total: number | null }

const STATUSES = ['te bestellen', 'besteld', 'bevestigd', 'geleverd', 'geannuleerd']
const URG: Record<string, [string, string]> = {
  'te laat': ['Te laat', 'bad'], 'nu bestellen': ['Nu bestellen', 'warn'], 'levering te laat': ['Levering te laat', 'bad'],
  'komt te laat': ['Komt te laat', 'bad'], 'geen deadline': ['Geen deadline', 'muted'], 'levertijd onbekend': ['Levertijd onbekend', 'warn'], later: ['Later', ''], onderweg: ['Onderweg', 'ok'], klaar: ['Klaar', 'ok'], vervallen: ['Vervallen', 'muted'],
}
const ORDER = ['te laat', 'levering te laat', 'komt te laat', 'nu bestellen', 'levertijd onbekend', 'geen deadline', 'later', 'onderweg', 'klaar', 'vervallen']
const d = (v: string | null) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '—')
const today = () => new Date().toLocaleDateString('sv-SE')
/** Waar een datum vandaan komt: feit (uit mail, ingevuld, planning) of aanname (regel). */
export function Src({ s }: { s?: string | null }) {
  if (!s) return null
  const assumed = s.startsWith('aanname')
  return <span className={'src-tag' + (assumed ? ' assumed' : '')} title={assumed ? 'Berekend uit een regel (aanname), geen feit' : 'Feit'}>{s}</span>
}

export function Orders({ project }: { project?: string }) {
  const [filter, setFilter] = useState<'open' | 'alles'>('open')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const q = useQuery<Order[]>(() => {
    let r = supabase.from('app_orders').select('*')
    if (project) r = r.eq('project_code', project)
    return r.order('order_by', { ascending: true, nullsFirst: false })
  }, [project])

  const rows = useMemo(() => {
    const all = (q.data ?? []).filter((o) => filter === 'alles' || !['klaar', 'vervallen'].includes(o.urgency))
    return all.sort((a, b) => ORDER.indexOf(a.urgency) - ORDER.indexOf(b.urgency))
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
  const total = rows.filter((o) => o.status !== 'geannuleerd').reduce((s, o) => s + Number(o.amount ?? 0), 0)

  return (
    <div className="orders">
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
      {!rows.length && <p className="muted">{project ? 'Nog geen bestellingen. Maak de lijst uit de kosten van de laatste ontwerpversie.' : 'Niets te bestellen.'}</p>}
      {rows.map((o) => {
        const [lbl, cls] = URG[o.urgency] ?? [o.urgency, '']
        const isOpen = open === o.id
        return (
          <div key={o.id} className={'order-row' + (isOpen ? ' open' : '')}>
            <div className="order-head" onClick={() => setOpen(isOpen ? null : o.id)}>
              <span className={'jo-pill ' + cls}>{lbl}</span>
              <div className="order-main">
                <strong>{o.supplier}</strong>{o.ordered_by && !['Zelf', 'Vonstruct'].includes(o.ordered_by) && <span className="muted"> via {o.ordered_by}</span>}
                <div className="muted small">
                  {!project && <><Link to={`/projecten/${o.project_code}?tab=bestellingen`} onClick={(e) => e.stopPropagation()}>{o.project_code}</Link>{o.client_name ? ' · ' + o.client_name : ''} · </>}
                  {o.manual ? (o.note || 'eigen bestelling') + (o.reference ? ' · ' + o.reference : '') : <>{(o.categories ?? []).join(', ')} · {o.n_lines} artikels</>}
                </div>
              </div>
              <div className="order-dates small">
                {o.status === 'te bestellen' ? (o.order_by ? <>bestellen vóór <strong>{d(o.order_by)}</strong> <Src s="aanname (levertijd)" /></> : <>bestellen vóór <strong>?</strong></>) : <><Stages o={o} />{o.expected_at && !o.delivered_at && <> <Src s={o.expected_src} /></>}</>}
                <div className="muted">nodig op {d(o.needed_by)} <Src s={o.needed_src} /> · {o.lead_days_eff != null ? <>{o.lead_days_eff} wd levertijd <Src s={o.lead_src} /></> : 'levertijd onbekend'}</div>
              </div>
              <div className="order-amt">{fmtEur(o.amount)}</div>
            </div>
            {isOpen && <OrderDetail o={o} onSave={(p) => save(o.id, p)} onStatus={(s) => setStatus(o, s)} />}
          </div>
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
        <label>Besteld op<input type="date" value={f.ordered_at} onChange={set('ordered_at')} /></label>
        <label>Verwacht op<input type="date" value={f.expected_at} onChange={set('expected_at')} /></label>
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

function OrderDetail({ o, onSave, onStatus }: { o: Order; onSave: (p: Partial<Order>) => void; onStatus: (s: string) => void }) {
  const lines = useQuery<Line[]>(() => supabase.from('order_lines').select('id,category,description,article_no,qty,unit,total').eq('order_id', o.id).eq('active', true).order('category'), [o.id])
  // artikel dat je liggen hebt: op voorraad zetten → telt mee in de kost, de open bestellijsten worden vanzelf bijgewerkt
  const canStock = o.status === 'te bestellen' && !o.manual
  const toStock = async (l: Line) => {
    const { error } = await supabase.rpc('stock_set', { p_article_no: l.article_no ?? '', p_description: l.description ?? '', p_supplier: o.supplier, p_active: true })
    toast(error ? 'Niet gelukt: ' + error.message : `${l.description}: op voorraad. Telt mee in de kost, komt niet meer op een bestellijst (terugzetten: Rekenregels → Prijzen → Op voorraad).`, error ? 'err' : 'ok')
    lines.reload()
  }
  const field = (label: string, key: keyof Order, type = 'date') => (
    <label>
      {label}
      <input type={type} defaultValue={(o[key] as string | number | null) ?? ''}
        onBlur={(e) => {
          const v = e.target.value === '' ? null : type === 'number' ? Number(e.target.value) : e.target.value
          if (v === (o[key] ?? null)) return
          if (key === 'needed_by' && v == null) {
            // leeg = weer automatisch uit de planning
            supabase.rpc('project_needed_by', { p_code: o.project_code }).then(({ data }) => onSave({ needed_by: (data as string | null) ?? null, needed_by_manual: false }))
            return
          }
          onSave({ [key]: v, ...(key === 'needed_by' ? { needed_by_manual: true } : {}) } as Partial<Order>)
        }} />
    </label>
  )
  return (
    <div className="order-detail">
      <div className="seg">
        {STATUSES.map((s) => <button key={s} className={o.status === s ? 'on' : ''} onClick={() => onStatus(s)}>{s}</button>)}
      </div>
      <div className="order-fields">
        {field('Nodig op', 'needed_by')}
        {field('Levertermijn (werkdagen)', 'lead_days', 'number')}
        {field('Besteld op', 'ordered_at')}
        {field('Verzonden op', 'shipped_at' as keyof Order)}
        {field('Verwacht op', 'expected_at')}
        {field('Geleverd op', 'delivered_at')}
        {field('Bestelnummer', 'reference', 'text')}
        {field('Notitie', 'note', 'text')}
      </div>
      <div className="order-actions">
        <button onClick={() => copyList(o, lines.data ?? [])}>Lijst kopiëren</button>
        <button onClick={() => printList(o, lines.data ?? [])}>Afdrukken / PDF</button>
        <span className="muted small">Bestellen doe je zelf bij de leverancier; zet daarna de status op "besteld".</span>
      </div>
      <OrderMails orderId={o.id} />
      {o.needed_by_manual && <p className="muted small">Datum "nodig op" met de hand gezet (leeg maken = weer automatisch uit de planning).</p>}
      {lines.loading ? <Loading /> : (
        <table className="order-lines">
          <thead><tr><th className="hide-sm">Rubriek</th><th>Artikel</th><th className="hide-sm">Art.nr</th><th className="num">Aantal</th><th className="num">Totaal</th>{canStock && <th />}</tr></thead>
          <tbody>
            {(lines.data ?? []).map((l) => (
              <tr key={l.id}><td className="hide-sm">{l.category}</td><td>{l.description}</td><td className="muted hide-sm">{l.article_no}</td>
                <td className="num">{l.qty != null ? Number(l.qty).toLocaleString('nl-BE', { maximumFractionDigits: 2 }) : ''} {l.unit}</td><td className="num">{fmtEur(l.total)}</td>
                {canStock && <td><button className="link small" title="Heb ik liggen: telt mee in de kost, niet meer bestellen (ook in volgende projecten)" onClick={() => toStock(l)}>op voorraad</button></td>}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Waar de bestelling staat: besteld → verzonden → geleverd, met datums (ook uit de mailbox). */
function Stages({ o }: { o: Order }) {
  const st = [
    o.ordered_at && `besteld ${d(o.ordered_at)}`,
    o.shipped_at && `verzonden ${d(o.shipped_at)}`,
    o.delivered_at ? `geleverd ${d(o.delivered_at)}` : o.expected_at && `verwacht ${d(o.expected_at)}`,
  ].filter(Boolean)
  return <>{st.length ? st.join(' → ') : o.status}{o.n_docs ? <span className="muted" title="mails en bijlagen uit de mailbox"> · ✉ {o.n_docs}</span> : null}</>
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
