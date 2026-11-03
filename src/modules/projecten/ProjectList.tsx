import { useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { ErrorBox, Loading } from '../../core/ui'
import { gatesOf, ProjectCard, usePhases, useProjects, type ProjectPlanning, type ProjectProgress } from '../../core/projects'
import { NewLead } from './NewLead'
import { NewProject } from './NewProject'
import { Pipeline } from './Pipeline'

type Filter = 'lopend' | 'alle' | 'afgesloten'

export function ProjectList() {
  const q = useProjects()
  const ph = usePhases()
  const [filter, setFilter] = useState<Filter>('lopend')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  const [plan, setPlan] = useState<Record<string, ProjectPlanning>>({})
  const [prog, setProg] = useState<Record<string, ProjectProgress>>({})
  useEffect(() => { supabase.from('app_project_progress').select('*').then(({ data }) => setProg(Object.fromEntries(((data ?? []) as ProjectProgress[]).map((r) => [r.project_code, r])))) }, [])
  useEffect(() => { supabase.from('app_project_planning').select('*').then(({ data }) => setPlan(Object.fromEntries(((data ?? []) as ProjectPlanning[]).map((r) => [r.project_code, r])))) }, [])
  const all = q.data ?? []
  const needle = search.trim().toLowerCase()
  const rows = all
    .filter((p) => (filter === 'alle' ? true : filter === 'lopend' ? p.phase_active !== false : p.phase_active === false))
    .filter((p) => !needle || [p.project_code, p.title, p.client_name, p.site_city, p.scene_title].some((v) => (v ?? '').toLowerCase().includes(needle)))
  const count = (f: Filter) => all.filter((p) => (f === 'alle' ? true : f === 'lopend' ? p.phase_active !== false : p.phase_active === false)).length

  return (
    <section>
      {adding && <NewLead onClose={() => setAdding(false)} />}
      {addingProject && <NewProject onClose={() => setAddingProject(false)} />}
      <div className="page-head vd-pagehead">
        <div>
          <div className="vd-date">{new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Projecten</h1>
          <p className="muted">Een aanvraag maakt de klant en het project aan met een projectcode. Gebruik die code in PaletteCAD: elke upload wordt dan een nieuwe versie van dat project.</p>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Zoek op code, klant, gemeente…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={() => setAddingProject(true)}>+ Nieuw project</button>
          <button className="primary" onClick={() => setAdding(true)}>+ Nieuwe aanvraag</button>
        </div>
      </div>
      <div className="segmented">
        {(['lopend', 'alle', 'afgesloten'] as Filter[]).map((f) => (
          <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'lopend' ? 'Lopend' : f === 'alle' ? 'Alle' : 'Afgesloten'} <span>{count(f)}</span>
          </button>
        ))}
      </div>
      <ErrorBox error={q.error ?? ph.error} />
      {!q.loading && !ph.loading && (
        <details className="pipe-box panel vd-panel">
          <summary className="vd-h"><h2>Pijplijn per fase</h2><span className="vd-more">openen</span></summary>
          <Pipeline projects={all.filter((p) => p.phase_active !== false)} gates={gatesOf(ph.data ?? [])} />
        </details>
      )}
      {q.loading || ph.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">Geen projecten.</p>
      ) : (
        <section className="panel vd-panel pl-panel">
          <div className="vd-h"><h2>{filter === 'lopend' ? 'Lopende projecten' : filter === 'alle' ? 'Alle projecten' : 'Afgesloten projecten'}</h2><span className="vd-more">{rows.length}</span></div>
        <div className="pcards">
          {rows.map((p) => (
            <ProjectCard key={p.project_id} p={p} phases={ph.data ?? []} onSaved={q.reload} planning={plan[p.project_code]} progress={prog[p.project_code]} />
          ))}
        </div>
        </section>
      )}
    </section>
  )
}
