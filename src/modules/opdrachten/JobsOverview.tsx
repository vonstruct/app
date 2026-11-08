import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { JobEditor, SLOTS, type Job } from '../agenda/JobEditor'

/**
 * Overzicht van alle opdrachten (werk door onderaannemers, partners of jezelf). Compact: per opdracht
 * wanneer · wat + project · wie · status. Details (adres, instructies, bestanden) in de opdrachtfiche.
 */
type Row = Job & { subcontractors: { name: string; trade: string | null } | null; partners: { name: string } | null }
type Filter = 'regelen' | 'gepland' | 'afgewerkt'

const name = (r: Row) => (r.for_me ? 'Ikzelf' : r.subcontractors?.name ?? r.partners?.name ?? '—')
const needsAction = (r: Row) => !['klaar', 'geannuleerd'].includes(r.status) && (r.status === 'voorstel' || (r.status === 'gepland' && !r.for_me) || (!!r.changed_by && r.changed_by !== 'vonstruct' && r.status === 'gepland'))
const ymd = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
const dayLabel = (iso: string) => {
  const d = ymd(new Date(iso)), t = ymd(new Date()), tm = ymd(new Date(Date.now() + 864e5))
  if (d === t) return 'Vandaag'
  if (d === tm) return 'Morgen'
  const dt = new Date(iso)
  return dt.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', ...(dt.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}
const timeLabel = (r: Row) => {
  const s = new Date(r.start_at), e = new Date(r.end_at)
  if (r.slot === 'dag' && ymd(s) !== ymd(e)) return `t.e.m. ${e.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })}`
  if (r.slot) return SLOTS[r.slot].label
  return `${s.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}–${e.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
}

function Status({ r }: { r: Row }) {
  if (r.status === 'geannuleerd') return <span className="jo-pill muted">Geschrapt</span>
  if (r.status === 'klaar') return <span className="jo-pill ok">✓ Klaar</span>
  if (r.status === 'bezig') return <span className="jo-pill ok">Bezig</span>
  if (r.status === 'voorstel') return <span className="jo-pill warn">⇄ Ander moment voorgesteld</span>
  const loop = r.notify_client && r.show_client && r.project_code
  return (
    <span className="jo-checks">
      {!r.for_me && <span className={r.confirmed_at ? 'ok' : 'wait'} title={r.confirmed_at ? 'Bevestigd door ' + name(r) : 'Nog niet bevestigd door ' + name(r)}>👷 {r.confirmed_at ? '✓' : '?'}</span>}
      {loop && <span className={r.client_confirmed_at ? 'ok' : 'wait'} title={r.client_confirmed_at ? 'Bevestigd door de klant' : 'Klant moet nog bevestigen'}>🏠 {r.client_confirmed_at ? '✓' : '?'}</span>}
      {r.for_me && <span className="muted">eigen werk</span>}
    </span>
  )
}

export function JobsOverview() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState<Filter>('gepland')
  const [q, setQ] = useState(() => params.get('project') ?? '')
  const [showCancelled, setShowCancelled] = useState(false)
  const [open, setOpen] = useState<Row | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('jobs').select('*, subcontractors(name,trade), partners(name)').order('start_at')
    setRows((data as Row[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('nieuw-created', load); return () => window.removeEventListener('nieuw-created', load) }, [load])
  useEffect(() => {
    const f = params.get('focus')
    if (f && rows) { const r = rows.find((x) => x.id === f); if (r) setOpen(r) }
  }, [params, rows])
  useEffect(() => { if (rows && rows.some(needsAction)) setFilter((f) => (f === 'gepland' && !params.get('project') ? 'regelen' : f)) }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now()
  const counts = useMemo(() => ({
    regelen: (rows ?? []).filter(needsAction).length,
    gepland: (rows ?? []).filter((r) => !['klaar', 'geannuleerd'].includes(r.status) && new Date(r.end_at).getTime() > now - 864e5).length,
  }), [rows, now])
  const list = (rows ?? []).filter((r) => {
    const s = q.trim().toLowerCase()
    if (s && ![r.title, r.project_code, name(r), r.address, r.job_type].some((x) => String(x ?? '').toLowerCase().includes(s))) return false
    if (filter === 'regelen') return needsAction(r)
    if (filter === 'gepland') return !['klaar', 'geannuleerd'].includes(r.status) && new Date(r.end_at).getTime() > now - 864e5
    return r.status === 'klaar' || (showCancelled && r.status === 'geannuleerd') || (!['klaar', 'geannuleerd'].includes(r.status) && new Date(r.end_at).getTime() <= now - 864e5)
  })
  if (filter === 'afgewerkt') list.reverse()
  const groups: { label: string; rows: Row[] }[] = []
  for (const r of list) {
    const l = dayLabel(r.start_at)
    const g = groups.at(-1)
    if (g && g.label === l) g.rows.push(r); else groups.push({ label: l, rows: [r] })
  }
  const close = () => { setOpen(null); if (params.get('focus')) { params.delete('focus'); setParams(params, { replace: true }) } }

  return (
    <div className="jo">
      <div className="jo-bar">
        <div className="seg">
          <button className={filter === 'regelen' ? 'on' : ''} onClick={() => setFilter('regelen')}>Te regelen{counts.regelen ? <span className="badge">{counts.regelen}</span> : null}</button>
          <button className={filter === 'gepland' ? 'on' : ''} onClick={() => setFilter('gepland')}>Gepland <span className="muted small">{counts.gepland}</span></button>
          <button className={filter === 'afgewerkt' ? 'on' : ''} onClick={() => setFilter('afgewerkt')}>Afgewerkt</button>
        </div>
        <input className="jo-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op persoon, project, adres…" />
      </div>
      {filter === 'afgewerkt' && <label className="small muted jo-cancel"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> ook geschrapte tonen</label>}
      {filter === 'regelen' && counts.regelen > 0 && <p className="muted small">Opdrachten die nog niet bevestigd zijn of waarvoor een ander moment voorgesteld is.</p>}

      {rows === null ? <p className="muted">Laden…</p> : list.length === 0 ? (
        <div className="jo-empty">{filter === 'regelen' ? '✓ Alles is geregeld: geen opdrachten die op bevestiging wachten.' : q ? 'Niets gevonden.' : 'Geen opdrachten in deze selectie.'}</div>
      ) : groups.map((g) => (
        <section key={g.label} className={'panel vd-panel jo-day' + (g.label === 'Vandaag' ? ' today' : '')}>
          <div className="vd-h"><h2>{g.label}</h2><span className="vd-more">{g.rows.length}</span></div>
          {g.rows.map((r) => (
            <button key={r.id} className={'jo-row st-' + r.status + (needsAction(r) ? ' act' : '')} onClick={() => setOpen(r)}>
              <span className="jo-time">{timeLabel(r)}</span>
              <span className="jo-main">
                <span className="jo-title">{r.title}</span>
                <span className="jo-sub">
                  <b>{name(r)}</b>
                  {r.project_code && <> · <Link to={`/projecten/${encodeURIComponent(r.project_code)}`} onClick={(e) => e.stopPropagation()}>{r.project_code}</Link></>}
                  {r.job_type && <> · {r.job_type}</>}
                  {r.sub_note && <span title={r.sub_note}> · 💬</span>}
                </span>
              </span>
              <span className="jo-status"><Status r={r} /></span>
            </button>
          ))}
        </section>
      ))}
      {open && <JobEditor draft={open} onClose={close} onSaved={load} />}
    </div>
  )
}
