import { useState } from 'react'
import { supabase } from './supabase'
import { fmtNum } from './format'
import { DateInput } from './DateInput'

/**
 * Bestelling en ophaling bij de productiepartner, zoals de partner ze ziet: platen en kantenband bestellen (per leverancier
 * "besteld + verwacht op" of "binnen"), ophaaldatum bevestigen, palletvoorstel, productie klaar. Gegevens = partner_order_json() in Supabase.
 * act = de partner kan klikken (portaal); in het voorbeeld voor de beheerder staan de knoppen uit.
 */
export type POLine = { description: string; article_no: string | null; qty: number; unit: string | null; category: string | null }
export type POOrder = { id: string; supplier: string; status: string; ordered_at: string | null; expected_at: string | null; delivered_at: string | null; reference: string | null; lines: POLine[] | null }
export type Pallet = { nr: number; type: string; n: number; kg: number; hoogte_mm: number; langste_mm: number; vooraan: boolean; materials: { material: string; n: number }[] | null }
export type PalletPlan = {
  type: string; size: string; count: number; auto: boolean; total_kg: number; total_hoogte_mm: number; n_parts: number; langste_mm: number
  pallets: Pallet[]; te_groot: { l: number; w: number; material: string }[] | null; warnings: string[] | null; instructie: string | null
} | null
export type PartnerOrder = {
  id: string; project_code: string; title: string | null; client: string | null; status: string; sent_at: string | null; sent_count: number
  pickup_date: string | null; pickup_slot: string | null; pickup_answer: string | null; pickup_note: string | null; pickup_answered_at: string | null
  needed_by: string | null; note: string | null; ready_at: string | null; ready_pallets: number | null; ready_note: string | null; picked_up_at: string | null
  orders: POOrder[] | null; pallets: PalletPlan
}

const day = (d: string | null, long = false) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('nl-BE', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' }) : '')
const SLOT: Record<string, string> = { voormiddag: 'voormiddag', namiddag: 'namiddag', dag: 'hele dag' }
export const palletName = (type: string, n = 1) => (type === 'groot' ? (n === 1 ? 'grote pallet' : 'grote pallets') : n === 1 ? 'europallet' : 'europallets')

export function PartnerOrderView({ o, act, onChange }: { o: PartnerOrder; act: boolean; onChange?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [exp, setExp] = useState<Record<string, string>>({})
  const [ref, setRef] = useState<Record<string, string>>({})
  const [no, setNo] = useState(false)
  const [why, setWhy] = useState('')
  const [pallets, setPallets] = useState<string>('')
  const [readyNote, setReadyNote] = useState('')
  const run = async (key: string, f: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(key)
    const { error } = await f()
    setBusy(null)
    if (error) alert(error.message)
    else onChange?.()
  }
  const orders = o.orders ?? []
  const allIn = orders.length > 0 && orders.every((x) => x.status === 'geleverd')
  const plan = o.pallets
  return (
    <div className="po">
      <ol className="po-steps">
        <li className={allIn ? 'done' : ''}>
          <h4>Platen en kantenband bestellen {o.needed_by && <span className="muted small">· graag binnen tegen {day(o.needed_by, true)}</span>}</h4>
          {orders.length === 0 ? <p className="muted small">Niets te bestellen.</p> : orders.map((x) => (
            <div key={x.id} className="po-order">
              <div className="po-order-head"><b>{x.supplier}</b>
                <span className={'pill ' + (x.status === 'geleverd' ? 'ok' : x.status === 'te bestellen' ? 'warn' : '')}>
                  {x.status === 'geleverd' ? `✓ binnen ${day(x.delivered_at)}` : x.status === 'te bestellen' ? 'nog te bestellen' : `besteld${x.expected_at ? ` · verwacht ${day(x.expected_at)}` : ''}`}
                </span>
                {x.reference && <span className="small muted">ref. {x.reference}</span>}
              </div>
              <ul className="po-lines">{(x.lines ?? []).map((l, i) => <li key={i}><span className="po-qty">{fmtNum(l.qty, l.unit === 'm' ? 1 : 0)} {l.unit === 'plaat' ? (Number(l.qty) === 1 ? 'plaat' : 'platen') : l.unit}</span> {l.description}{l.article_no && <small className="muted"> · {l.article_no}</small>}</li>)}</ul>
              {x.status === 'te bestellen' && (
                <div className="po-act">
                  <label className="small">Verwacht binnen op <DateInput value={exp[x.id] ?? ''} onChange={(e) => setExp({ ...exp, [x.id]: e.target.value })} disabled={!act} /></label>
                  <input className="po-ref" placeholder="bestelnummer (mag leeg)" value={ref[x.id] ?? ''} onChange={(e) => setRef({ ...ref, [x.id]: e.target.value })} disabled={!act} />
                  <button className="primary" disabled={!act || busy === x.id || !exp[x.id]} title={!exp[x.id] ? 'Vul eerst de verwachte leverdatum in' : ''}
                    onClick={() => run(x.id, () => supabase.rpc('portal_partner_supplier', { p_order: x.id, p_action: 'besteld', p_expected: exp[x.id], p_ref: ref[x.id] || null }))}>Besteld</button>
                  <button disabled={!act || busy === x.id} onClick={() => run(x.id, () => supabase.rpc('portal_partner_supplier', { p_order: x.id, p_action: 'binnen' }))}>Op voorraad / al binnen</button>
                </div>
              )}
              {(x.status === 'besteld' || x.status === 'bevestigd') && (
                <div className="po-act"><button disabled={!act || busy === x.id} onClick={() => run(x.id, () => supabase.rpc('portal_partner_supplier', { p_order: x.id, p_action: 'binnen' }))}>✓ Binnen</button></div>
              )}
            </div>
          ))}
        </li>
        <li className={o.pickup_answer === 'ok' ? 'done' : o.pickup_answer === 'probleem' ? 'bad' : ''}>
          <h4>Ophalen</h4>
          {o.pickup_date ? (
            <>
              <p><b>{day(o.pickup_date, true)}</b>{o.pickup_slot && o.pickup_slot !== 'dag' ? ` · ${SLOT[o.pickup_slot]}` : ''} <span className="muted small">Olivier komt alles ophalen.</span></p>
              {o.pickup_answer === 'ok' && <p className="small">✓ Bevestigd dat dit lukt{o.pickup_note ? ` · ${o.pickup_note}` : ''}</p>}
              {o.pickup_answer === 'probleem' && <p className="small bad-text">Lukt niet: {o.pickup_note ?? '—'}</p>}
              {!o.pickup_answer && (
                <div className="po-act">
                  <button className="primary" disabled={!act || busy === 'pick'} onClick={() => run('pick', () => supabase.rpc('portal_partner_pickup', { p_id: o.id, p_ok: true }))}>✓ Dat lukt</button>
                  <button disabled={!act} onClick={() => setNo(!no)}>Lukt niet…</button>
                </div>
              )}
              {no && !o.pickup_answer && (
                <div className="po-act">
                  <input className="po-why" placeholder="Waarom niet, en wanneer wel?" value={why} onChange={(e) => setWhy(e.target.value)} />
                  <button disabled={!act || !why.trim() || busy === 'pick'} onClick={() => run('pick', () => supabase.rpc('portal_partner_pickup', { p_id: o.id, p_ok: false, p_note: why }))}>Doorgeven</button>
                </div>
              )}
            </>
          ) : <p className="muted small">De ophaaldatum volgt nog.</p>}
        </li>
        <li>
          <h4>Paletten</h4>
          <PalletView plan={plan} />
        </li>
        <li className={o.ready_at ? 'done' : ''}>
          <h4>Klaar om op te halen</h4>
          {o.ready_at ? (
            <p className="small">✓ Klaar sinds {day(o.ready_at, true)}{o.ready_pallets ? ` · ${o.ready_pallets} pallet(s)` : ''}{o.ready_note ? ` · ${o.ready_note}` : ''}</p>
          ) : (
            <div className="po-act">
              <label className="small">Aantal pallets <input type="number" min={1} max={20} className="po-n" placeholder={String(plan?.count ?? 1)} value={pallets} onChange={(e) => setPallets(e.target.value)} disabled={!act} /></label>
              <input className="po-why" placeholder="opmerking (mag leeg)" value={readyNote} onChange={(e) => setReadyNote(e.target.value)} disabled={!act} />
              <button className="primary" disabled={!act || busy === 'ready'} onClick={() => run('ready', () => supabase.rpc('portal_partner_ready', { p_id: o.id, p_pallets: Number(pallets || plan?.count || 1), p_note: readyNote || null }))}>Productie is klaar</button>
            </div>
          )}
        </li>
      </ol>
    </div>
  )
}

/** Palletvoorstel: samenvatting, bovenaanzicht van de aanhangwagen (zwaarste vooraan), per pallet, te grote stukken, stapelinstructie. */
export function PalletView({ plan }: { plan: PalletPlan }) {
  if (!plan || !plan.count) return <p className="muted small">Geen platen voor de partner.</p>
  const maxL = Math.max(...plan.pallets.map((p) => (p.type === 'groot' ? 2400 : 1200)))
  return (
    <div className="pallets">
      <p><b>{plan.count} {palletName(plan.type, plan.count)}</b> <span className="muted">({plan.size} mm)</span> · ± {fmtNum(plan.total_kg, 0)} kg · stapel ± {fmtNum(plan.total_hoogte_mm / 10 / plan.count, 0)} cm{plan.count > 1 ? ' per pallet' : ''} · {plan.n_parts} stukken</p>
      <div className="pallet-trailer" aria-label="Bovenaanzicht aanhangwagen">
        <span className="pallet-front">▲ vooraan (trekhaak)</span>
        <div className="pallet-row">
          {plan.pallets.map((p) => (
            <div key={p.nr} className={'pallet-box' + (p.vooraan ? ' front' : '')} style={{ height: `${((p.type === 'groot' ? 2400 : 1200) / maxL) * 120}px` }}>
              <b>{p.nr}</b><span>{fmtNum(p.kg, 0)} kg</span>
            </div>
          ))}
        </div>
      </div>
      {plan.pallets.length > 1 && (
        <ul className="small pallet-list">{plan.pallets.map((p) => (
          <li key={p.nr}><b>Pallet {p.nr}{p.vooraan ? ' (zwaarste, vooraan laden)' : ''}</b>: {p.n} stukken, ± {fmtNum(p.kg, 0)} kg, ± {fmtNum(p.hoogte_mm / 10, 0)} cm, langste {fmtNum(p.langste_mm, 0)} mm</li>
        ))}</ul>
      )}
      {(plan.te_groot ?? []).length > 0 && <p className="small bad-text">Groter dan de pallet: {(plan.te_groot ?? []).map((t) => `${t.l} × ${t.w} (${t.material})`).join(', ')}. Apart of bovenop vastmaken.</p>}
      {(plan.warnings ?? []).map((w, i) => <p key={i} className="small bad-text">Let op: {w}</p>)}
      {plan.instructie && <p className="small pallet-instr">{plan.instructie}</p>}
    </div>
  )
}
