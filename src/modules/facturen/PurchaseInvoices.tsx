import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { RuleLink } from '../../core/RuleLink'

/**
 * Inkoop → Aankoopfacturen (verkoop: Projecten → Verkoopfacturen, `Invoices`). Vroeger Planning → Facturen met tab Verkoop en Aankoop (openstaande leveranciersfacturen uit Yuki, view `app_purchase_invoices`).
 * Aankoop wordt elk uur opgehaald (Edge Function `yuki`, sync_payments → purchase_invoices); verdwenen uit Yuki = betaald.
 * Koppelen aan een bestelling zet het werkelijke bedrag (excl. btw, geschat) in de nacalculatie.
 */

type PI = {
  yuki_id: string; supplier: string | null; reference: string | null; description: string | null; invoice_date: string | null; due_date: string | null
  original_amount: number; open_amount: number; amount_excl: number; is_open: boolean; closed_at: string | null
  order_id: string | null; project_code: string | null; match_kind: string | null; order_supplier: string | null; order_reference: string | null; state: string
  payment_method: string | null; auto_paid: 'domiciliëring' | 'kaart' | null
}
type O = { id: string; project_code: string; supplier: string; status: string; reference: string | null; client_name: string | null }
const STATE: Record<string, [string, string]> = { vervallen: ['Vervallen', 'bad'], binnenkort: ['Binnenkort', 'warn'], open: ['Te betalen', ''], automatisch: ['Domiciliëring', 'muted'], betaald: ['Betaald', 'ok'] }
const d = (v: string | null) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '—')
const rank = (s: string) => ['vervallen', 'binnenkort', 'open', 'automatisch', 'betaald'].indexOf(s)

export function PurchaseInvoices() {
  const [filter, setFilter] = useState<'open' | 'alles'>('open')
  const [busy, setBusy] = useState(false)
  const q = useQuery<PI[]>(() => supabase.from('app_purchase_invoices').select('*').order('due_date', { nullsFirst: false }), [])
  const orders = useQuery<O[]>(() => supabase.from('app_orders').select('id,project_code,supplier,status,reference,client_name').neq('status', 'geannuleerd').order('project_code', { ascending: false }) as never, [])
  const rows = (q.data ?? []).filter((r) => filter === 'alles' || (r.is_open && r.state !== 'automatisch')).sort((a, b) => rank(a.state) - rank(b.state))
  const sum = (f: (r: PI) => boolean) => (q.data ?? []).filter(f).reduce((a, r) => a + Number(r.open_amount), 0)

  const link = async (id: string, order_id: string | null) => {
    const o = (orders.data ?? []).find((x) => x.id === order_id)
    const { error } = await supabase.from('purchase_invoices').update({ order_id, project_code: o?.project_code ?? null, match_kind: order_id ? 'hand' : 'geen', updated_at: new Date().toISOString() }).eq('yuki_id', id)
    if (error) toast(error.message, 'err'); else { toast(order_id ? 'Gekoppeld · werkelijk bedrag in de nacalculatie' : 'Niet aan een project gekoppeld'); q.reload() }
  }
  // leverancier toevoegen aan de regel domiciliering (Rekenregels → Facturen)
  const addDebit = async (supplier: string) => {
    if (!confirm(`${supplier} altijd via domiciliëring? Hun facturen staan dan niet meer bij "te betalen". (Aan te passen in Rekenregels → Facturen.)`)) return
    const { data } = await supabase.from('rule_settings').select('value').eq('key', 'domiciliering').single()
    const list: string[] = (data?.value as { leveranciers?: string[] } | null)?.leveranciers ?? []
    const { error } = await supabase.from('rule_settings').update({ value: { leveranciers: [...list, supplier] } }).eq('key', 'domiciliering')
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); q.reload() }
  }
  const sync = async () => {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('yuki', { body: { action: 'sync_payments', force: true } })
    setBusy(false)
    if (error || data?.error) toast(error?.message ?? data.error, 'err'); else { toast(`Bijgewerkt · ${data?.purchases?.open ?? 0} open bij leveranciers`); q.reload() }
  }

  if (q.loading) return <Loading />
  return (
    <div className="orders">
      <div className="quote-intern">
        <span><small>Te betalen</small><b>{fmtEur(sum((r) => r.is_open && r.state !== 'automatisch'))}</b></span>
        <span><small>Waarvan vervallen</small><b className={sum((r) => r.state === 'vervallen') ? 'bad-txt' : ''}>{fmtEur(sum((r) => r.state === 'vervallen'))}</b></span>
        <span><small>Binnen 3 dagen</small><b>{fmtEur(sum((r) => r.state === 'binnenkort'))}</b></span>
        <span><small>Via domiciliëring / kaart</small><b className="muted">{fmtEur(sum((r) => r.state === 'automatisch'))}</b></span>
      </div>
      <div className="orders-bar">
        <div className="seg">
          <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Te betalen</button>
          <button className={filter === 'alles' ? 'on' : ''} onClick={() => setFilter('alles')}>Alles</button>
        </div>
        <button disabled={busy} onClick={sync}>{busy ? 'Ophalen…' : 'Ophalen uit Yuki'}</button>
      </div>
      <p className="muted small">Uit Yuki (Aankoop → Onbetaalde facturen), elk uur bijgewerkt. Betalen doe je zelf via je bank of Yuki; domiciliëring en kaartbetalingen staan apart (lijst in <RuleLink s="Facturen" />). Koppel een factuur aan een bestelling, dan komt het werkelijke bedrag in de nacalculatie (excl. btw, geschat: Belgische leverancier 21 %, buitenland 0 %).</p>
      <ErrorBox error={q.error} />
      {!rows.length && <p className="muted">Geen openstaande leveranciersfacturen.</p>}
      {rows.map((r) => {
        const [lbl, cls] = r.state === 'automatisch' && r.auto_paid === 'kaart' ? ['Kaart', 'muted'] : STATE[r.state] ?? [r.state, '']
        return (
          <div key={r.yuki_id} className="order-row">
            <div className="order-head pi-head">
              <span className={'jo-pill ' + cls}>{lbl}</span>
              <div className="order-main">
                <strong>{r.supplier}</strong>
                <div className="muted small">{r.reference}{r.description ? ' · ' + r.description.replace(/^Factuur van [^,]*,\s*/, '') : ''}</div>
                <div className="pi-link small">
                  <select value={r.order_id ?? ''} onChange={(e) => link(r.yuki_id, e.target.value || null)}>
                    <option value="">{r.match_kind === 'geen' ? 'geen project (algemene kost)' : '— koppelen aan bestelling —'}</option>
                    {(orders.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.project_code} · {o.supplier}{o.client_name ? ' · ' + o.client_name : ''}{o.reference ? ' · ' + o.reference : ''}</option>)}
                  </select>
                  {r.order_id && r.project_code && <Link to={`/projecten/${r.project_code}?tab=nacalculatie`}>{r.match_kind === 'auto' ? 'automatisch gekoppeld' : 'nacalculatie'} →</Link>}
                  {!r.order_id && r.match_kind !== 'geen' && <button className="link small" onClick={() => link(r.yuki_id, null)}>algemene kost</button>}
                  {r.is_open && !r.auto_paid && r.supplier && <button className="link small" onClick={() => addDebit(r.supplier!)}>via domiciliëring</button>}
                </div>
              </div>
              <div className="order-dates small">
                {r.auto_paid ? <>{r.auto_paid === 'kaart' ? 'betaald met kaart' : 'gaat vanzelf van de rekening'}</> : r.is_open ? <>{r.due_date ? (r.state === 'vervallen' ? 'vervallen ' : 'betalen voor ') + d(r.due_date) : 'geen vervaldag'}</> : <>betaald {d(r.closed_at)}</>}
                <div className="muted">factuur {d(r.invoice_date)}</div>
              </div>
              <div className="order-amt">{fmtEur(r.is_open ? r.open_amount : r.original_amount)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
