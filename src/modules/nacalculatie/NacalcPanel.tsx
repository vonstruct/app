import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { RuleLink } from '../../core/RuleLink'

/**
 * Tab "Nacalculatie" op de projectpagina: offerte (omzet) tegenover werkelijke kosten (bestellingen met werkelijk factuurbedrag,
 * extra kosten, uren × uurkost), marge gepland vs werkelijk, platen geschat vs werkelijk (partner). View app_nacalc.
 */
type N = {
  project_code: string; quote_number: string | null; revenue_excl: number; cost_planned: number | null; sales_without_cost: number | null
  orders_est: number; orders_actual: number; orders_without_invoice: number; extra_costs: number; hours: number; hours_cost: number
  cost_actual: number; margin_planned: number; margin_actual: number; invoiced_excl: number; paid_incl: number; sheets_est: number | null; actual_sheets: number | null
}
type Order = { id: string; supplier: string; ordered_by: string | null; amount: number | null; actual_amount: number | null; status: string }
type Cost = { id: string; cost_date: string | null; category: string; supplier: string | null; description: string; amount_excl: number; invoice_ref: string | null }
type Hour = { id: string; work_date: string; who: string; activity: string | null; hours: number; rate: number | null; cost: number; note: string | null }

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + ' %' : '—')
const CATS = ['Toestellen', 'Sanitair', 'Werkblad', 'Onderaannemer', 'Transport', 'Materiaal', 'Andere']

export function NacalcPanel({ project }: { project: string }) {
  const n = useQuery<N | null>(() => supabase.from('app_nacalc').select('*').eq('project_code', project).maybeSingle(), [project])
  const orders = useQuery<Order[]>(() => supabase.from('orders').select('id,supplier,ordered_by,amount,actual_amount,status').eq('project_code', project).neq('status', 'geannuleerd').order('supplier'), [project])
  const costs = useQuery<Cost[]>(() => supabase.from('actual_costs').select('*').eq('project_code', project).order('cost_date'), [project])
  const hours = useQuery<Hour[]>(() => supabase.from('app_work_hours').select('*').eq('project_code', project).order('work_date', { ascending: false }), [project])
  const acts = useQuery<{ value: { lijst?: string[] } } | null>(() => supabase.from('rule_settings').select('value').eq('key', 'uur_activiteiten').maybeSingle(), [])
  const reload = () => { n.reload(); orders.reload(); costs.reload(); hours.reload() }
  const [c, setC] = useState({ description: '', category: 'Toestellen', supplier: '', amount: '', ref: '' })
  const [h, setH] = useState({ date: new Date().toLocaleDateString('sv-SE'), hours: '', activity: 'Plaatsing', person: 'Olivier', note: '' })
  if (n.loading) return <Loading />
  const x = n.data
  const num = (s: string) => Number(s.replace(',', '.'))
  const addCost = async () => {
    if (!c.description || !num(c.amount)) return toast('Omschrijving en bedrag invullen', 'err')
    const { error } = await supabase.from('actual_costs').insert({ project_code: project, description: c.description, category: c.category, supplier: c.supplier || null, amount_excl: num(c.amount), invoice_ref: c.ref || null })
    if (error) toast(error.message, 'err'); else { setC({ ...c, description: '', supplier: '', amount: '', ref: '' }); reload() }
  }
  const addHours = async () => {
    if (!num(h.hours)) return toast('Aantal uren invullen', 'err')
    const { error } = await supabase.from('work_hours').insert({ project_code: project, work_date: h.date, hours: num(h.hours), activity: h.activity, person: h.person || 'Olivier', note: h.note || null })
    if (error) toast(error.message, 'err'); else { setH({ ...h, hours: '', note: '' }); toast('Uren bewaard'); reload() }
  }
  const remove = async (table: 'actual_costs' | 'work_hours', id: string) => { if (!confirm('Regel weghalen?')) return; await supabase.from(table).delete().eq('id', id); reload() }
  const setActual = async (o: Order, v: string) => { await supabase.from('orders').update({ actual_amount: v === '' ? null : num(v) }).eq('id', o.id); reload() }

  return (
    <div className="nacalc">
      <ErrorBox error={n.error} />
      <div className="quote-intern">
        <span><small>Omzet (offerte {x?.quote_number ?? '—'}, excl.)</small><b>{fmtEur(x?.revenue_excl ?? 0)}</b></span>
        <span><small>Werkelijke kosten</small><b>{fmtEur(x?.cost_actual ?? 0)}</b></span>
        <span><small>Werkelijke marge</small><b className={(x?.margin_actual ?? 0) < 0 ? 'bad-txt' : ''}>{fmtEur(x?.margin_actual ?? 0)} · {pct(x?.margin_actual ?? 0, x?.revenue_excl ?? 0)}</b></span>
        <span title="Omzet min de berekende kostprijs (kasten, lades, werkblad). Regels zonder kostprijs (toestellen, diensten) tellen hier volledig als marge."><small>Geplande marge</small><b>{fmtEur(x?.margin_planned ?? 0)} · {pct(x?.margin_planned ?? 0, x?.revenue_excl ?? 0)}</b></span>
        <span><small>Gefactureerd / betaald</small><b>{fmtEur(x?.invoiced_excl ?? 0)} excl. · {fmtEur(x?.paid_incl ?? 0)} incl.</b></span>
      </div>
      {(x?.sales_without_cost ?? 0) > 0 && <p className="muted small">Let op: {fmtEur(x?.sales_without_cost)} van de offerte (toestellen, diensten …) heeft geen berekende kostprijs. Vul de werkelijke kosten hieronder in voor een juiste marge.</p>}

      <h3 className="ho-h">Platen</h3>
      <div className="quote-intern">
        <span><small>Geschat (onze optimalisatie)</small><b>{x?.sheets_est ?? '—'}</b></span>
        <span><small>Werkelijk (partner)</small><b><input className="inline num" type="number" defaultValue={x?.actual_sheets ?? ''} onBlur={async (e) => { await supabase.from('projects').update({ actual_sheets: e.target.value === '' ? null : Number(e.target.value) }).eq('project_code', project); reload() }} /></b></span>
        {x?.sheets_est && x?.actual_sheets ? <span><small>Verschil</small><b>{x.actual_sheets - x.sheets_est > 0 ? '+' : ''}{x.actual_sheets - x.sheets_est} ({pct(x.actual_sheets - x.sheets_est, x.sheets_est)})</b></span> : null}
      </div>

      <h3 className="ho-h">Bestellingen: geschat en werkelijk</h3>
      {(orders.data ?? []).length === 0 ? <p className="muted">Geen bestellingen.</p> : (
        <table className="order-lines">
          <thead><tr><th>Leverancier</th><th className="num">Geschat</th><th className="num">Werkelijk (factuur, excl.)</th><th className="num">Verschil</th></tr></thead>
          <tbody>{(orders.data ?? []).map((o) => (
            <tr key={o.id}><td>{o.supplier}{o.ordered_by && !['Zelf', 'Vonstruct'].includes(o.ordered_by) ? ' via ' + o.ordered_by : ''}</td><td className="num">{fmtEur(o.amount)}</td>
              <td className="num"><input className="inline num" defaultValue={o.actual_amount ?? ''} placeholder="factuurbedrag" onBlur={(e) => e.target.value !== String(o.actual_amount ?? '') && setActual(o, e.target.value)} /></td>
              <td className="num">{o.actual_amount != null ? fmtEur(Number(o.actual_amount) - Number(o.amount ?? 0)) : ''}</td></tr>
          ))}</tbody>
        </table>
      )}

      <h3 className="ho-h">Andere kosten</h3>
      {(costs.data ?? []).map((k) => (
        <div key={k.id} className="nc-row"><span>{k.category}</span><span>{k.description}{k.supplier ? ' · ' + k.supplier : ''}{k.invoice_ref ? ' · ' + k.invoice_ref : ''}</span><b>{fmtEur(k.amount_excl)}</b><button onClick={() => remove('actual_costs', k.id)}>×</button></div>
      ))}
      <div className="ho-new nc-new">
        <select value={c.category} onChange={(e) => setC({ ...c, category: e.target.value })}>{CATS.map((k) => <option key={k}>{k}</option>)}</select>
        <input placeholder="Omschrijving, bv. oven en kookplaat" value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
        <input placeholder="Leverancier" value={c.supplier} onChange={(e) => setC({ ...c, supplier: e.target.value })} />
        <input placeholder="Bedrag excl. btw" inputMode="decimal" value={c.amount} onChange={(e) => setC({ ...c, amount: e.target.value })} />
        <button className="primary" onClick={addCost}>+ Kost</button>
      </div>

      <h3 className="ho-h">Uren {x?.hours ? <span className="muted small">{x.hours} u · {fmtEur(x.hours_cost)}</span> : null}</h3>
      {(hours.data ?? []).map((w) => (
        <div key={w.id} className="nc-row"><span>{new Date(w.work_date + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}</span><span>{w.who} · {w.activity ?? ''}{w.note ? ' · ' + w.note : ''}</span><b>{w.hours} u</b><button onClick={() => remove('work_hours', w.id)}>×</button></div>
      ))}
      <div className="ho-new nc-new">
        <input type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} />
        <select value={h.activity} onChange={(e) => setH({ ...h, activity: e.target.value })}>{(acts.data?.value?.lijst ?? ['Plaatsing']).map((a) => <option key={a}>{a}</option>)}</select>
        <input placeholder="Wie" value={h.person} onChange={(e) => setH({ ...h, person: e.target.value })} />
        <input placeholder="Uren" inputMode="decimal" value={h.hours} onChange={(e) => setH({ ...h, hours: e.target.value })} />
        <button className="primary" onClick={addHours}>+ Uren</button>
      </div>
      <p className="muted small">Tip: zeg tegen VON of Siri "noteer 4 uur plaatsing op &lt;projectcode&gt;". Uurkost aanpassen: <RuleLink s="Nacalculatie" />.</p>
    </div>
  )
}
