import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtDate, fmtInt } from '../../core/format'
import { Compare } from './Compare'

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
      <ErrorBox error={q.error} />
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
              { key: 'n_cabinets', label: 'Kasten', align: 'right', render: (r) => fmtInt(r.n_cabinets) },
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
