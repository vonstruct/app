import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox } from '../../core/ui'
import { toast } from '../../core/toast'
import { PartnerOrderView, palletName, type PartnerOrder } from '../../core/PartnerOrderView'

/**
 * Blok "Bestelling en ophaling bij de partner" bovenaan de tab Productie (tabel partner_orders, view app_partner_orders).
 * Platen + kantenband (bestellingen "besteld door" de partner) doorgeven met de ophaaldatum: vanzelf bij een betaald voorschot
 * (trigger op invoices) of hier met de hand (Edge Function productie, actie order_send; testmodus = enkel naar info@).
 * De partner duidt in het portaal aan: besteld + verwacht op / binnen, ophalen lukt of niet, productie klaar. Palletvoorstel = pallet_plan().
 */
type Row = {
  id: string | null; partner_id: string; partner: string; status: string; sent_at: string | null; sent_how: string | null; sent_count: number | null
  pickup_date: string | null; pickup_default: boolean; pickup_slot: string | null; pickup_answer: string | null; pickup_note: string | null
  ready_at: string | null; ready_pallets: number | null; picked_up_at: string | null; pallet_type: string | null; pallet_count: number | null; note: string | null
  lead_days: number | null; prod_days: number; needed_by: string | null; send_by: string | null; n_open: number; n_ordered: number; n_in: number; late: boolean
}
const day = (d: string | null, long = false) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('nl-BE', long ? { weekday: 'short', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' }) : '—')

export function PartnerOrderPanel({ project, test }: { project: string; test: boolean }) {
  const q = useQuery<Row[]>(() => supabase.from('app_partner_orders').select('*').eq('project_code', project), [project])
  const r = q.data?.[0] ?? null
  const j = useQuery<PartnerOrder | null>(async () => {
    if (!r?.id) return { data: null, error: null }
    const { data, error } = await supabase.rpc('partner_order_json', { p_id: r.id })
    return { data: data as PartnerOrder | null, error }
  }, [r?.id, r?.status, r?.pickup_date, r?.pallet_type, r?.pallet_count, r?.sent_count])
  const [busy, setBusy] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const reload = () => { q.reload(); j.reload() }
  if (!r) return null

  const ensure = async () => {
    const { data, error } = await supabase.rpc('partner_order_ensure', { p_code: project })
    if (error) { toast(error.message, 'err'); return null }
    return data as string
  }
  const save = async (patch: Record<string, unknown>) => {
    const id = r.id ?? (await ensure())
    if (!id) return
    const { error } = await supabase.from('partner_orders').update(patch).eq('id', id)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); reload() }
  }
  const send = async () => {
    const again = r.status === 'doorgegeven'
    if (!confirm(test ? `Testmodus: de mail gaat enkel naar info@ (niets naar ${r.partner}). Doorgaan?` : `Platen en kantenband ${again ? 'opnieuw ' : ''}doorgeven aan ${r.partner}${r.pickup_date ? `, ophalen ${day(r.pickup_date, true)}` : ''}?`)) return
    setBusy('send')
    const id = r.id ?? (await ensure())
    if (!id) return setBusy(null)
    if (!r.id && r.pickup_date) await supabase.from('partner_orders').update({ pickup_date: r.pickup_date }).eq('id', id)
    const { data, error } = await supabase.functions.invoke('productie', { body: { action: 'order_send', id, how: 'hand' } })
    setBusy(null)
    const msg = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (msg) return toast(msg, 'err')
    toast(test ? 'Test: mail naar info@ gestuurd' : `Doorgegeven aan ${r.partner}`); reload()
  }
  const sent = r.status === 'doorgegeven'
  const palletSel = r.pallet_count === 1 && !r.pallet_type ? 'een' : r.pallet_type ?? 'auto'
  const plan = j.data?.pallets

  return (
    <section className="panel po-panel">
      <ErrorBox error={q.error ?? j.error} />
      <header className="prodpkg-head">
        <div><b>Bestelling en ophaling bij {r.partner}</b>{' '}
          <span className={'pill ' + (sent ? 'ok' : 'warn')}>{sent ? `doorgegeven ${day(r.sent_at)}${r.sent_how === 'voorschot' ? ' (voorschot betaald)' : ''}` : 'nog niet doorgegeven'}</span>
          {r.picked_up_at && <span className="pill ok">opgehaald {day(r.picked_up_at)}</span>}
          <div className="small muted">
            ophalen {r.pickup_date ? day(r.pickup_date, true) : '—'}{r.pickup_default && r.pickup_date ? ' (voorstel: dag vóór de plaatsing)' : ''}
            {r.needed_by && <> · platen nodig bij {r.partner} tegen {day(r.needed_by)} ({r.prod_days} d productie)</>}
            {!sent && r.send_by && <> · <b className={r.send_by < new Date().toISOString().slice(0, 10) ? 'bad-text' : ''}>ten laatste doorgeven {day(r.send_by)}</b> (levertijd {r.lead_days ?? 0} d)</>}
          </div>
        </div>
        <div className="toolbar">
          <button className="primary" disabled={busy === 'send'} onClick={send}>{busy === 'send' ? 'Bezig…' : sent ? 'Opnieuw doorgeven' : `Platen doorgeven aan ${r.partner}`}</button>
          {sent && !r.picked_up_at && <button onClick={() => confirm('Alles opgehaald bij ' + r.partner + '?') && save({ picked_up_at: new Date().toISOString() })}>Opgehaald</button>}
        </div>
      </header>
      {!sent && <p className="small muted">Gaat vanzelf naar {r.partner} zodra het voorschot betaald is{test ? ' (testmodus: enkel naar info@)' : ''}. Of geef het nu door met de knop.</p>}

      <div className="po-edit">
        <label>Ophaaldatum <input type="date" key={'d' + (r.pickup_date ?? '')} defaultValue={r.pickup_date ?? ''} onBlur={(e) => e.target.value !== (r.pickup_date ?? '') && save({ pickup_date: e.target.value || null })} /></label>
        <label>Dagdeel
          <select value={r.pickup_slot ?? ''} onChange={(e) => save({ pickup_slot: e.target.value || null, pickup_date: r.pickup_date })}>
            <option value="">—</option><option value="voormiddag">voormiddag</option><option value="namiddag">namiddag</option><option value="dag">hele dag</option>
          </select>
        </label>
        <label>Paletten
          <select value={palletSel} onChange={(e) => {
            const v = e.target.value
            save(v === 'auto' ? { pallet_type: null, pallet_count: null } : v === 'een' ? { pallet_type: null, pallet_count: 1 } : { pallet_type: v, pallet_count: null })
          }}>
            <option value="auto">automatisch (zo weinig mogelijk)</option><option value="een">alles op 1 hoge pallet</option>
            <option value="euro">europallets</option><option value="groot">grote pallets</option>
          </select>
        </label>
        <label className="wide">Opmerking bij de bestelling
          <input key={'n' + r.id} defaultValue={r.note ?? ''} placeholder="bv. platen apart houden, levering bellen…" onBlur={(e) => e.target.value !== (r.note ?? '') && save({ note: e.target.value || null })} />
        </label>
      </div>
      {sent && r.pickup_date && <p className="small muted">Pas je de ophaaldatum aan, dan ziet {r.partner} dat meteen in het portaal en moet hij opnieuw bevestigen. Met "Opnieuw doorgeven" krijgt hij ook een mail.</p>}

      {sent && (
        <div className="po-status small">
          <span className={r.n_open ? 'bad-text' : ''}>{r.n_open} nog te bestellen</span> · {r.n_ordered} besteld · {r.n_in} binnen
          {r.late && <b className="bad-text"> · komt te laat binnen</b>}
          {' · '}ophalen: {r.pickup_answer === 'ok' ? '✓ lukt' : r.pickup_answer === 'probleem' ? <b className="bad-text">lukt niet ({r.pickup_note ?? '—'})</b> : 'nog niet bevestigd'}
          {r.ready_at && <> · ✓ klaar {day(r.ready_at)}{r.ready_pallets ? ` (${r.ready_pallets} pallets)` : ''}</>}
        </div>
      )}
      {plan && plan.count > 0 && (
        <p className="small">Palletvoorstel: <b>{plan.count} {palletName(plan.type, plan.count)}</b> ({plan.size} mm) · ± {plan.total_kg} kg · stapel ± {Math.round(plan.total_hoogte_mm / 10 / plan.count)} cm{plan.count > 1 ? ' per pallet, zwaarste vooraan' : ''}</p>
      )}
      {j.data && (
        <>
          <button className="link small" onClick={() => setShow(!show)}>{show ? 'Verbergen' : `Zo ziet ${r.partner} het`}</button>
          {show && <div className="po-preview"><PartnerOrderView o={j.data} act={false} /></div>}
        </>
      )}
    </section>
  )
}
