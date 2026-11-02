import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtDate, fmtInt } from '../../core/format'
import { Compare } from './Compare'
import { ProjectCard, usePhases, type ProjectRow } from '../../core/projects'
import { ClientPanel } from './ClientPanel'
import { SurveyPanel } from './SurveyPanel'
import { LeadActions } from './LeadActions'

export type Version = {
  id: string
  version: number
  received_at: string
  exported_at: string | null
  scene_title: string | null
  n_cabinets: number
  n_parts: number
  n_errors: number
  n_warnings: number
}

export function ProjectDetail() {
  const { code = '' } = useParams()
  const q = useQuery<Version[]>(
    () =>
      supabase
        .from('design_versions')
        .select('id, version, received_at, exported_at, scene_title, n_cabinets, n_parts, n_errors, n_warnings')
        .eq('project_code', code)
        .order('version', { ascending: false }),
    [code],
  )
  const pq = useQuery<ProjectRow[]>(() => supabase.from('app_projects').select('*').eq('project_code', code), [code])
  const ph = usePhases()
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const project = pq.data?.[0]
  const versions = q.data ?? []
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const va = versions.find((v) => v.version === (a ?? versions[1]?.version))
  const vb = versions.find((v) => v.version === (b ?? versions[0]?.version))

  return (
    <section>
      <p className="crumbs">
        <Link to="/projecten">Projecten</Link> / {code}
      </p>
      <h1>Project {code}</h1>
      <ErrorBox error={q.error ?? pq.error} />
      {project && ph.data && (
        <div className="pdetail-top">
          <div className={'pcard-wide' + (focus === 'fase' ? ' focus' : '')}>
            {focus === 'fase' && <p className="notice">Kies rechtsboven in de kaart de fase waarin het project nu zit.</p>}
            <ProjectCard p={project} phases={ph.data} onSaved={pq.reload} />
          </div>
          <ClientPanel project={project} focus={focus === 'fase' || focus === 'survey' ? null : focus} onSaved={pq.reload} />
        </div>
      )}
      {project && <LeadActions p={project} onDone={pq.reload} />}
      {project && <SurveyPanel code={code} focus={focus === 'survey'} />}
      {q.loading ? (
        <Loading />
      ) : (
        <>
          <h2>Versies</h2>
          <DataTable
            rows={versions}
            filter={false}
            rowKey={(r) => r.id}
            columns={[
              { key: 'version', label: 'Versie', render: (r) => <Link to={`/projecten/${encodeURIComponent(code)}/v/${r.version}`}>v{r.version}</Link> },
              { key: 'received_at', label: 'Ontvangen', render: (r) => fmtDate(r.received_at) },
              { key: 'scene_title', label: 'Tekening' },
                            { key: 'n_parts', label: 'Onderdelen', align: 'right', render: (r) => fmtInt(r.n_parts) },
              { key: 'n_errors', label: 'Fouten', align: 'right' },
              { key: 'n_warnings', label: 'Aandachtspunten', align: 'right' },
            ]}
          />
          {versions.length > 1 && va && vb && (
            <>
              <h2>Vergelijken</h2>
              <div className="toolbar">
                <select value={va.version} onChange={(e) => setA(Number(e.target.value))}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.version}>v{v.version}</option>
                  ))}
                </select>
                <span>met</span>
                <select value={vb.version} onChange={(e) => setB(Number(e.target.value))}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.version}>v{v.version}</option>
                  ))}
                </select>
              </div>
              <Compare from={va} to={vb} />
            </>
          )}
        </>
      )}
    </section>
  )
}
