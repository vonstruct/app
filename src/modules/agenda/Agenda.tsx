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
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [projects, setProjects] = useState<Proj[]>([])
  const [warn, setWarn] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<Ev | null>(null)
  const [creating, setCreating] = useState(false)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])

  const load = useCallback(async () => {
    setErr(null)
    setEvents(null)
    const [ag, pr] = await Promise.all([
      supabase.functions.invoke('agenda', { body: { action: 'list', from: week.toISOString(), to: addDays(week, 7).toISOString() } }),
      supabase.from('app_projects').select('project_code,title,client_name,intro_at,target_install_week,phase'),
    ])
    setProjects((pr.data as Proj[]) ?? [])
    const e = ag.error ? (await (ag.error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? ag.error.message : (ag.data as { error?: string })?.error
    if (e) { setErr(e); setEvents([]); return }
    setEvents((ag.data as { events: Ev[] }).events)
    setWarn((ag.data as { warnings: string[] }).warnings ?? [])
  }, [week])
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
        if (s >= week && s < addDays(week, 7)) out.push({ id: 'p:i:' + p.project_code, source: 'planning', title: `Kennismaking ${name}`, start: p.intro_at, end: new Date(s.getTime() + 3600000).toISOString(), all_day: false, project_code: p.project_code })
      }
      const mon = mondayOfWeek(p.target_install_week, week)
      if (mon && sameDay(mon, week)) out.push({ id: 'p:w:' + p.project_code, source: 'planning', title: `Plaatsing ${name}`, start: week.toISOString(), end: addDays(week, 5).toISOString(), all_day: true, project_code: p.project_code, notes: p.title })
    }
    return out
  }, [projects, events, week])

  const all = [...(events ?? []), ...planning]
  const weekItems = all.filter((e) => e.source === 'planning' && e.all_day)
  const today = new Date()
  const { week: wn } = isoWeek(week)
  const label = `${week.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} – ${addDays(week, 6).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="agenda">
      <div className="page-head">
        <h1>Agenda</h1>
        <div className="toolbar">
          <button onClick={() => setWeek(addDays(week, -7))} aria-label="Vorige week">←</button>
          <button onClick={() => setWeek(startOfWeek(new Date()))}>Vandaag</button>
          <button onClick={() => setWeek(addDays(week, 7))} aria-label="Volgende week">→</button>
          <strong className="agenda-range">Week {wn} · {label}</strong>
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
      <div className="agenda-grid">
        {days.map((d) => {
          const items = all.filter((e) => !(e.source === 'planning' && e.all_day) && (e.all_day ? new Date(e.start) < addDays(d, 1) && new Date(e.end) > d : sameDay(new Date(e.start), d)))
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
      <p className="muted small">Outlook-agenda van info@vonstruct.com, Bookings-afspraken van klanten (groen) en de planning uit je projecten (goud).</p>
      {sel && <Detail ev={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); load() }} />}
      {creating && <NewEvent day={days.find((d) => sameDay(d, today)) ?? week} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />}
    </div>
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
