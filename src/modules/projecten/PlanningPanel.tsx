import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import type { ProjectRow } from '../../core/projects'
import { RouteLinks } from '../../core/address'
import { JobEditor, JOB_STATUS, SLOTS, type Job, type JobDraft } from '../agenda/JobEditor'
import { NewEvent, codeIn, keyOf, type AgendaEv } from '../agenda/Agenda'

type JobRow = Job & { subcontractors: { name: string; trade: string | null } | null; partners: { name: string } | null }
type Item = {
  key: string
  kind: 'afspraak' | 'opdracht' | 'mijlpaal'
  start: string
  end: string
  title: string
  sub?: string
  location?: string | null
  slot?: string | null
  job?: JobRow
  ev?: AgendaEv
}
type Log = { job_id: string; at: string; actor: string | null; what: string }

const day = (iso: string) => new Date(iso).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
const hm = (iso: string) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
const ymd = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Alles wat gepland is voor één project: afspraken uit de agenda (Outlook/Bookings, gekoppeld via projectcode in de titel,
 * het gekozen project of de Bookings-aanvraag), opdrachten met hun bevestigingen, mijlpalen en de laatste activiteit.
 */
export function PlanningPanel({ project }: { project: ProjectRow }) {
  const code = project.project_code
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [events, setEvents] = useState<AgendaEv[] | null>(null)
  const [evErr, setEvErr] = useState<string | null>(null)
  const [log, setLog] = useState<Log[]>([])
  const [past, setPast] = useState(false)
  const [open, setOpen] = useState<JobDraft | null>(null)
  const [newEv, setNewEv] = useState(false)

  const loadJobs = useCallback(async () => {
    const { data } = await supabase.from('jobs').select('*, subcontractors(name,trade), partners(name)').eq('project_code', code).order('start_at')
    const rows = (data as JobRow[]) ?? []
    setJobs(rows)
    if (rows.length) {
      const { data: l } = await supabase.from('job_log').select('job_id,at,actor,what').in('job_id', rows.map((r) => r.id)).order('at', { ascending: false }).limit(12)
      setLog((l as Log[]) ?? [])
    } else setLog([])
  }, [code])

  const loadEvents = useCallback(async () => {
    const from = new Date(Date.now() - 90 * 86400000), to = new Date(Date.now() + 240 * 86400000)
    const [ag, nt] = await Promise.all([
      supabase.functions.invoke('agenda', { body: { action: 'list', from: from.toISOString(), to: to.toISOString() } }),
      supabase.from('agenda_notes').select('event_key,project_code').not('project_code', 'is', null),
    ])
    const linked = new Map(((nt.data ?? []) as { event_key: string; project_code: string }[]).map((n) => [n.event_key, n.project_code]))
    const e = ag.error ? 'De agenda kon niet geladen worden.' : (ag.data as { error?: string })?.error
    if (e) { setEvErr(e); setEvents([]); return }
    const list = ((ag.data as { events: AgendaEv[] }).events ?? []).filter((x) => (linked.get(keyOf(x)) ?? x.project_code ?? codeIn(x.title)) === code)
    setEvents(list)
  }, [code])

  useEffect(() => { loadJobs(); loadEvents() }, [loadJobs, loadEvents])
  // ?nieuw=opdracht|afspraak (knoppen bovenaan de projectpagina): meteen het formulier openen
  const [params, setParams] = useSearchParams()
  const nieuw = params.get('nieuw')
  useEffect(() => {
    if (!nieuw) return
    if (nieuw === 'opdracht') setOpen(newJob())
    if (nieuw === 'afspraak') setNewEv(true)
    const next = new URLSearchParams(params); next.delete('nieuw'); setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nieuw])

  const items = useMemo(() => {
    const out: Item[] = []
    for (const j of jobs ?? []) {
      if (j.status === 'geannuleerd') continue
      const who = j.for_me ? 'Vonstruct (jij)' : j.subcontractors ? `${j.subcontractors.name}${j.subcontractors.trade ? ` · ${j.subcontractors.trade}` : ''}` : j.partners?.name ?? '—'
      out.push({ key: 'j' + j.id, kind: 'opdracht', start: j.start_at, end: j.end_at, title: j.title, sub: who, location: j.address, slot: j.slot, job: j })
    }
    const mirror = new Set((jobs ?? []).map((j) => j.outlook_event_id).filter(Boolean))
    for (const e of (events ?? []).filter((x) => !(x.outlook_id && mirror.has(x.outlook_id)))) out.push({ key: 'e' + e.id, kind: 'afspraak', start: e.start, end: e.end, title: e.title, sub: e.customer?.name ?? (e.source === 'bookings' ? 'Bookings' : 'Outlook'), location: e.location, ev: e })
    const hasIntro = (events ?? []).some((e) => e.source === 'bookings')
    if (project.intro_at && !hasIntro) out.push({ key: 'intro', kind: 'mijlpaal', start: project.intro_at, end: project.intro_at, title: 'Kennismaking' })
    if (project.target_install_week) out.push({ key: 'week', kind: 'mijlpaal', start: '', end: '', title: `Plaatsing gepland in week ${project.target_install_week}` })
    return out.sort((a, b) => (a.start || '9').localeCompare(b.start || '9'))
  }, [jobs, events, project.intro_at, project.target_install_week])

  const now = Date.now()
  const upcoming = items.filter((i) => !i.end || new Date(i.end).getTime() >= now - 3600000)
  const done = items.filter((i) => i.end && new Date(i.end).getTime() < now - 3600000).reverse()
  const shown = past ? done : upcoming
  const pending = (jobs ?? []).filter((j) => j.status === 'gepland' && new Date(j.end_at).getTime() > now)
  const address = [project.site_street, [project.site_postal_code, project.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const newJob = (): JobDraft => ({ project_code: code, address: address || null, contact_name: project.client_name ?? null, contact_phone: (project as ProjectRow & { client_phone?: string | null }).client_phone ?? null })
  const jobName = (id: string) => (jobs ?? []).find((j) => j.id === id)?.title ?? 'opdracht'

  return (
    <div className="panel planning-panel">
      <div className="planning-head">
        <h2>Afspraken en opdrachten</h2>
        <div className="toolbar">
          <button onClick={() => setOpen(newJob())}>+ Opdracht</button>
          <button onClick={() => setNewEv(true)}>+ Afspraak</button>
          <Link to="/agenda">Agenda →</Link>
        </div>
      </div>
      {pending.length > 0 && <p className="notice">{pending.length} opdracht{pending.length > 1 ? 'en wachten' : ' wacht'} op bevestiging{pending.some((j) => j.changed_by && j.changed_by !== 'vonstruct') ? ' (moment gewijzigd door onderaannemer of klant)' : ''}.</p>}
      {evErr && <p className="muted small">{evErr}</p>}
      <div className="seg planning-tabs">
        <button className={!past ? 'on' : ''} onClick={() => setPast(false)}>Komend ({upcoming.length})</button>
        <button className={past ? 'on' : ''} onClick={() => setPast(true)}>Voorbij ({done.length})</button>
      </div>
      {jobs === null || events === null ? <p className="muted small">Laden…</p> : shown.length === 0 ? (
        <p className="muted">{past ? 'Nog niets voorbij.' : 'Nog niets gepland voor dit project. Maak een opdracht of afspraak, of zet de projectcode in de titel van een afspraak in Outlook.'}</p>
      ) : (
        <ol className="planning-list">
          {shown.map((i) => {
            const j = i.job
            const when = !i.start ? '' : j?.slot ? (ymd(i.start) === ymd(i.end) ? `${day(i.start)} · ${SLOTS[j.slot].label}` : `${day(i.start)} – ${day(i.end)}`) : i.kind === 'mijlpaal' ? `${day(i.start)} · ${hm(i.start)}` : `${day(i.start)} · ${hm(i.start)}–${hm(i.end)}`
            const loop = j && j.notify_client && j.show_client
            const body = (
              <>
                <span className="planning-when">{when || '—'}</span>
                <span className="planning-main">
                  <span className={'planning-kind k-' + i.kind}>{i.kind === 'opdracht' ? 'Opdracht' : i.kind === 'afspraak' ? 'Afspraak' : 'Mijlpaal'}</span>
                  <strong>{i.title}</strong>
                  {i.sub && <span className="muted small">{i.sub}{j?.job_type ? ` · ${j.job_type}` : ''}</span>}
                  {i.location && <span className="muted small">📍 {i.location}</span>}
                  {j && j.changed_by && j.changed_by !== 'vonstruct' && j.status === 'gepland' && <span className="small jobs-prop">⇄ Moment gewijzigd door {j.changed_by === 'klant' ? 'de klant' : 'de onderaannemer'}{j.change_note ? ` – “${j.change_note}”` : ''}</span>}
                  {j?.sub_note && <span className="small">💬 {j.sub_note}</span>}
                </span>
                {j && (
                  <span className="planning-side">
                    <span className={'job-st ' + j.status}>{j.status === 'bevestigd' ? '✓ ' : j.status === 'gepland' ? '? ' : ''}{JOB_STATUS[j.status]}</span>
                    {!j.for_me && <span className="small">{j.subcontractors?.name ?? j.partners?.name}: {j.confirmed_at ? <b className="ok-t">✓</b> : <b className="wait-t">?</b>}</span>}
                    {loop && <span className="small">Klant: {j.client_confirmed_at ? <b className="ok-t">✓</b> : <b className="wait-t">?</b>}</span>}
                  </span>
                )}
              </>
            )
            return (
              <li key={i.key} className={'planning-item k-' + i.kind + (j ? ' st-' + j.status : '')}>
                {j ? <button className="planning-row" onClick={() => setOpen(j)}>{body}</button>
                  : i.ev ? <Link className="planning-row" to={`/agenda?d=${ymd(i.start)}&e=${encodeURIComponent(i.ev.id)}`}>{body}</Link>
                  : <div className="planning-row">{body}</div>}
                {i.location && <span className="planning-route"><RouteLinks address={i.location} /></span>}
              </li>
            )
          })}
        </ol>
      )}
      {log.length > 0 && (
        <details className="job-log planning-log">
          <summary>Laatste activiteit bij opdrachten ({log.length})</summary>
          <ul>{log.map((l, k) => <li key={k}><span className="muted small">{new Date(l.at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {l.actor === 'info@vonstruct.com' ? 'jij' : l.actor ?? '—'}</span> {jobName(l.job_id)}: {l.what}</li>)}</ul>
        </details>
      )}
      {open && <JobEditor draft={open} onClose={() => setOpen(null)} onSaved={loadJobs} />}
      {newEv && (
        <NewEvent day={new Date()} project={code}
          projects={[{ project_code: code, title: project.title, client_name: project.client_name, intro_at: project.intro_at, target_install_week: project.target_install_week, phase: project.phase }]}
          onClose={() => setNewEv(false)} onCreated={() => { setNewEv(false); loadEvents() }} />
      )}
    </div>
  )
}
