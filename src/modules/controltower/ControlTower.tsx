import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur, fmtInt } from '../../core/format'
import { gatesOf, relDays, usePhases, useProjects, type Phase, type ProjectRow } from '../../core/projects'

type Flag = { prio: 1 | 2 | 3; kind: string; project_code: string | null; last_version: number | null; ref: string | null; title: string; detail: string | null; since: string | null }
type Supplier = { supplier_name: string; n_articles: number; last_update: string; days_old: number }

const PRIO = { 1: 'Nu doen', 2: 'Binnenkort', 3: 'Ter info' } as const

export function ControlTower() {
  const flags = useQuery<Flag[]>(() => supabase.from('app_control_tower').select('*').order('prio').order('since', { ascending: false }), [])
  const projects = useProjects()
  const phases = usePhases()
  const sup = useQuery<Supplier[]>(() => supabase.from('app_supplier_freshness').select('*').order('supplier_name'), [])
  const loading = flags.loading || projects.loading || phases.loading
  const ps = projects.data ?? []
  const active = ps.filter((p) => p.phase_active !== false)
  const fl = flags.data ?? []
  const openValue = active.reduce((s, p) => s + (p.cost_total ?? 0), 0)
  const oldest = (sup.data ?? []).reduce((m, s) => Math.max(m, s.days_old), 0)
  const recent = [...ps].filter((p) => p.last_received).sort((a, b) => (b.last_received ?? '').localeCompare(a.last_received ?? '')).slice(0, 5)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  /** Waar je het punt oplost, en wat er op de knop staat. */
  const actionFor = (f: Flag): { to: string; label: string } => {
    const proj = f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}` : '/projecten'
    const ver = f.last_version ? `${proj}/v/${f.last_version}` : proj
    switch (f.kind) {
      case 'prijzen': return { to: `${ver}?tab=kosten&focus=prijzen`, label: 'Prijzen invullen' }
      case 'kosten': return { to: `${ver}?tab=kosten`, label: 'Kosten bekijken' }
      case 'optimalisatie': return { to: `${ver}?tab=platen`, label: 'Platen bekijken' }
      case 'stuklijst_fout': return { to: `${ver}?tab=controle`, label: 'Fouten bekijken' }
      case 'stuklijst_opm': return { to: `${ver}?tab=controle`, label: 'Opmerkingen bekijken' }
      case 'klant_email': return { to: `${proj}?focus=email`, label: 'E-mail invullen' }
      case 'partner_email': return { to: `/relaties?tab=partners&focus=${f.ref}:email`, label: 'E-mail invullen' }
      case 'stilstand': return { to: `${proj}?focus=fase`, label: 'Fase aanpassen' }
      case 'leverancier': return { to: '/regels', label: 'Regels bekijken' }
      default: return { to: proj, label: 'Openen' }
    }
  }

  return (
    <section className="ct">
      <div className="page-head">
        <div>
          <h1>{greet}, Olivier</h1>
          <p className="muted">{new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
      <ErrorBox error={flags.error ?? projects.error ?? phases.error ?? sup.error} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Lopende projecten" value={fmtInt(active.length)} />
            <Kpi label="Nu doen" value={fmtInt(fl.filter((f) => f.prio === 1).length)} tone={fl.some((f) => f.prio === 1) ? 'bad' : 'ok'} />
            <Kpi label="Binnenkort" value={fmtInt(fl.filter((f) => f.prio === 2).length)} tone={fl.some((f) => f.prio === 2) ? 'warn' : 'ok'} />
            <Kpi label="Materiaalraming lopend" value={fmtEur(openValue)} />
            <Kpi label="Oudste prijsupdate leverancier" value={oldest <= 1 ? 'actueel' : `${oldest} dagen`} tone={oldest > 35 ? 'warn' : 'ok'} />
          </div>

          <div className="ct-grid">
            <div className="panel">
              <h2>Aandacht nodig</h2>
              {fl.length === 0 ? (
                <p className="muted">Alles in orde. Er vraagt niets je aandacht.</p>
              ) : (
                ([1, 2, 3] as const).map((prio) => {
                  const list = fl.filter((f) => f.prio === prio)
                  if (!list.length) return null
                  return (
                    <div key={prio} className="flag-group">
                      <h3 className={'prio p' + prio}>
                        {PRIO[prio]} <span>{list.length}</span>
                      </h3>
                      <ul className="flags">
                        {list.map((f, i) => {
                          const act = actionFor(f)
                          return (
                          <li key={i}>
                            <Link to={act.to} className="flag">
                              <span className={'dot p' + f.prio} />
                              <span className="flag-main">
                                <strong>{f.title}</strong>
                                <span className="muted">
                                  {f.project_code ? `${f.project_code} · ` : ''}
                                  {f.detail}
                                </span>
                              </span>
                              <span className="flag-side">
                                <span className="flag-act">{act.label} →</span>
                                <span className="flag-when muted">{relDays(f.since)}</span>
                              </span>
                            </Link>
                          </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })
              )}
            </div>

            <div className="ct-side">
              <div className="panel">
                <h2>Laatste uploads</h2>
                {recent.length === 0 ? (
                  <p className="muted">Nog geen uploads.</p>
                ) : (
                  <ul className="mini">
                    {recent.map((p) => (
                      <li key={p.project_id}>
                        <Link to={`/projecten/${encodeURIComponent(p.project_code)}/v/${p.last_version}`}>
                          {p.project_code} v{p.last_version}
                        </Link>
                        <span className="muted">{p.client_name}</span>
                        <span className="muted right">{relDays(p.last_received)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="panel">
                <h2>Leveranciersprijzen</h2>
                <ul className="mini">
                  {(sup.data ?? []).map((s) => (
                    <li key={s.supplier_name}>
                      <span>{s.supplier_name}</span>
                      <span className="muted">{fmtInt(s.n_articles)} art.</span>
                      <span className={'right ' + (s.days_old > 35 ? 'warn-text' : 'muted')}>{relDays(s.last_update)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <h2 className="ct-h">Pijplijn</h2>
          <Pipeline projects={active} gates={gatesOf(phases.data ?? [])} />
        </>
      )}
    </section>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={'kpi' + (tone ? ' ' + tone : '')}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

function Pipeline({ projects, gates }: { projects: ProjectRow[]; gates: Phase[] }) {
  return (
    <div className="pipeline" style={{ gridTemplateColumns: `repeat(${gates.length}, minmax(170px, 1fr))` }}>
      {gates.map((g, i) => {
        const list = projects.filter((p) => (p.stage ?? p.phase) === g.phase)
        return (
          <div key={g.phase} className={'lane' + (list.length ? '' : ' empty')}>
            <div className="lane-head">
              <span>
                <em>{i + 1}</em> {g.label}
              </span>
              <span className="lane-n">{list.length}</span>
            </div>
            {list.map((p) => (
              <Link key={p.project_id} to={`/projecten/${encodeURIComponent(p.project_code)}`} className="lane-card">
                <strong>{p.project_code}</strong>
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
