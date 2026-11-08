import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { supabase } from './supabase'
import { toast } from './toast'
import { DateInput } from './DateInput'
import { NewRequest } from '../modules/projecten/NewRequest'
import { NewEvent } from '../modules/agenda/Agenda'
import { JobEditor, type JobDraft } from '../modules/agenda/JobEditor'

/**
 * Eén knop "+ Nieuw" (8 nov 2026, Olivier: "4 knoppen is te veel"), overal in de bovenbalk:
 *  1. Aanvraag of project  2. Afspraak (gesprek met de klant, Outlook)  3. Te doen (taak voor jezelf of opdracht voor iemand).
 * Op een projectpagina is het project al ingevuld. Andere plaatsen openen hetzelfde via
 * window.dispatchEvent(new CustomEvent('nieuw-open', { detail: { kind, project?, client? } })).
 * Na het bewaren: window-event 'nieuw-created' (Agenda, Opdrachten en de projectpagina laden dan opnieuw).
 */
export type NewKind = 'aanvraag' | 'afspraak' | 'todo'
type Detail = { kind: NewKind; project?: string; client?: string }
type Proj = { project_code: string; title: string | null; client_name: string | null; intro_at: string | null; target_install_week: string | null; phase: string }

export const openNew = (detail: Detail) => window.dispatchEvent(new CustomEvent('nieuw-open', { detail }))
const created = (kind: NewKind) => window.dispatchEvent(new CustomEvent('nieuw-created', { detail: { kind } }))

const CHOICES: { kind: NewKind; label: string; help: string }[] = [
  { kind: 'aanvraag', label: 'Aanvraag of project', help: 'Iemand vraagt iets, of een project dat al loopt' },
  { kind: 'afspraak', label: 'Afspraak', help: 'Een gesprek met de klant, in je agenda' },
  { kind: 'todo', label: 'Te doen', help: 'Een taak voor jezelf, of werk voor een onderaannemer of Vlinth' },
]

export function NewMenu() {
  const loc = useLocation()
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState<Detail | null>(null)
  const [projects, setProjects] = useState<Proj[]>([])
  const ref = useRef<HTMLDivElement>(null)
  // project van de pagina waar je staat
  const here = decodeURIComponent(loc.pathname.match(/^\/projecten\/([^/]+)/)?.[1] ?? '') || undefined

  useEffect(() => { setMenu(false) }, [loc.pathname])
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<Detail>).detail)
    window.addEventListener('nieuw-open', on)
    return () => window.removeEventListener('nieuw-open', on)
  }, [])
  // lopende projecten, voor de keuzelijsten (één verzoek, enkel als er een formulier opengaat)
  useEffect(() => {
    if (!open || open.kind === 'aanvraag' || projects.length) return
    supabase.from('app_projects').select('project_code,title,client_name,intro_at,target_install_week,phase').eq('phase_active', true).order('project_code', { ascending: false })
      .then(({ data }) => setProjects((data as Proj[]) ?? []))
  }, [open, projects.length])

  const choose = (kind: NewKind) => { setMenu(false); setOpen({ kind, project: here }) }
  const close = () => setOpen(null)

  return (
    <div className="nw" ref={ref}>
      <button className="tb-new" onClick={() => setMenu((x) => !x)} aria-haspopup="menu" aria-expanded={menu} title="Iets nieuws maken">
        <span aria-hidden="true">+</span><span className="tb-new-label">Nieuw</span>
      </button>
      {menu && (
        <div className="nw-menu" role="menu">
          {CHOICES.map((c) => (
            <button key={c.kind} role="menuitem" onClick={() => choose(c.kind)}>
              <b>{c.label}</b><span>{c.help}{here && c.kind !== 'aanvraag' ? ` · ${here}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      {open?.kind === 'aanvraag' && <NewRequest initialClient={open.client} onClose={close} onCreated={() => { close(); created('aanvraag') }} />}
      {open?.kind === 'afspraak' && (
        <NewEvent day={new Date()} projects={projects} project={open.project ?? ''} onClose={close}
          onCreated={() => { close(); created('afspraak'); toast('Afspraak staat in je agenda') }} />
      )}
      {open?.kind === 'todo' && <NewTodo project={open.project} projects={projects} onClose={close} />}
    </div>
  )
}

/**
 * "Te doen": voor jezelf zonder vast uur = taak (Vandaag › Taken); met een vaste dag of voor iemand anders = opdracht
 * (agenda, en in het portaal van de onderaannemer of partner) via de bestaande opdracht-editor.
 */
function NewTodo({ project, projects, onClose }: { project?: string; projects: Proj[]; onClose: () => void }) {
  const [what, setWhat] = useState('')
  const [proj, setProj] = useState(project ?? '')
  const [who, setWho] = useState<'ik' | 'ander'>('ik')
  const [when, setWhen] = useState<'tegen' | 'dag'>('tegen')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [job, setJob] = useState<JobDraft | null>(null)
  const isTask = who === 'ik' && when === 'tegen'

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!what.trim()) return setErr('Wat moet er gebeuren?')
    if (isTask) {
      setBusy(true)
      const { error } = await supabase.from('tasks').insert({ text: what.trim(), project_code: proj || null, due_date: date || null, source: 'app', kind: 'buiten' })
      setBusy(false)
      if (error) return setErr(error.message)
      toast('Taak bewaard: je ziet ze op Vandaag › Taken')
      created('todo'); onClose(); return
    }
    // opdracht: verder in de opdracht-editor (wie, dagdeel, adres, bestanden …)
    const d = date ? new Date(date + 'T08:00:00') : new Date(new Date().setHours(8, 0, 0, 0))
    setJob({ title: what.trim(), project_code: proj || null, for_me: who === 'ik', start_at: d.toISOString() })
  }

  if (job) return <JobEditor draft={job} onClose={onClose} onSaved={() => { created('todo'); onClose() }} />
  return (
    <div className="survey-overlay" onClick={onClose}>
      <form className="panel new-lead nr" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Te doen</h2>
        <div className="form-grid">
          <label className="wide">Wat moet er gebeuren?<input autoFocus value={what} onChange={(e) => setWhat(e.target.value)} placeholder="bv. Christel terugbellen · Plaatsing keuken · Staal ophalen" /></label>
          <label className="wide">Project<select value={proj} onChange={(e) => setProj(e.target.value)}><option value="">(geen project)</option>{projects.map((p) => <option key={p.project_code} value={p.project_code}>{p.project_code} · {p.client_name ?? p.title ?? ''}</option>)}{proj && !projects.some((p) => p.project_code === proj) && <option value={proj}>{proj}</option>}</select></label>
        </div>
        <div className="nr-row">
          <span className="nr-lbl">Wie?</span>
          <div className="seg"><button type="button" className={who === 'ik' ? 'on' : ''} onClick={() => setWho('ik')}>Ik zelf</button><button type="button" className={who === 'ander' ? 'on' : ''} onClick={() => setWho('ander')}>Onderaannemer of Vlinth</button></div>
        </div>
        <div className="nr-row">
          <span className="nr-lbl">Wanneer?</span>
          <div className="seg"><button type="button" className={when === 'tegen' ? 'on' : ''} onClick={() => setWhen('tegen')}>Tegen een datum</button><button type="button" className={when === 'dag' ? 'on' : ''} onClick={() => setWhen('dag')}>Op een vaste dag</button></div>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <p className="muted small">{isTask ? 'Wordt een taak op Vandaag › Taken. Afvinken als het gedaan is.' : 'Wordt een opdracht in de agenda' + (who === 'ander' ? ', en in het portaal van de onderaannemer of Vlinth, die bevestigt.' : '.') + ' Je kiest zo meteen het dagdeel en de details.'}</p>
        {err && <p className="error">{err}</p>}
        <div className="survey-nav"><button type="button" onClick={onClose}>Annuleren</button><button className="primary" disabled={busy}>{isTask ? (busy ? 'Bewaren…' : 'Bewaren') : 'Verder'}</button></div>
      </form>
    </div>
  )
}
