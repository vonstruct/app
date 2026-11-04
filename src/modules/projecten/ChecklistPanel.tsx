import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'

/**
 * Checklist van het project als bord: één kolom per fase (Aanvraag → Plaatsing), alle fases altijd zichtbaar.
 * Standaardpunten in checklist_template (Rekenregels → Checklist); punten met een auto_rule vinken vanzelf af
 * uit de gegevens (view app_project_checklist: vragenlijst, ontwerp, kosten, offerte, voorschot, bestellingen, opdrachten, PV, werkpunten, eindfactuur, review,
 * productie klaar / opgehaald via een opdracht Productie / Ophaling).
 * N.v.t.: een punt van een fase die al voorbij is en niet gedaan werd, is vanzelf "n.v.t." (doorstreept, telt niet mee);
 * een open punt kan je ook zelf op n.v.t. zetten (project_checklist.na). Alles van de huidige fase klaar = automatisch naar de volgende fase.
 */
type Item = { project_code: string; stage: string; stage_label: string; stage_sort: number; sort: number; template_id: number; label: string; automatic: boolean; done: boolean; done_at: string | null; done_by: string | null; na: boolean; skipped: boolean }
const day = (v: string) => new Date(v).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
type Ord = { id: string; supplier: string; status: string; categories: string[] | null; manual: boolean | null; note: string | null; reference: string | null; ordered_at: string | null; shipped_at: string | null; expected_at: string | null; delivered_at: string | null; pickup: boolean; auto_vervallen: boolean | null }
type Job = { id: string; title: string; job_type: string | null; start_at: string; status: string; for_me: boolean; subcontractors: { name: string } | null; partners: { name: string } | null }
/** Wat is het: rubrieken uit de kosten, anders afgeleid uit de omschrijving (bestellingen uit de mailbox). */
function what(o: Ord) {
  if (o.categories?.length) return o.categories.map((c) => c.replace('Verbinders & Beslagen', 'beslag').toLowerCase()).join(', ')
  const t = (o.note ?? '').toLowerCase()
  if (/werkblad|corian|composiet|keramisch blad|graniet|dekton|silestone/.test(t)) return 'werkblad'
  if (/oven|vaatwas|koelkast|kookplaat|afzuig|dampkap|magnetron|siemens|bosch|aeg|miele|neff|quooker|bora/.test(t)) return 'toestellen'
  if (/lade|legrabox|antaro|movento|tandembox/.test(t)) return 'lades'
  if (/radiator/.test(t)) return 'radiatoren'
  if (/tegel/.test(t)) return 'tegels'
  return o.note ? o.note.replace(/^Uit mail:\s*/, '').slice(0, 40) : ''
}

export function ChecklistPanel({ code, currentStage }: { code: string; currentStage?: string | null }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('app_project_checklist').select('*').eq('project_code', code).order('stage_sort').order('sort')
    setItems((data as Item[]) ?? [])
  }, [code])
  useEffect(() => { load() }, [load])
  // leveringen (bestellingen van het project) en opdrachten: volgen uit wat er echt besteld en ingepland is
  const [orders, setOrders] = useState<Ord[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const loadMore = useCallback(async () => {
    const [o, j] = await Promise.all([
      supabase.from('app_orders').select('id,supplier,status,categories,manual,note,reference,ordered_at,shipped_at,expected_at,delivered_at,pickup,auto_vervallen').eq('project_code', code).neq('status', 'geannuleerd').order('supplier'),
      supabase.from('jobs').select('id,title,job_type,start_at,status,for_me,subcontractors(name),partners(name)').eq('project_code', code).neq('status', 'geannuleerd').order('start_at'),
    ])
    setOrders(((o.data as Ord[]) ?? []).filter((x) => !x.auto_vervallen)); setJobs((j.data as unknown as Job[]) ?? [])
  }, [code])
  useEffect(() => { loadMore() }, [loadMore])
  const received = async (o: Ord, pickup: boolean) => {
    const today = new Date().toLocaleDateString('sv-SE')
    const { error } = await supabase.from('orders').update({ status: 'geleverd', delivered_at: o.delivered_at ?? today, pickup, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) toast(error.message, 'err'); else { toast(pickup ? 'Opgehaald' : 'Geleverd'); loadMore(); load() }
  }
  const undoReceived = async (o: Ord) => {
    const { error } = await supabase.from('orders').update({ status: 'bevestigd', delivered_at: null, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) toast(error.message, 'err'); else { loadMore(); load() }
  }

  const toggle = async (it: Item) => {
    if (it.done && it.done_by === 'automatisch') return
    if (it.done) await supabase.from('project_checklist').delete().eq('project_code', code).eq('template_id', it.template_id)
    else await supabase.from('project_checklist').upsert({ project_code: code, template_id: it.template_id, done_at: new Date().toISOString(), na: false })
    load()
  }
  // zelf "niet van toepassing" zetten of terug openen
  const setNa = async (it: Item, na: boolean) => {
    if (na) await supabase.from('project_checklist').upsert({ project_code: code, template_id: it.template_id, done_at: null, na: true })
    else await supabase.from('project_checklist').delete().eq('project_code', code).eq('template_id', it.template_id)
    load()
  }
  if (!items) return null
  const stages = [...new Map(items.map((i) => [i.stage, { stage: i.stage, label: i.stage_label, sort: i.stage_sort }])).values()].sort((a, b) => a.sort - b.sort)
  const curSort = stages.find((s) => s.stage === currentStage)?.sort ?? stages[0]?.sort ?? 0
  const counted = items.filter((i) => !i.skipped)
  const done = counted.filter((i) => i.done).length

  return (
    <div className="panel checklist">
      <div className="tasks-head">
        <h2>Checklist</h2>
        <span className="muted small">{done}/{counted.length} gedaan · ⚙ = vinkt vanzelf af · doorstreept = niet van toepassing</span>
      </div>
      <div className="cl-board" style={{ '--cl-n': stages.length } as React.CSSProperties}>
        {stages.map((s) => {
          const its = items.filter((i) => i.stage === s.stage)
          const cnt = its.filter((i) => !i.skipped)
          const n = cnt.filter((i) => i.done).length
          const cls = s.sort < curSort ? 'past' : s.sort === curSort ? 'now' : 'next'
          const open = s.sort < curSort ? cnt.filter((i) => !i.done).length : 0
          return (
            <section key={s.stage} className={'cl-col ' + cls + (n === cnt.length ? ' full' : '')}>
              <header>
                <b>{s.label}</b>
                {s.sort === curSort && <span className="cl-now">nu</span>}
                <span className="cl-count">{n}/{cnt.length}</span>
              </header>
              <div className="cl-bar"><span style={{ width: (cnt.length ? (n / cnt.length) * 100 : 100) + '%' }} /></div>
              {open > 0 && <div className="cl-warn">{open} nog open</div>}
              <ul>
                {its.map((i) => (
                  <li key={i.template_id} className={i.done ? 'done' : i.skipped ? 'na' : ''}>
                    <label title={i.skipped ? (i.na ? 'Door jou op niet van toepassing gezet' : 'Niet gedaan in een fase die al voorbij is: niet van toepassing') : undefined}>
                      <input type="checkbox" checked={i.done} disabled={(i.done && i.done_by === 'automatisch') || (i.skipped && !i.na)} onChange={() => toggle(i)} />
                      <span>{i.label}</span>
                    </label>
                    <small className="muted">
                      {i.done ? `${i.done_by === 'automatisch' ? '⚙' : '✓'} ${day(i.done_at!)}`
                        : i.na ? <button className="link small" onClick={() => setNa(i, false)} title="Terug openen">n.v.t. ↺</button>
                        : i.skipped ? 'n.v.t.'
                        : <>{i.automatic ? '⚙ ' : ''}<button className="link small cl-na" onClick={() => setNa(i, true)} title="Niet van toepassing voor dit project">n.v.t.</button></>}
                    </small>
                  </li>
                ))}
              </ul>
              {s.stage === 'production' && orders.length > 0 && (
                <div className="cl-sub">
                  <div className="cl-sub-h">Leveringen <Link to={`/projecten/${code}?tab=bestellingen`} className="small">bestellingen ›</Link></div>
                  <ul>
                    {orders.map((o) => {
                      const ok = o.status === 'geleverd'
                      const state = ok ? `${o.pickup ? 'opgehaald' : 'geleverd'}${o.delivered_at ? ' ' + day(o.delivered_at) : ''}`
                        : o.status === 'te bestellen' ? 'nog te bestellen'
                        : o.shipped_at ? `verzonden ${day(o.shipped_at)}${o.expected_at ? ' · verwacht ' + day(o.expected_at) : ''}`
                        : o.expected_at ? `${o.pickup ? 'afhalen' : 'verwacht'} ${day(o.expected_at)}`
                        : o.status
                      return (
                        <li key={o.id} className={ok ? 'done' : ''}>
                          <span className="cl-o"><b>{o.supplier}</b>{what(o) ? <span className="muted"> · {what(o)}</span> : null}</span>
                          <small className={'cl-o-st' + (ok ? ' ok' : o.status === 'te bestellen' ? ' warn' : '')}>
                            {ok ? <button className="link small" title="Terug op niet geleverd" onClick={() => undoReceived(o)}>✓ {state}</button>
                              : <>{state}{o.status !== 'te bestellen' && <> · <button className="link small" onClick={() => received(o, false)}>geleverd</button> / <button className="link small" onClick={() => received(o, true)}>opgehaald</button></>}</>}
                          </small>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {s.stage === 'installation' && (
                <div className="cl-sub">
                  <div className="cl-sub-h">Opdrachten <Link to={`/projecten/${code}?tab=planning&nieuw=opdracht`} className="small">+ opdracht</Link></div>
                  {jobs.length ? (
                    <ul>
                      {jobs.map((j) => (
                        <li key={j.id} className={j.status === 'klaar' ? 'done' : ''}>
                          <Link to={`/opdrachten?focus=${j.id}`} className="cl-o"><b>{j.title}</b><span className="muted"> · {j.for_me ? 'jij' : j.subcontractors?.name ?? j.partners?.name ?? ''}</span></Link>
                          <small className={'cl-o-st' + (j.status === 'klaar' ? ' ok' : '')}>{j.status === 'klaar' ? '✓ klaar' : `${day(j.start_at)} · ${j.status === 'bevestigd' ? 'bevestigd' : j.status === 'gepland' ? 'te bevestigen' : j.status}`}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="muted small" style={{ margin: 0 }}>Nog geen opdrachten (plaatsing, werkblad plaatsen, elektricien …).</p>}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
