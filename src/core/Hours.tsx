import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { toast } from './toast'
import { DateInput } from './DateInput'

/**
 * Uren invullen (7 nov 2026, fase 1), gemaakt voor de gsm: project, dag, uren (snelknoppen), soort werk en een notitie.
 * Bewaart in work_hours (telt mee in Geld › Nacalculatie aan de uurkost uit Rekenregels). Met `jobId` (eigen opdracht)
 * wordt alles vooraf ingevuld en verdwijnt de herinnering "Uren invullen" op Vandaag.
 * Openen: knop "+ Uren" op Vandaag en op de projectpagina, of /overzicht?uren=<opdracht-id> (punt op Vandaag).
 */
type Proj = { project_code: string; client_name: string | null; title: string | null }
type Job = { id: string; project_code: string | null; title: string; start_at: string; end_at: string; slot: string | null; job_type: string | null }

const QUICK = [1, 2, 4, 8]
const iso = (d: Date) => d.toLocaleDateString('sv-SE')
const num = (s: string) => Number(String(s).replace(',', '.'))

export function HoursQuickAdd({ project, jobId, onClose, onSaved }: { project?: string; jobId?: string | null; onClose: () => void; onSaved?: () => void }) {
  const [projects, setProjects] = useState<Proj[]>([])
  const [acts, setActs] = useState<string[]>(['Ontwerp', 'Opmeting', 'Productie', 'Plaatsing', 'Transport', 'Administratie', 'Nazorg'])
  const [job, setJob] = useState<Job | null>(null)
  const [f, setF] = useState({ project: project ?? '', date: iso(new Date()), hours: '', activity: 'Plaatsing', note: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('app_projects').select('project_code,client_name,title').eq('phase_active', true).order('project_code', { ascending: false })
      .then(({ data }) => setProjects((data ?? []) as Proj[]))
    supabase.from('rule_settings').select('value').eq('key', 'uur_activiteiten').maybeSingle()
      .then(({ data }) => { const l = (data as { value?: { lijst?: string[] } } | null)?.value?.lijst; if (l?.length) setActs(l) })
  }, [])

  useEffect(() => {
    if (!jobId) return
    supabase.from('jobs').select('id,project_code,title,start_at,end_at,slot,job_type').eq('id', jobId).maybeSingle().then(({ data }) => {
      const j = data as Job | null
      if (!j) return
      setJob(j)
      // dagdeel = 4 u, dag = 8 u; anders de duur van de opdracht (max. 10 u)
      const dur = j.slot === 'voormiddag' || j.slot === 'namiddag' ? 4 : j.slot === 'dag' ? 8 : Math.min(10, Math.max(0.5, Math.round(((new Date(j.end_at).getTime() - new Date(j.start_at).getTime()) / 36e5) * 4) / 4))
      const act = /productie/i.test(j.job_type ?? '') ? 'Productie' : /ophaling|transport/i.test(j.job_type ?? '') ? 'Transport' : /opmeting/i.test(j.title) ? 'Opmeting' : 'Plaatsing'
      setF((x) => ({ ...x, project: j.project_code ?? x.project, date: iso(new Date(j.start_at)), hours: String(dur).replace('.', ','), activity: act }))
    })
  }, [jobId])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const h = num(f.hours)
    if (!f.project) return toast('Kies een project', 'err')
    if (!(h > 0 && h <= 24)) return toast('Aantal uren invullen (tussen 0 en 24)', 'err')
    setBusy(true)
    const { error } = await supabase.from('work_hours').insert({ project_code: f.project, work_date: f.date, hours: h, activity: f.activity || null, note: f.note.trim() || null, job_id: job?.id ?? null, person: 'Olivier', source: 'app' })
    setBusy(false)
    if (error) return toast('Niet bewaard: ' + error.message, 'err')
    toast(`${String(h).replace('.', ',')} u bewaard voor ${f.project}`)
    onSaved?.(); onClose()
  }

  return (
    <div className="survey-overlay" onClick={onClose}>
      <form className="panel new-lead hours-add" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Uren invullen</h2>
        {job && <p className="muted small">Opdracht: {job.title}</p>}
        <div className="form-grid">
          <label className="wide">Project
            <select required value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
              <option value="">Kies een project…</option>
              {f.project && !projects.some((p) => p.project_code === f.project) && <option value={f.project}>{f.project}</option>}
              {projects.map((p) => <option key={p.project_code} value={p.project_code}>{p.project_code} · {p.client_name ?? ''}{p.title ? ` · ${p.title}` : ''}</option>)}
            </select>
          </label>
          <label>Dag
            <DateInput value={f.date} onChange={(e) => setF({ ...f, date: e.target.value || iso(new Date()) })} />
          </label>
          <label>Uren
            <input inputMode="decimal" value={f.hours} placeholder="bv. 3,5" onChange={(e) => setF({ ...f, hours: e.target.value })} />
          </label>
          <div className="wide hours-quick">{QUICK.map((q) => <button type="button" key={q} className={num(f.hours) === q ? 'on' : ''} onClick={() => setF({ ...f, hours: String(q) })}>{q} u</button>)}</div>
          <label className="wide">Soort werk
            <select value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })}>
              {acts.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="wide">Notitie (optioneel)
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="bv. plinten en afwerking" />
          </label>
        </div>
        <div className="toolbar">
          <button className="primary" disabled={busy}>{busy ? 'Bewaren…' : 'Bewaren'}</button>
          <button type="button" onClick={onClose}>Annuleren</button>
        </div>
      </form>
    </div>
  )
}
