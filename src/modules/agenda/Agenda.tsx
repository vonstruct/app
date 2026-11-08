import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { RouteLinks } from '../../core/address'
import { JOB_STATUS, SLOTS, JobEditor, type Job, type JobDraft } from './JobEditor'
import { DateTimeInput } from '../../core/DateInput'

/** Item in de agenda: Outlook (info@vonstruct.com), Bookings (klantafspraken) of planning uit de projecten. */
type Ev = {
  id: string
  source: 'outlook' | 'bookings' | 'planning' | 'job'
  job?: Job
  bookings_id?: string
  business_id?: string
  outlook_id?: string
  title: string
  start: string
  end: string
  all_day: boolean
  location?: string | null
  notes?: string | null
  customer?: { name?: string; email?: string; phone?: string } | null
  online_url?: string | null
  organizer_is_me?: boolean
  attendees?: number
  project_code?: string | null
  show_as?: string
  categories?: string[]
  emails?: string[]
  responses?: { email: string; name: string | null; response: string; proposed_start?: string | null; proposed_end?: string | null }[]
}
type Proj = { project_code: string; title: string | null; client_name: string | null; intro_at: string | null; target_install_week: string | null; phase: string }
type Note = { event_key: string; note: string | null; category: Cat | null; project_code: string | null; hold?: boolean; hold_reason?: string | null }
type Rel = { kind: 'klant' | 'onderaannemer' | 'partner'; name: string; email: string | null }

export type Cat = 'klant' | 'onderaannemer' | 'partner' | 'mezelf' | 'project'
const CATS: { id: Cat; label: string }[] = [
  { id: 'klant', label: 'Klanten' },
  { id: 'onderaannemer', label: 'Onderaannemers' },
  { id: 'partner', label: 'Partners' },
  { id: 'mezelf', label: 'Mezelf' },
  { id: 'project', label: 'Projecten' },
]
const CAT_ONE: Record<Cat, string> = { klant: 'Klant', onderaannemer: 'Onderaannemer', partner: 'Partner', mezelf: 'Mezelf', project: 'Project' }

const DAY = 86400000
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const hm = (iso: string) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const isoWeek = (d: Date) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return { year: t.getUTCFullYear(), week: Math.ceil(((t.getTime() - y.getTime()) / DAY + 1) / 7) } }
/** Maandag van een plaatsingsweek ("2027-W12", "2027-12" of "12"). */
const mondayOfWeek = (s: string | null, ref: Date): Date | null => {
  if (!s) return null
  const m = s.match(/^(?:(\d{4})\D*W?)?(\d{1,2})$/i)
  if (!m) return null
  const year = m[1] ? Number(m[1]) : isoWeek(ref).year
  return addDays(startOfWeek(new Date(year, 0, 4)), (Number(m[2]) - 1) * 7)
}
const SRC: Record<Ev['source'], string> = { outlook: 'Outlook', bookings: 'Bookings', planning: 'Planning', job: 'Opdracht' }
export type AgendaEv = Ev
export const keyOf = (e: Ev) => e.bookings_id ?? e.outlook_id ?? e.id
export const codeIn = (s: string) => s.match(/\b(20\d{4})\b/)?.[1] ?? null
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

type View = 'dag' | 'week' | 'maand'

export function Agenda() {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(() => { if (params.get('d')) return 'dag'; try { const v = localStorage.getItem('agenda.view'); return v === 'maand' || v === 'dag' ? v : 'week' } catch { return 'week' } })
  const [anchor, setAnchor] = useState(() => { const d = params.get('d'); return d ? new Date(d + 'T12:00') : new Date() })
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [upcoming, setUpcoming] = useState<Ev[] | null>(null)
  const [projects, setProjects] = useState<Proj[]>([])
  const [notes, setNotes] = useState<Record<string, Note>>({})
  const [rels, setRels] = useState<Rel[]>([])
  const [hidden, setHidden] = useState<Cat[]>(() => { try { return JSON.parse(localStorage.getItem('agenda.hidden') ?? '[]') } catch { return [] } })
  const [warn, setWarn] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<Ev | null>(null)
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null)
  const [jobs, setJobs] = useState<Ev[]>([])
  const [jobsNext, setJobsNext] = useState<Ev[]>([])

  const { from, to } = useMemo(() => {
    if (view === 'dag') { const d = startOfDay(anchor); return { from: d, to: addDays(d, 1) } }
    if (view === 'week') { const w = startOfWeek(anchor); return { from: w, to: addDays(w, 7) } }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from: startOfWeek(first), to: addDays(startOfWeek(last), 7) }
  }, [view, anchor])
  const days = useMemo(() => Array.from({ length: Math.round((to.getTime() - from.getTime()) / DAY) }, (_, i) => addDays(from, i)), [from, to])
  const setV = (v: View) => { setView(v); try { localStorage.setItem('agenda.view', v) } catch { /* */ } }
  const openDay = (d: Date) => { setAnchor(d); setV('dag') }
  const step = (n: number) => setAnchor((a) => (view === 'dag' ? addDays(a, n) : view === 'week' ? addDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)))
  const toggle = (c: Cat) => setHidden((h) => { const n = h.includes(c) ? h.filter((x) => x !== c) : [...h, c]; try { localStorage.setItem('agenda.hidden', JSON.stringify(n)) } catch { /* */ } return n })

  const loadNotes = useCallback(async () => {
    const { data } = await supabase.from('agenda_notes').select('event_key,note,category,project_code,hold,hold_reason')
    setNotes(Object.fromEntries(((data as Note[]) ?? []).map((n) => [n.event_key, n])))
  }, [])
  useEffect(() => {
    loadNotes()
    Promise.all([
      supabase.from('clients').select('first_name,last_name,company,email'),
      supabase.from('partners').select('name,email'),
      supabase.from('subcontractors').select('name,email'),
    ]).then(([c, p, s]) => {
      const out: Rel[] = []
      for (const r of (c.data ?? []) as { first_name: string | null; last_name: string | null; company: string | null; email: string | null }[]) {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.company || ''
        out.push({ kind: 'klant', name, email: r.email })
      }
      for (const r of (p.data ?? []) as { name: string; email: string | null }[]) out.push({ kind: 'partner', name: r.name, email: r.email })
      for (const r of (s.data ?? []) as { name: string; email: string | null }[]) out.push({ kind: 'onderaannemer', name: r.name, email: r.email })
      setRels(out)
    })
  }, [loadNotes])

  type JobRow = Job & { subcontractors: { name: string } | null; partners: { name: string } | null }
  const jobEv = (j: JobRow): Ev => ({
    id: 'j:' + j.id, source: 'job', job: j, title: j.for_me ? j.title : `${j.subcontractors?.name ?? j.partners?.name ?? 'Opdracht'}: ${j.title}`,
    start: j.start_at, end: j.end_at, all_day: j.slot === 'dag', location: j.address, notes: j.instructions, project_code: j.project_code,
    customer: j.contact_name || j.contact_phone ? { name: j.contact_name ?? undefined, phone: j.contact_phone ?? undefined } : null,
  })
  const loadJobs = useCallback(async () => {
    const now = new Date()
    const q = () => supabase.from('jobs').select('*, subcontractors(name), partners(name)').neq('status', 'geannuleerd')
    const [a, b] = await Promise.all([
      q().lt('start_at', to.toISOString()).gt('end_at', from.toISOString()),
      q().gt('end_at', now.toISOString()).lt('start_at', addDays(now, 45).toISOString()),
    ])
    setJobs(((a.data ?? []) as JobRow[]).map(jobEv))
    setJobsNext(((b.data ?? []) as JobRow[]).map(jobEv))
  }, [from, to])
  useEffect(() => { loadJobs() }, [loadJobs])

  const load = useCallback(async () => {
    setErr(null)
    setEvents(null)
    const now = new Date()
    const [ag, pr, up] = await Promise.all([
      supabase.functions.invoke('agenda', { body: { action: 'list', from: from.toISOString(), to: to.toISOString() } }),
      supabase.from('app_projects').select('project_code,title,client_name,intro_at,target_install_week,phase'),
      supabase.functions.invoke('agenda', { body: { action: 'list', from: now.toISOString(), to: addDays(now, 45).toISOString() } }),
    ])
    setProjects((pr.data as Proj[]) ?? [])
    setUpcoming(up.error ? [] : ((up.data as { events?: Ev[] })?.events ?? []).filter((e) => new Date(e.end) > now && e.show_as !== 'free'))
    const e = ag.error ? (await (ag.error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? ag.error.message : (ag.data as { error?: string })?.error
    if (e) { setErr(e); setEvents([]); return }
    setEvents((ag.data as { events: Ev[] }).events)
    setWarn((ag.data as { warnings: string[] }).warnings ?? [])
  }, [from, to])
  useEffect(() => { load() }, [load])
  // iets nieuws gemaakt via "+ Nieuw" bovenaan: opnieuw laden
  useEffect(() => {
    const on = () => { loadNotes(); load(); loadJobs() }
    window.addEventListener('nieuw-created', on)
    return () => window.removeEventListener('nieuw-created', on)
  }, [load, loadNotes, loadJobs])
  // vanuit een project: ?d=YYYY-MM-DD&e=<id> opent die afspraak
  useEffect(() => {
    const id = params.get('e')
    if (!id || !events) return
    const hit = [...events, ...jobs].find((x) => x.id === id || keyOf(x) === id)
    if (hit) { setSel(hit); params.delete('e'); setParams(params, { replace: true }) }
  }, [events, jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Soort afspraak: eigen keuze > planning/Bookings > Outlook-categorie > genodigden > naam in de titel > mezelf. */
  const classify = useCallback((e: Ev): Cat => {
    const n = notes[keyOf(e)]
    if (n?.category) return n.category
    if (e.source === 'job') return e.job?.for_me ? 'mezelf' : e.job?.partner_id ? 'partner' : 'onderaannemer'
    if (e.source === 'planning') return 'project'
    if (e.source === 'bookings') return 'klant'
    const cats = norm((e.categories ?? []).join(' '))
    if (/onderaannemer|aannemer/.test(cats)) return 'onderaannemer'
    if (/partner/.test(cats)) return 'partner'
    if (/klant/.test(cats)) return 'klant'
    if (/project/.test(cats)) return 'project'
    if (/prive|mezelf|persoonlijk/.test(cats)) return 'mezelf'
    const emails = new Set(e.emails ?? [])
    for (const kind of ['onderaannemer', 'partner', 'klant'] as const) if (rels.some((r) => r.kind === kind && r.email && emails.has(r.email.toLowerCase()))) return kind
    const t = norm(e.title + ' ' + (e.location ?? ''))
    for (const kind of ['partner', 'onderaannemer'] as const) if (rels.some((r) => r.kind === kind && r.name.length > 2 && t.includes(norm(r.name)))) return kind
    if (codeIn(e.title)) return 'project'
    if (rels.some((r) => r.kind === 'klant' && r.name.length > 3 && t.includes(norm(r.name)))) return 'klant'
    return 'mezelf'
  }, [notes, rels])
  const projectOf = (e: Ev) => notes[keyOf(e)]?.project_code ?? e.project_code ?? codeIn(e.title)

  // planning uit de projecten: kennismakingen (als ze niet al uit Bookings komen) en plaatsingsweken
  const planning = useMemo(() => {
    const out: Ev[] = []
    const fromBookings = new Set((events ?? []).map((e) => e.project_code).filter(Boolean))
    for (const p of projects) {
      if (['closed', 'declined'].includes(p.phase)) continue
      const name = p.client_name ?? p.project_code
      if (p.intro_at && !fromBookings.has(p.project_code)) {
        const s = new Date(p.intro_at)
        if (s >= from && s < to) out.push({ id: 'p:i:' + p.project_code, source: 'planning', title: `Kennismaking ${name}`, start: p.intro_at, end: new Date(s.getTime() + 3600000).toISOString(), all_day: false, project_code: p.project_code })
      }
      const mon = mondayOfWeek(p.target_install_week, anchor)
      if (mon && mon < to && addDays(mon, 5) > from) out.push({ id: 'p:w:' + p.project_code, source: 'planning', title: `Plaatsing ${name}`, start: mon.toISOString(), end: addDays(mon, 5).toISOString(), all_day: true, project_code: p.project_code, notes: p.title })
    }
    return out
  }, [projects, events, from, to, anchor])

  const mirror = new Set([...jobs, ...jobsNext].map((x) => x.job?.outlook_event_id).filter(Boolean))
  const all = [...(events ?? []).filter((e) => !(e.outlook_id && mirror.has(e.outlook_id))), ...planning, ...jobs].filter((e) => !hidden.includes(classify(e))).sort((a, b) => a.start.localeCompare(b.start))
  const itemsOn = (d: Date) => all.filter((e) => (e.all_day ? new Date(e.start) < addDays(d, 1) && new Date(e.end) > d : sameDay(new Date(e.start), d)))
  const today = new Date()
  const label = view === 'dag'
    ? anchor.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : view === 'week'
      ? `Week ${isoWeek(from).week} · ${from.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} – ${addDays(from, 6).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
  const cls = (e: Ev) => 'cat-' + classify(e) + (e.job && !e.job.for_me ? (e.job.status === 'gepland' ? ' unconf' : e.job.status === 'voorstel' ? ' unconf prop' : ' conf') : '') + (notes[keyOf(e)]?.hold ? ' held' : '')
  const loading = events === null

  return (
    <div className="agenda">
      <div className="page-head">
        <h1>Agenda</h1>
        <div className="toolbar">
          <div className="seg">
            {(['dag', 'week', 'maand'] as View[]).map((v) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setV(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
          </div>
          <button onClick={() => step(-1)} aria-label="Vorige">←</button>
          <button onClick={() => setAnchor(new Date())}>Vandaag</button>
          <button onClick={() => step(1)} aria-label="Volgende">→</button>
          <strong className="agenda-range">{label}</strong>
        </div>
      </div>
      <div className="agenda-legend">
        {CATS.map((c) => (
          <button key={c.id} className={'cat-' + c.id + (hidden.includes(c.id) ? ' off' : '')} onClick={() => toggle(c.id)} title={hidden.includes(c.id) ? 'Tonen' : 'Verbergen'}>
            <i />{c.label}
          </button>
        ))}
      </div>
      {err && <div className="auth-msg error">{err}</div>}
      {warn.map((w) => <p key={w} className="notice">{w}</p>)}
      <div className="agenda-layout">
        <div>
          {view === 'dag' && <DayView day={startOfDay(anchor)} items={itemsOn(startOfDay(anchor))} loading={loading} cls={cls} notes={notes} onPick={setSel} />}
          {view === 'week' && (
            <div className="agenda-grid">
              {days.map((d) => {
                const items = itemsOn(d)
                return (
                  <section key={d.toISOString()} className={'agenda-day' + (sameDay(d, today) ? ' today' : '') + (d.getDay() % 6 === 0 ? ' weekend' : '')}>
                    <h3><button className="agenda-dhead" title="Dag tonen" onClick={() => openDay(d)}>{d.toLocaleDateString('nl-BE', { weekday: 'short' })} <span>{d.getDate()}</span></button></h3>
                    {loading ? <p className="muted small">Laden…</p> : items.length === 0 ? <p className="muted small agenda-empty">—</p> : items.map((e) => (
                      <button key={e.id} className={'agenda-ev ' + cls(e)} onClick={() => setSel(e)}>
                        <span className="agenda-time">{e.job?.slot ? SLOTS[e.job.slot].label : e.all_day ? 'Hele dag' : `${hm(e.start)}–${hm(e.end)}`}{e.job?.job_type ? ` · ${e.job.job_type}` : ''}</span>
                        <span className="agenda-title">{e.title}</span>
                        {(e.responses ?? []).length > 0 && <span className="agenda-loc">{e.responses!.some((r) => r.proposed_start) ? '⇄ ander moment voorgesteld' : e.responses!.every((r) => r.response === 'accepted') ? '✓ aanvaard' : e.responses!.some((r) => r.response === 'declined') ? '✗ geweigerd' : e.responses!.some((r) => r.response === 'tentativelyAccepted') ? '~ misschien' : '? wacht op antwoord'}</span>}
                        {e.job && <span className={'job-st small ' + e.job.status}>{JOB_STATUS[e.job.status]}</span>}
                        {e.location && <span className="agenda-loc">{e.location}</span>}
                        {notes[keyOf(e)]?.note && <span className="agenda-loc">✎ {notes[keyOf(e)]!.note}</span>}
                      </button>
                    ))}
                  </section>
                )
              })}
            </div>
          )}
          {view === 'maand' && (
            <div className="agenda-month">
              {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((n) => <div key={n} className="agenda-mhead">{n}</div>)}
              {days.map((d) => {
                const items = itemsOn(d)
                const out = d.getMonth() !== anchor.getMonth()
                return (
                  <section key={d.toISOString()} className={'agenda-mday' + (sameDay(d, today) ? ' today' : '') + (out ? ' out' : '') + (d.getDay() % 6 === 0 ? ' weekend' : '')} onClick={() => openDay(d)} title="Dag tonen">
                    <span className="agenda-mnum">{d.getDate()}</span>
                    {items.slice(0, 4).map((e) => (
                      <button key={e.id} className={'agenda-mev ' + cls(e)} onClick={(ev) => { ev.stopPropagation(); setSel(e) }} title={e.title}>
                        {!e.all_day && <span className="agenda-time">{hm(e.start)}</span>} {e.title}
                      </button>
                    ))}
                    {items.length > 4 && <span className="muted small">+{items.length - 4} meer</span>}
                  </section>
                )
              })}
            </div>
          )}
        </div>
        <Upcoming items={upcoming ? [...upcoming.filter((e) => !(e.outlook_id && mirror.has(e.outlook_id))), ...jobsNext].sort((a, b) => a.start.localeCompare(b.start)).filter((e) => !hidden.includes(classify(e))) : null} cls={cls} onPick={setSel} />
      </div>
      <p className="muted small">Outlook-agenda van info@vonstruct.com, Bookings-afspraken en de planning uit je projecten. De kleur volgt de soort: automatisch (genodigden, namen, projectcode of Outlook-categorie) of zelf gekozen bij de afspraak.</p>
      {sel?.source === 'job' && <JobEditor draft={sel.job!} onClose={() => setSel(null)} onSaved={loadJobs} />}
      {jobDraft && <JobEditor draft={jobDraft} onClose={() => setJobDraft(null)} onSaved={loadJobs} />}
      {sel && sel.source !== 'job' && <Detail onJob={(d) => { setSel(null); setJobDraft(d) }} ev={sel} cat={classify(sel)} note={notes[keyOf(sel)]} project={projectOf(sel)} projects={projects} onClose={() => setSel(null)} onChanged={(reload) => { setSel(null); loadNotes(); if (reload) load() }} />}
    </div>
  )
}

/** Dag met tijdlijn (6u–22u); overlappende afspraken naast elkaar. */
function DayView({ day, items, loading, cls, notes, onPick }: { day: Date; items: Ev[]; loading: boolean; cls: (e: Ev) => string; notes: Record<string, Note>; onPick: (e: Ev) => void }) {
  const H0 = 6, H1 = 22, PX = 56
  const timed = items.filter((e) => !e.all_day).sort((a, b) => a.start.localeCompare(b.start))
  const allDay = items.filter((e) => e.all_day)
  const first = timed.length ? Math.min(H0, new Date(timed[0].start).getHours()) : H0
  const lastEnd = timed.reduce((m, e) => Math.max(m, new Date(e.end).getHours() + 1), H1)
  const h0 = first, h1 = Math.min(24, Math.max(H1, lastEnd))
  // banen voor overlap
  const lanes: number[] = []
  const placed = timed.map((e) => {
    const s = new Date(e.start).getTime(), en = new Date(e.end).getTime()
    let lane = lanes.findIndex((end) => end <= s)
    if (lane < 0) { lane = lanes.length; lanes.push(en) } else lanes[lane] = en
    return { e, s, en, lane }
  })
  const width = Math.max(1, lanes.length)
  const top = (t: number) => ((t - day.getTime()) / 3600000 - h0) * PX
  const now = new Date()
  return (
    <div className="agenda-dayview panel">
      {allDay.length > 0 && <div className="agenda-weekbar">{allDay.map((e) => <button key={e.id} className={'agenda-ev ' + cls(e)} onClick={() => onPick(e)}>{e.title}{e.notes ? ` · ${e.notes}` : ''}</button>)}</div>}
      {loading && <p className="muted small">Laden…</p>}
      {!loading && timed.length === 0 && allDay.length === 0 && <p className="muted">Geen afspraken op deze dag.</p>}
      <div className="agenda-timeline" style={{ height: (h1 - h0) * PX }}>
        {Array.from({ length: h1 - h0 }, (_, i) => <div key={i} className="agenda-hour" style={{ top: i * PX }}><span>{String(h0 + i).padStart(2, '0')}:00</span></div>)}
        {sameDay(now, day) && <div className="agenda-now" style={{ top: top(now.getTime()) }} />}
        {placed.map(({ e, s, en, lane }) => {
          const n = notes[keyOf(e)]
          return (
            <button key={e.id} className={'agenda-block ' + cls(e)} onClick={() => onPick(e)}
              style={{ top: top(s), height: Math.max(26, ((en - s) / 3600000) * PX - 3), left: `calc(56px + (100% - 60px) * ${lane / width})`, width: `calc((100% - 60px) / ${width} - 4px)` }}>
              <span className="agenda-time">{hm(e.start)}–{hm(e.end)}</span>
              <span className="agenda-title">{e.title}</span>
              {e.location && <span className="agenda-loc">📍 {e.location}</span>}
              {e.customer?.phone && <span className="agenda-loc">📞 {e.customer.phone}</span>}
              {n?.note && <span className="agenda-loc">✎ {n.note}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Korte lijst van de volgende afspraken: wanneer, wie, wat, waar. */
function Upcoming({ items, cls, onPick }: { items: Ev[] | null; cls: (e: Ev) => string; onPick: (e: Ev) => void }) {
  const now = new Date()
  const rel = (iso: string) => {
    const d = new Date(iso)
    const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY)
    if (days === 0) return 'Vandaag'
    if (days === 1) return 'Morgen'
    if (days < 7) return d.toLocaleDateString('nl-BE', { weekday: 'long' })
    return d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const list = (items ?? []).filter((e) => !e.all_day || e.source === 'job').slice(0, 12)
  return (
    <aside className="panel vd-panel agenda-next">
      <div className="vd-h"><h2>Volgende afspraken</h2></div>
      {items === null ? <p className="muted small">Laden…</p> : list.length === 0 ? <p className="muted small">Geen afspraken in de komende 45 dagen.</p> : (
        <ol>
          {list.map((e) => {
            const nowOn = new Date(e.start) <= now
            const who = e.customer?.name
            const what = e.source === 'bookings' ? (e.title.split(':')[0] || 'Afspraak') : e.title
            return (
              <li key={e.id} className={'agenda-next-item ' + cls(e)}>
                <button onClick={() => onPick(e)}>
                  <span className="agenda-next-when">{nowOn ? 'Nu bezig' : rel(e.start)} · {e.job?.slot ? SLOTS[e.job.slot].label : `${hm(e.start)}–${hm(e.end)}`}</span>
                  <strong>{who ? `${who}` : what}</strong>
                  {who && <span>{what}</span>}
                  {e.location ? <span className="muted">📍 {e.location}</span> : e.online_url ? <span className="muted">💻 Online</span> : null}
                </button>
                <span className="agenda-next-links">
                  {e.customer?.phone && <a href={`tel:${e.customer.phone}`}>📞 {e.customer.phone}</a>}
                  {e.location && <RouteLinks address={e.location} />}
                  {e.online_url && <a href={e.online_url} target="_blank" rel="noreferrer">Deelnemen</a>}
                  {e.project_code && <Link to={`/projecten/${e.project_code}`}>Project {e.project_code}</Link>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('agenda', { body })
  return error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error ?? null
}

/** Eigen info bij een afspraak (enkel in de app): notitie, soort en project. */
async function saveNote(key: string, note: string, category: Cat | '', project: string) {
  const row = { event_key: key, note: note.trim() || null, category: category || null, project_code: project.trim() || null, updated_at: new Date().toISOString() }
  if (!row.note && !row.category && !row.project_code) return (await supabase.from('agenda_notes').delete().eq('event_key', key).eq('hold', false)).error?.message ?? null
  return (await supabase.from('agenda_notes').upsert(row)).error?.message ?? null
}

function InfoFields({ note, setNote, cat, setCat, project, setProject, projects }: { note: string; setNote: (s: string) => void; cat: Cat | ''; setCat: (c: Cat | '') => void; project: string; setProject: (s: string) => void; projects: Proj[] }) {
  return (
    <>
      <label>Soort
        <select value={cat} onChange={(e) => setCat(e.target.value as Cat | '')}>
          <option value="">Automatisch</option>
          {CATS.map((c) => <option key={c.id} value={c.id}>{CAT_ONE[c.id]}</option>)}
        </select>
      </label>
      <label>Project
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => <option key={p.project_code} value={p.project_code}>{p.project_code} · {p.client_name ?? p.title}</option>)}
        </select>
      </label>
      <label className="wide">Extra info (enkel voor jou, in de app)
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bv. sleutel bij de buren, maten meenemen, staalkaarten Egger…" />
      </label>
    </>
  )
}

function Detail({ ev, cat, note, project, projects, onClose, onChanged, onJob }: { onJob: (d: JobDraft) => void; ev: Ev; cat: Cat; note?: Note; project: string | null; projects: Proj[]; onClose: () => void; onChanged: (reload: boolean) => void }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'cancel'>('view')
  const [start, setStart] = useState(toLocalInput(ev.start))
  const [dur, setDur] = useState(Math.max(15, Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000)))
  const [title, setTitle] = useState(ev.title)
  const [loc, setLoc] = useState(ev.location ?? '')
  const [info, setInfo] = useState(note?.note ?? '')
  const [c, setC] = useState<Cat | ''>(note?.category ?? '')
  const [proj, setProj] = useState(note?.project_code ?? project ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const timeEditable = ev.source !== 'planning' && !ev.all_day
  const ids = { source: ev.source, bookings_id: ev.bookings_id, business_id: ev.business_id, outlook_id: ev.outlook_id, organizer_is_me: ev.organizer_is_me, attendees: ev.attendees }
  const save = async () => {
    setBusy(true); setErr(null)
    let reload = false
    if (timeEditable) {
      const s = new Date(start)
      const changed = s.getTime() !== new Date(ev.start).getTime() || dur * 60000 !== new Date(ev.end).getTime() - new Date(ev.start).getTime() || (ev.source === 'outlook' && (title !== ev.title || loc !== (ev.location ?? '')))
      if (changed) {
        const e = await call({ action: 'move', ...ids, start: s.toISOString(), end: new Date(s.getTime() + dur * 60000).toISOString(), ...(ev.source === 'outlook' ? { title, location: loc } : {}) })
        if (e) { setBusy(false); return setErr(e) }
        reload = true
      }
    }
    const e = await saveNote(keyOf(ev), info, c, proj)
    setBusy(false)
    if (e) return setErr(e)
    onChanged(reload)
  }
  const [inv, setInv] = useState<{ to: string; online: boolean } | null>(null)
  const clearHold = async () => { await supabase.from('agenda_notes').update({ hold: false, hold_reason: null, hold_at: null, updated_at: new Date().toISOString() }).eq('event_key', keyOf(ev)) }
  /** Toch doorgaan: staat er nog niemand op de afspraak, stel dan voor een uitnodiging (met Teams) te sturen. */
  const goOn = async () => {
    if (ev.source !== 'outlook' || (ev.attendees ?? 0) > 0) { setBusy(true); await clearHold(); setBusy(false); return onChanged(false) }
    // wie is de klant? 1) project van de afspraak, 2) naam of e-mailadres in de titel, 3) e-mailadres in de notitie
    let to = ''
    const code = proj || project || (ev.title.match(/\b20\d{4}\b/) ?? [])[0]
    if (code) {
      const { data: p } = await supabase.from('app_projects').select('client_email').eq('project_code', code).maybeSingle()
      to = (p as { client_email?: string } | null)?.client_email ?? ''
    }
    if (!to) {
      const { data } = await supabase.from('clients').select('first_name,last_name,company,email').not('email', 'is', null)
      const hay = (ev.title + ' ' + (ev.notes ?? '') + ' ' + (note?.note ?? '')).toLowerCase()
      const best = ((data ?? []) as { first_name: string | null; last_name: string | null; company: string | null; email: string }[])
        .map((x) => {
          const tokens = [x.first_name, x.last_name, x.company, ...x.email.split('@')[0].split(/[._-]+/)].filter(Boolean).map((t) => String(t).toLowerCase()).filter((t) => t.length >= 4)
          return { x, score: hay.includes(x.email.toLowerCase()) ? 10 : new Set(tokens.filter((t) => hay.includes(t))).size }
        })
        .filter((r) => r.score > 0).sort((a, b) => b.score - a.score)[0]
      to = best?.x.email ?? ''
    }
    if (!to) to = (ev.title + ' ' + (ev.notes ?? '')).match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? ''
    setInv({ to, online: true })
  }
  const sendInvite = async () => {
    if (!inv) return
    setBusy(true); setErr(null)
    const e = await call({ action: 'invite', outlook_id: ev.outlook_id, attendees: inv.to.split(/[,;\s]+/).filter((x) => x.includes('@')), online: inv.online })
    if (e) { setBusy(false); return setErr(e) }
    await clearHold(); setBusy(false); onChanged(true)
  }
  const putOnHold = async () => {
    setBusy(true)
    await supabase.from('agenda_notes').upsert({ event_key: keyOf(ev), hold: true, hold_reason: 'Met de hand on hold gezet', hold_at: new Date().toISOString(), event_title: ev.title, event_start: ev.start, updated_at: new Date().toISOString() })
    setBusy(false); onChanged(false)
  }
  const cancel = async () => {
    setBusy(true); setErr(null)
    const e = await call({ action: 'cancel', ...ids, message: msg })
    setBusy(false)
    if (e) return setErr(e)
    onChanged(true)
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="toolbar">
            <span className={'chip agenda-cat cat-' + cat}><i />{CAT_ONE[cat]}</span>
            <span className="muted small">{SRC[ev.source]}</span>
          </span>
          <button className="link" onClick={onClose} aria-label="Sluiten">✕</button>
        </div>
        {note?.hold && (
          <div className="hold-banner">
            <b>Gaat mogelijk niet door</b>
            <span>{note.hold_reason ?? 'De afspraak staat on hold.'}</span>
            <span className="toolbar">
              <button disabled={busy} onClick={goOn}>Toch doorgaan</button>
              <button className="primary" onClick={() => setMode('cancel')}>Annuleren</button>
              <button onClick={() => setMode('edit')}>Verzetten</button>
            </span>
            {inv && (
              <div className="hold-invite">
                <b>Uitnodiging sturen?</b>
                <span className="small muted">Er staat nog niemand op deze afspraak. Outlook stuurt een echte uitnodiging.</span>
                <label className="small">Naar<input value={inv.to} onChange={(e) => setInv({ ...inv, to: e.target.value })} placeholder="e-mailadres" /></label>
                <label className="check small"><input type="checkbox" checked={inv.online} onChange={(e) => setInv({ ...inv, online: e.target.checked })} /> Teams-link toevoegen</label>
                <span className="toolbar">
                  <button className="primary" disabled={busy || !inv.to.includes('@')} onClick={sendInvite}>Ja, uitnodiging sturen</button>
                  <button disabled={busy} onClick={async () => { setBusy(true); await clearHold(); setBusy(false); onChanged(false) }}>Nee, enkel doorgaan</button>
                </span>
              </div>
            )}
          </div>
        )}
        <h2 className={note?.hold ? 'held-title' : undefined}>{ev.title}</h2>
        {(ev.responses ?? []).length > 0 && (
          <p className="inv-list">
            {(ev.responses ?? []).map((r) => (
              <span key={r.email} className={'inv inv-' + r.response}>
                {r.response === 'accepted' ? '✓' : r.response === 'declined' ? '✗' : r.response === 'tentativelyAccepted' ? '~' : '?'} {r.name || r.email}
                <small>{r.response === 'accepted' ? 'aanvaard' : r.response === 'declined' ? 'geweigerd' : r.response === 'tentativelyAccepted' ? 'misschien' : 'nog geen antwoord'}</small>
              </span>
            ))}
          </p>
        )}
        {(ev.responses ?? []).filter((r) => r.proposed_start).map((r) => (
          <div key={'p' + r.email} className="hold-banner prop-time">
            <b>⇄ {r.name || r.email} stelt een ander moment voor</b>
            <span>{new Date(r.proposed_start!).toLocaleString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{r.proposed_end ? ` – ${hm(r.proposed_end)}` : ''}</span>
            <span className="toolbar">
              <button className="primary" disabled={busy} onClick={async () => {
                setBusy(true); setErr(null)
                const e = await call({ action: 'move', ...ids, start: r.proposed_start, end: r.proposed_end ?? new Date(new Date(r.proposed_start!).getTime() + (new Date(ev.end).getTime() - new Date(ev.start).getTime())).toISOString() })
                if (e) { setBusy(false); return setErr(e) }
                await clearHold(); setBusy(false); onChanged(true)
              }}>Nieuw moment aanvaarden</button>
              <button onClick={() => setMode('edit')}>Zelf een ander moment kiezen</button>
            </span>
            <span className="small muted">Bij aanvaarden verzet Outlook de afspraak en krijgt {r.name || 'de genodigde'} automatisch de update.</span>
          </div>
        ))}
        <p>{new Date(ev.start).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{!ev.all_day && ` · ${hm(ev.start)}–${hm(ev.end)}`}</p>

        {mode !== 'edit' && (
          <>
            {ev.location && <p className="muted">📍 {ev.location} · <RouteLinks address={ev.location} /></p>}
            {ev.customer?.name && (
              <p className="muted">
                {ev.customer.name}
                {ev.customer.phone && <> · <a href={`tel:${ev.customer.phone}`}>{ev.customer.phone}</a></>}
                {ev.customer.email && <> · <a href={`mailto:${ev.customer.email}`}>{ev.customer.email}</a></>}
              </p>
            )}
            {note?.note && <p className="agenda-notes agenda-mynote">✎ {note.note}</p>}
            {ev.notes && ev.source !== 'planning' && <p className="agenda-notes">{ev.notes}</p>}
            {ev.online_url && <p><a href={ev.online_url} target="_blank" rel="noreferrer">Online vergadering openen</a></p>}
            {project && <p><Link to={`/projecten/${project}`} onClick={onClose}>Project {project} openen →</Link></p>}
            {ev.source === 'planning' && <p className="muted small">Datum en uur komen uit de projectgegevens; wijzig die op de projectpagina. Extra info kan je hier wel toevoegen.</p>}
          </>
        )}

        {mode === 'edit' && (
          <div className="form-grid agenda-form">
            {ev.source === 'outlook' && <label className="wide">Titel<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>}
            {timeEditable && <label>Begin<DateTimeInput value={start} onChange={(e) => setStart(e.target.value)} /></label>}
            {timeEditable && <label>Duur (min)<input type="number" min={15} step={15} value={dur} onChange={(e) => setDur(Number(e.target.value))} /></label>}
            {ev.source === 'outlook' && <label className="wide">Locatie<input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>}
            <InfoFields note={info} setNote={setInfo} cat={c} setCat={setC} project={proj} setProject={setProj} projects={projects} />
            {ev.source === 'bookings' && <p className="muted small wide">Verplaats je deze afspraak, dan krijgt de klant van Bookings automatisch een mail met het nieuwe tijdstip.</p>}
          </div>
        )}
        {mode === 'cancel' && (
          <div className="agenda-form">
            {(ev.source === 'bookings' || (ev.organizer_is_me && (ev.attendees ?? 0) > 0)) ? (
              <label className="q">Bericht aan {ev.source === 'bookings' ? 'de klant' : 'de genodigden'} (optioneel)
                <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Bv. Door ziekte moet ik onze afspraak verplaatsen. Ik bel je om een nieuwe datum te kiezen." />
              </label>
            ) : <p className="muted">Deze afspraak wordt uit je Outlook-agenda verwijderd.</p>}
          </div>
        )}
        {err && <p className="auth-msg error">{err}</p>}
        <div className="toolbar">
          {mode === 'view' && <><button className="primary" onClick={() => setMode('edit')}>Wijzigen / info toevoegen</button><button onClick={() => onJob({ title: ev.source === 'planning' ? ev.title : '', slot: ev.all_day ? 'dag' : null, start_at: ev.all_day ? new Date(new Date(ev.start).setHours(8, 0, 0, 0)).toISOString() : ev.start, end_at: ev.all_day ? new Date(new Date(new Date(ev.end).getTime() - 86400000).setHours(16, 30, 0, 0)).toISOString() : ev.end, address: ev.location ?? null, project_code: project ?? null, instructions: note?.note ?? null })}>Opdracht voor onderaannemer</button>{!note?.hold && ev.source !== 'planning' && <button disabled={busy} onClick={putOnHold} title="Blijft zichtbaar, doorstreept, tot je annuleert of verzet">On hold</button>}{timeEditable && <button className="danger-btn" onClick={() => setMode('cancel')}>Annuleren</button>}</>}
          {mode === 'edit' && <><button className="primary" disabled={busy} onClick={save}>{busy ? 'Bewaren…' : 'Bewaren'}</button><button onClick={() => setMode('view')}>Terug</button></>}
          {mode === 'cancel' && <><button className="danger-btn" disabled={busy} onClick={cancel}>{busy ? 'Annuleren…' : 'Afspraak annuleren'}</button><button onClick={() => setMode('view')}>Terug</button></>}
        </div>
      </div>
    </div>
  )
}

export function NewEvent({ day, projects, onClose, onCreated, project = '', initialTitle = '' }: { day: Date; projects: Proj[]; onClose: () => void; onCreated: () => void; project?: string; initialTitle?: string }) {
  const d = new Date(day); d.setHours(9, 0, 0, 0)
  const [title, setTitle] = useState((project ? project + ' – ' : '') + initialTitle)
  const [start, setStart] = useState(toLocalInput(d.toISOString()))
  const [dur, setDur] = useState(60)
  const [loc, setLoc] = useState('')
  const [info, setInfo] = useState('')
  const [c, setC] = useState<Cat | ''>('')
  const [proj, setProj] = useState(project)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Teams-link en de klant uitnodigen (8 nov 2026): de klant krijgt dan een echte uitnodiging van Outlook
  const [teams, setTeams] = useState(false)
  const [invite, setInvite] = useState(false)
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  useEffect(() => {
    setClientEmail(null); setInvite(false)
    if (!proj) return
    supabase.from('app_projects').select('client_email').eq('project_code', proj).maybeSingle().then(({ data }) => setClientEmail((data as { client_email: string | null } | null)?.client_email ?? null))
  }, [proj])
  const save = async () => {
    if (!title.trim()) return setErr('Geef de afspraak een titel.')
    setBusy(true)
    const s = new Date(start)
    const { data, error } = await supabase.functions.invoke('agenda', { body: { action: 'create', title, start: s.toISOString(), end: new Date(s.getTime() + dur * 60000).toISOString(), location: loc, online: teams, attendees: invite && clientEmail ? [clientEmail] : undefined } })
    const e = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (!e && (data as { id?: string })?.id && (info || c || proj)) await saveNote((data as { id: string }).id, info, c, proj)
    setBusy(false)
    if (e) return setErr(e)
    onCreated()
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><span className="muted small">Nieuwe afspraak in Outlook</span><button className="link" onClick={onClose} aria-label="Sluiten">✕</button></div>
        <h2>Nieuwe afspraak</h2>
        <div className="form-grid agenda-form">
          <label className="wide">Titel<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bv. Opmeting keuken Jan Peeters" /></label>
          <label>Begin<DateTimeInput value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Duur (min)<input type="number" min={15} step={15} value={dur} onChange={(e) => setDur(Number(e.target.value))} /></label>
          <label className="wide">Locatie<input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>
          <InfoFields note={info} setNote={setInfo} cat={c} setCat={setC} project={proj} setProject={setProj} projects={projects} />
          <label className="wide check-line"><input type="checkbox" checked={teams} onChange={(e) => setTeams(e.target.checked)} /> Online via Teams (met Teams-link)</label>
          {clientEmail && <label className="wide check-line"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Klant uitnodigen ({clientEmail}): krijgt een uitnodiging van Outlook{teams ? ' met de Teams-link' : ''}</label>}
        </div>
        {err && <p className="auth-msg error">{err}</p>}
        <div className="toolbar"><button className="primary" disabled={busy} onClick={save}>{busy ? 'Bewaren…' : invite ? 'In Outlook zetten en uitnodigen' : 'In Outlook zetten'}</button><button onClick={onClose}>Annuleren</button></div>
      </div>
    </div>
  )
}
