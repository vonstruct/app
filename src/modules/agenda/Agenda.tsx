import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'

/** Item in de agenda: Outlook (info@vonstruct.com), Bookings (klantafspraken) of planning uit de projecten. */
type Ev = {
  id: string
  source: 'outlook' | 'bookings' | 'planning'
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
}
type Proj = { project_code: string; title: string | null; client_name: string | null; intro_at: string | null; target_install_week: string | null; phase: string }

const DAY = 86400000
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
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
  const jan4 = new Date(year, 0, 4)
  return addDays(startOfWeek(jan4), (Number(m[2]) - 1) * 7)
}
const SRC: Record<Ev['source'], string> = { outlook: 'Outlook', bookings: 'Bookings', planning: 'Planning' }

export function Agenda() {
  const [view, setView] = useState<'week' | 'maand'>(() => { try { return localStorage.getItem('agenda.view') === 'maand' ? 'maand' : 'week' } catch { return 'week' } })
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [upcoming, setUpcoming] = useState<Ev[] | null>(null)
  const [projects, setProjects] = useState<Proj[]>([])
  const [warn, setWarn] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<Ev | null>(null)
  const [creating, setCreating] = useState(false)
  // zichtbare periode: week, of maand als volledige weken (ma–zo)
  const { from, to, week } = useMemo(() => {
    if (view === 'week') { const w = startOfWeek(anchor); return { from: w, to: addDays(w, 7), week: w } }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    const f = startOfWeek(first)
    return { from: f, to: addDays(startOfWeek(last), 7), week: f }
  }, [view, anchor])
  const days = useMemo(() => Array.from({ length: Math.round((to.getTime() - from.getTime()) / DAY) }, (_, i) => addDays(from, i)), [from, to])
  const setV = (v: 'week' | 'maand') => { setView(v); try { localStorage.setItem('agenda.view', v) } catch { /* */ } }
  const step = (n: number) => setAnchor((a) => (view === 'week' ? addDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)))

  const load = useCallback(async () => {
    setErr(null)
    setEvents(null)
    const now = new Date()
    const [ag, pr, up] = await Promise.all([
      supabase.functions.invoke('agenda', { body: { action: 'list', from: from.toISOString(), to: to.toISOString() } }),
      supabase.from('app_projects').select('project_code,title,client_name,intro_at,target_install_week,phase'),
      supabase.functions.invoke('agenda', { body: { action: 'list', from: now.toISOString(), to: addDays(now, 45).toISOString() } }),
    ])
    setUpcoming(up.error ? [] : ((up.data as { events?: Ev[] })?.events ?? []).filter((e) => new Date(e.end) > now && e.show_as !== 'free'))
    setProjects((pr.data as Proj[]) ?? [])
    const e = ag.error ? (await (ag.error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? ag.error.message : (ag.data as { error?: string })?.error
    if (e) { setErr(e); setEvents([]); return }
    setEvents((ag.data as { events: Ev[] }).events)
    setWarn((ag.data as { warnings: string[] }).warnings ?? [])
  }, [from, to])
  useEffect(() => { load() }, [load])

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
      if (mon && mon >= from && mon < to) out.push({ id: 'p:w:' + p.project_code, source: 'planning', title: `Plaatsing ${name}`, start: mon.toISOString(), end: addDays(mon, 5).toISOString(), all_day: true, project_code: p.project_code, notes: p.title })
    }
    return out
  }, [projects, events, from, to, anchor])

  const all = [...(events ?? []), ...planning]
  const weekItems = view === 'week' ? all.filter((e) => e.source === 'planning' && e.all_day) : []
  const today = new Date()
  const { week: wn } = isoWeek(week)
  const label = view === 'week'
    ? `Week ${wn} · ${week.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} – ${addDays(week, 6).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : anchor.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
  const itemsOn = (d: Date) => all.filter((e) => !(view === 'week' && e.source === 'planning' && e.all_day) && (e.all_day ? new Date(e.start) < addDays(d, 1) && new Date(e.end) > d : sameDay(new Date(e.start), d)))

  return (
    <div className="agenda">
      <div className="page-head">
        <h1>Agenda</h1>
        <div className="toolbar">
          <div className="seg">
            <button className={view === 'week' ? 'on' : ''} onClick={() => setV('week')}>Week</button>
            <button className={view === 'maand' ? 'on' : ''} onClick={() => setV('maand')}>Maand</button>
          </div>
          <button onClick={() => step(-1)} aria-label="Vorige">←</button>
          <button onClick={() => setAnchor(new Date())}>Vandaag</button>
          <button onClick={() => step(1)} aria-label="Volgende">→</button>
          <strong className="agenda-range">{label}</strong>
          <button className="primary" onClick={() => setCreating(true)}>+ Nieuwe afspraak</button>
        </div>
      </div>
      {err && <div className="auth-msg error">{err}</div>}
      {warn.map((w) => <p key={w} className="notice">{w}</p>)}
      {weekItems.length > 0 && (
        <div className="agenda-weekbar">
          {weekItems.map((e) => <button key={e.id} className="agenda-ev planning" onClick={() => setSel(e)}>{e.title}{e.notes ? ` · ${e.notes}` : ''}</button>)}
        </div>
      )}
      <div className="agenda-layout">
        <div>
          {view === 'week' ? (
            <div className="agenda-grid">
              {days.map((d) => {
                const items = itemsOn(d)
                return (
                  <section key={d.toISOString()} className={'agenda-day' + (sameDay(d, today) ? ' today' : '') + (d.getDay() % 6 === 0 ? ' weekend' : '')}>
                    <h3>{d.toLocaleDateString('nl-BE', { weekday: 'short' })} <span>{d.getDate()}</span></h3>
                    {events === null ? <p className="muted small">Laden…</p> : items.length === 0 ? <p className="muted small agenda-empty">—</p> : items.map((e) => (
                      <button key={e.id} className={'agenda-ev ' + e.source} onClick={() => setSel(e)}>
                        <span className="agenda-time">{e.all_day ? 'Hele dag' : `${hm(e.start)}–${hm(e.end)}`}</span>
                        <span className="agenda-title">{e.title}</span>
                        {e.location && <span className="agenda-loc">{e.location}</span>}
                      </button>
                    ))}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="agenda-month">
              {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((n) => <div key={n} className="agenda-mhead">{n}</div>)}
              {days.map((d) => {
                const items = itemsOn(d)
                const out = d.getMonth() !== anchor.getMonth()
                return (
                  <section key={d.toISOString()} className={'agenda-mday' + (sameDay(d, today) ? ' today' : '') + (out ? ' out' : '') + (d.getDay() % 6 === 0 ? ' weekend' : '')}>
                    <button className="agenda-mnum" title="Week tonen" onClick={() => { setAnchor(d); setV('week') }}>{d.getDate()}</button>
                    {items.slice(0, 4).map((e) => (
                      <button key={e.id} className={'agenda-mev ' + e.source} onClick={() => setSel(e)} title={e.title}>
                        {!e.all_day && <span className="agenda-time">{hm(e.start)}</span>} {e.title}
                      </button>
                    ))}
                    {items.length > 4 && <button className="link small" onClick={() => { setAnchor(d); setV('week') }}>+{items.length - 4} meer</button>}
                  </section>
                )
              })}
            </div>
          )}
        </div>
        <Upcoming items={upcoming} onPick={setSel} />
      </div>
      <p className="muted small">Outlook-agenda van info@vonstruct.com, Bookings-afspraken van klanten (groen) en de planning uit je projecten (goud).</p>
      {sel && <Detail ev={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); load() }} />}
      {creating && <NewEvent day={days.find((d) => sameDay(d, today)) ?? from} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />}
    </div>
  )
}

/** Korte lijst van de volgende afspraken: wanneer, wie, wat, waar. */
function Upcoming({ items, onPick }: { items: Ev[] | null; onPick: (e: Ev) => void }) {
  const now = new Date()
  const rel = (iso: string) => {
    const d = new Date(iso)
    const days = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / DAY)
    if (days === 0) return 'Vandaag'
    if (days === 1) return 'Morgen'
    if (days < 7) return d.toLocaleDateString('nl-BE', { weekday: 'long' })
    return d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const list = (items ?? []).filter((e) => !e.all_day).slice(0, 12)
  return (
    <aside className="panel agenda-next">
      <h2>Volgende afspraken</h2>
      {items === null ? <p className="muted small">Laden…</p> : list.length === 0 ? <p className="muted small">Geen afspraken in de komende 45 dagen.</p> : (
        <ol>
          {list.map((e) => {
            const nowOn = new Date(e.start) <= now
            const who = e.customer?.name
            const what = e.source === 'bookings' ? (e.title.split(':')[0] || 'Afspraak') : e.title
            return (
              <li key={e.id} className={'agenda-next-item ' + e.source}>
                <button onClick={() => onPick(e)}>
                  <span className="agenda-next-when">{nowOn ? 'Nu bezig' : rel(e.start)} · {hm(e.start)}–{hm(e.end)}</span>
                  <strong>{who ? `${who}` : what}</strong>
                  {who && <span>{what}</span>}
                  {e.location ? <span className="muted">📍 {e.location}</span> : e.online_url ? <span className="muted">💻 Online</span> : null}
                </button>
                <span className="agenda-next-links">
                  {e.customer?.phone && <a href={`tel:${e.customer.phone}`}>📞 {e.customer.phone}</a>}
                  {e.location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" rel="noreferrer">Route</a>}
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

function Detail({ ev, onClose, onChanged }: { ev: Ev; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'move' | 'cancel'>('view')
  const [start, setStart] = useState(toLocalInput(ev.start))
  const [dur, setDur] = useState(Math.max(15, Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000)))
  const [title, setTitle] = useState(ev.title)
  const [loc, setLoc] = useState(ev.location ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const editable = ev.source !== 'planning' && !ev.all_day
  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null)
    const e = await call({ ...body, source: ev.source, bookings_id: ev.bookings_id, business_id: ev.business_id, outlook_id: ev.outlook_id, organizer_is_me: ev.organizer_is_me, attendees: ev.attendees })
    setBusy(false)
    if (e) return setErr(e)
    onChanged()
  }
  const move = () => {
    const s = new Date(start)
    run({ action: 'move', start: s.toISOString(), end: new Date(s.getTime() + dur * 60000).toISOString(), ...(ev.source === 'outlook' ? { title, location: loc } : {}) })
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className={'chip agenda-src ' + ev.source}>{SRC[ev.source]}</span>
          <button className="link" onClick={onClose} aria-label="Sluiten">✕</button>
        </div>
        <h2>{ev.title}</h2>
        <p>{new Date(ev.start).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{!ev.all_day && ` · ${hm(ev.start)}–${hm(ev.end)}`}</p>
        {ev.location && <p className="muted">📍 {ev.location}</p>}
        {ev.customer?.name && (
          <p className="muted">
            {ev.customer.name}
            {ev.customer.phone && <> · <a href={`tel:${ev.customer.phone}`}>{ev.customer.phone}</a></>}
            {ev.customer.email && <> · <a href={`mailto:${ev.customer.email}`}>{ev.customer.email}</a></>}
          </p>
        )}
        {ev.notes && ev.source !== 'planning' && <p className="agenda-notes">{ev.notes}</p>}
        {ev.online_url && <p><a href={ev.online_url} target="_blank" rel="noreferrer">Online vergadering openen</a></p>}
        {ev.project_code && <p><Link to={`/projecten/${ev.project_code}`} onClick={onClose}>Project {ev.project_code} openen →</Link></p>}
        {ev.source === 'planning' && <p className="muted small">Dit komt uit de projectgegevens. Wijzig het op de projectpagina.</p>}

        {mode === 'move' && (
          <div className="form-grid agenda-form">
            {ev.source === 'outlook' && <label className="wide">Titel<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>}
            <label>Begin<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label>Duur (min)<input type="number" min={15} step={15} value={dur} onChange={(e) => setDur(Number(e.target.value))} /></label>
            {ev.source === 'outlook' && <label className="wide">Locatie<input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>}
            {ev.source === 'bookings' && <p className="muted small wide">De klant krijgt van Bookings automatisch een mail met het nieuwe tijdstip.</p>}
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
        {editable && (
          <div className="toolbar">
            {mode === 'view' && <><button className="primary" onClick={() => setMode('move')}>Wijzigen</button><button className="danger-btn" onClick={() => setMode('cancel')}>Annuleren</button></>}
            {mode === 'move' && <><button className="primary" disabled={busy} onClick={move}>{busy ? 'Bewaren…' : 'Bewaren'}</button><button onClick={() => setMode('view')}>Terug</button></>}
            {mode === 'cancel' && <><button className="danger-btn" disabled={busy} onClick={() => run({ action: 'cancel', message: msg })}>{busy ? 'Annuleren…' : 'Afspraak annuleren'}</button><button onClick={() => setMode('view')}>Terug</button></>}
          </div>
        )}
      </div>
    </div>
  )
}

function NewEvent({ day, onClose, onCreated }: { day: Date; onClose: () => void; onCreated: () => void }) {
  const d = new Date(day); d.setHours(9, 0, 0, 0)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(toLocalInput(d.toISOString()))
  const [dur, setDur] = useState(60)
  const [loc, setLoc] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!title.trim()) return setErr('Geef de afspraak een titel.')
    setBusy(true)
    const s = new Date(start)
    const e = await call({ action: 'create', title, start: s.toISOString(), end: new Date(s.getTime() + dur * 60000).toISOString(), location: loc, notes })
    setBusy(false)
    if (e) return setErr(e)
    onCreated()
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><span className="chip agenda-src outlook">Outlook</span><button className="link" onClick={onClose} aria-label="Sluiten">✕</button></div>
        <h2>Nieuwe afspraak</h2>
        <div className="form-grid agenda-form">
          <label className="wide">Titel<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bv. Opmeting 209902 Geel" /></label>
          <label>Begin<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Duur (min)<input type="number" min={15} step={15} value={dur} onChange={(e) => setDur(Number(e.target.value))} /></label>
          <label className="wide">Locatie<input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>
          <label className="wide">Notitie<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
        {err && <p className="auth-msg error">{err}</p>}
        <div className="toolbar"><button className="primary" disabled={busy} onClick={save}>{busy ? 'Bewaren…' : 'In Outlook zetten'}</button><button onClick={onClose}>Annuleren</button></div>
      </div>
    </div>
  )
}
