import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading, Stat, Tabs } from '../../core/ui'
import { fmtDate, fmtInt } from '../../core/format'
import { versionTabs } from './tabs'

type DV = {
  id: string
  version: number
  received_at: string
  scene_title: string | null
  n_cabinets: number
  n_parts: number
  n_errors: number
  n_warnings: number
  payload: { project?: Record<string, string | undefined> }
}

export function VersionView() {
  const { code = '', version = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = versionTabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : versionTabs[0].id
  const setTab = (id: string) => setParams({ tab: id }, { replace: true })
  const q = useQuery<DV>(
    () =>
      supabase
        .from('design_versions')
        .select('id, version, received_at, scene_title, n_cabinets, n_parts, n_errors, n_warnings, payload->project')
        .eq('project_code', code)
        .eq('version', Number(version))
        .single()
        .then((r) => ({ data: r.data ? ({ ...r.data, payload: { project: (r.data as { project?: Record<string, string> }).project } } as unknown as DV) : null, error: r.error })),
    [code, version],
  )
  const dv = q.data
  const p = dv?.payload.project ?? {}
  const Active = versionTabs.find((t) => t.id === tab)!.component

  return (
    <section>
      <p className="crumbs">
        <Link to="/projecten">Projecten</Link> / <Link to={`/projecten/${encodeURIComponent(code)}`}>{code}</Link> / v{version}
      </p>
      <ErrorBox error={q.error} />
      {q.loading || !dv ? (
        <Loading />
      ) : (
        <>
          <h1>
            {code} {p.customer ? `· ${p.customer}` : ''} <span className="muted">v{dv.version}</span>
          </h1>
          <p className="muted">
            {[dv.scene_title, p.street, p.city, p.drawn_by && `getekend door ${p.drawn_by}`, `ontvangen ${fmtDate(dv.received_at)}`].filter(Boolean).join(' · ')}
          </p>
          <div className="stats">
            <Stat label="getelde objecten" value={fmtInt(dv.n_parts)} />
            <Stat label="fouten" value={dv.n_errors ? <span className="bad-text">{dv.n_errors}</span> : 0} />
            <Stat label="aandachtspunten" value={dv.n_warnings} />
          </div>
          <Tabs tabs={versionTabs.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={setTab} />
          <Active dvId={dv.id} />
        </>
      )}
    </section>
  )
}
