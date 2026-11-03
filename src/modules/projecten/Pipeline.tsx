import { Link } from 'react-router'
import { fmtEur } from '../../core/format'
import type { Phase, ProjectRow } from '../../core/projects'

/** Pijplijn: projecten per stage gate (stond vroeger op de control tower). */
export function Pipeline({ projects, gates }: { projects: ProjectRow[]; gates: Phase[] }) {
  return (
    <div className="pipeline" style={{ gridTemplateColumns: `repeat(${gates.length}, minmax(170px, 1fr))` }}>
      {gates.map((g, i) => {
        const list = projects.filter((p) => (p.stage ?? p.phase) === g.phase)
        return (
          <div key={g.phase} className={'lane' + (list.length ? '' : ' empty')}>
            <div className="lane-head">
              <span><em>{i + 1}</em> {g.label}</span>
              <span className="lane-n">{list.length}</span>
            </div>
            {list.map((p) => (
              <Link key={p.project_id} to={`/projecten/${encodeURIComponent(p.project_code)}`} className="lane-card">
                <strong>{p.project_code}{p.phase === 'lead' && <span className="pcard-new">nieuw</span>}</strong>
                <span>{p.client_name}</span>
                {p.cost_total != null && <span className="muted">{fmtEur(p.cost_total)}</span>}
              </Link>
            ))}
            {g.gate && <p className="lane-gate">{g.gate}</p>}
          </div>
        )
      })}
    </div>
  )
}
