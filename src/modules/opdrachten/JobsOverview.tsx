import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { RouteLinks } from '../../core/address'
import { JOB_STATUS, JobEditor, SLOTS, when, type Job } from '../agenda/JobEditor'

type Row = Job & { subcontractors: { name: string; trade: string | null } | null; partners: { name: string } | null }
type Filter = 'open' | 'tebevestigen' | 'voorstel' | 'bevestigd' | 'klaar' | 'alles'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Lopend' },
  { id: 'tebevestigen', label: 'Te bevestigen' },
  { id: 'voorstel', label: 'Voorstel' },
  { id: 'bevestigd', label: 'Bevestigd' },
  { id: 'klaar', label: 'Klaar' },
  { id: 'alles', label: 'Alles' },
]

/** Overzicht van alle opdrachten voor onderaannemers, partners en mezelf, met hun status. */
export function JobsOverview() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [who, setWho] = useState('')
  const [open, setOpen] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const load = useCallback(async () => {
    const { data } = await supabase.from('jobs').select('*, subcontractors(name,trade), partners(name)').order('start_at')
    setRows((data as Row[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const f = params.get('focus')
    if (f && rows) { const r = rows.find((x) => x.id === f); if (r) setOpen(r) }
  }, [params, rows])

  const name = (r: Row) => (r.for_me ? 'Mezelf' : r.subcontractors?.name ?? r.partners?.name ?? '—')
  const people = useMemo(() => [...new Set((rows ?? []).map(name))].sort(), [rows])
  const now = Date.now()
  const list = (rows ?? []).filter((r) => {
    if (who && name(r) !== who) return false
    switch (filter) {
      case 'open': return !['klaar', 'geannuleerd'].includes(r.status) && new Date(r.end_at).getTime() > now - 86400000 * 7
      case 'tebevestigen': return r.status === 'gepland' && !r.for_me
      case 'voorstel': return r.status === 'voorstel'
      case 'bevestigd': return r.status === 'bevestigd' || r.status === 'bezig'
      case 'klaar': return r.status === 'klaar'
      default: return true
    }
  })
  const count = (f: Filter) => (rows ?? []).filter((r) => (f === 'tebevestigen' ? r.status === 'gepland' && !r.for_me : f === 'voorstel' ? r.status === 'voorstel' : false)).length
  const close = () => { setOpen(null); if (params.get('focus')) { params.delete('focus'); setParams(params, { replace: true }) } }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Opdrachten</h1>
          <p className="muted">Wat je onderaannemers en partners in hun portaal zien, en wat ze al bevestigd hebben.</p>
        </div>
        <div className="toolbar">
          <Link to="/agenda">Naar de agenda</Link>
          <button className="primary" onClick={() => setCreating(true)}>+ Opdracht</button>
        </div>
      </div>
      <div className="toolbar jobs-filters">
        <div className="seg">
          {FILTERS.map((f) => {
            const n = count(f.id)
            return <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}{n ? <span className="badge">{n}</span> : null}</button>
          })}
        </div>
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Iedereen</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {rows === null ? <p className="muted">Laden…</p> : list.length === 0 ? <p className="muted">Geen opdrachten in deze selectie.</p> : (
        <div className="jobs-list">
          {list.map((r) => (
            <button key={r.id} className={'jobs-row st-' + r.status} onClick={() => setOpen(r)}>
              <span className="jobs-when">
                <strong>{new Date(r.start_at).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                <span className="muted small">{r.slot ? SLOTS[r.slot].label : `${new Date(r.start_at).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}–${new Date(r.end_at).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`}</span>
              </span>
              <span className="jobs-main">
                <strong>{r.title}</strong>
                <span className="muted small">{name(r)}{r.subcontractors?.trade ? ` · ${r.subcontractors.trade}` : ''}{r.project_code ? ` · project ${r.project_code}` : ''}{r.job_type ? ` · ${r.job_type}` : ''}</span>
                {r.address && <span className="muted small">📍 {r.address} <span onClick={(e) => e.stopPropagation()}><RouteLinks address={r.address} /></span></span>}
                {r.status === 'voorstel' && r.proposed_start && <span className="jobs-prop">⇄ Voorstel: {when(r.proposed_start, r.proposed_end!, r.proposed_slot)}{r.proposal_note ? ` – “${r.proposal_note}”` : ''}</span>}
                {r.sub_note && <span className="jobs-note">💬 {r.sub_note}</span>}
              </span>
              <span className="jobs-side">
                <span className={'job-st ' + r.status}>{r.status === 'bevestigd' ? '✓ ' : r.status === 'gepland' ? '? ' : ''}{JOB_STATUS[r.status]}</span>
                {!r.for_me && <span className="small">{name(r)}: {r.confirmed_at ? <b className="ok-t">✓</b> : <b className="wait-t">?</b>}</span>}
                {r.notify_client && r.show_client && r.project_code && <span className="small">Klant: {r.client_confirmed_at ? <b className="ok-t">✓</b> : <b className="wait-t">?</b>}</span>}
                {r.changed_by && r.changed_by !== 'vonstruct' && r.status === 'gepland' && <span className="small jobs-prop">⇄ gewijzigd door {r.changed_by === 'klant' ? 'klant' : name(r)}</span>}
                {r.show_client && r.project_code && <span className="muted small">👁 klant ziet dit</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && <JobEditor draft={open} onClose={close} onSaved={load} />}
      {creating && <JobEditor draft={{}} onClose={() => setCreating(false)} onSaved={load} />}
    </div>
  )
}
