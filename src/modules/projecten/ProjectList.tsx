import { useState } from 'react'
import { ErrorBox, Loading } from '../../core/ui'
import { ProjectCard, usePhases, useProjects } from '../../core/projects'
import { NewLead } from './NewLead'

type Filter = 'lopend' | 'alle' | 'afgesloten'

export function ProjectList() {
  const q = useProjects()
  const ph = usePhases()
  const [filter, setFilter] = useState<Filter>('lopend')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const all = q.data ?? []
  const needle = search.trim().toLowerCase()
  const rows = all
    .filter((p) => (filter === 'alle' ? true : filter === 'lopend' ? p.phase_active !== false : p.phase_active === false))
    .filter((p) => !needle || [p.project_code, p.title, p.client_name, p.site_city, p.scene_title].some((v) => (v ?? '').toLowerCase().includes(needle)))
  const count = (f: Filter) => all.filter((p) => (f === 'alle' ? true : f === 'lopend' ? p.phase_active !== false : p.phase_active === false)).length

  return (
    <section>
      {adding && <NewLead onClose={() => setAdding(false)} />}
      <div className="page-head">
        <div>
          <h1>Projecten</h1>
          <p className="muted">Een aanvraag maakt de klant en het project aan met een projectcode. Gebruik die code in PaletteCAD: elke upload wordt dan een nieuwe versie van dat project.</p>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Zoek op code, klant, gemeente…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
      {q.loading || ph.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">Geen projecten.</p>
      ) : (
        <div className="pcards">
          {rows.map((p) => (
            <ProjectCard key={p.project_id} p={p} phases={ph.data ?? []} onSaved={q.reload} />
          ))}
        </div>
      )}
    </section>
  )
}
