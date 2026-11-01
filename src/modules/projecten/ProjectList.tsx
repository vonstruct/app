import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtDate, fmtInt } from '../../core/format'

type Row = {
  project_code: string
  project_title: string | null
  customer: string | null
  scene_title: string | null
  n_versions: number
  last_version: number
  last_received: string
  n_cabinets: number
  n_parts: number
  n_errors: number
  n_warnings: number
}

export function ProjectList() {
  const q = useQuery<Row[]>(() => supabase.from('app_project_overview').select('*').order('last_received', { ascending: false }), [])
  return (
    <section>
      <h1>Projecten</h1>
      <p className="muted">Elke klik op Supabase in de stuklijst Vonstruct_Export maakt een nieuwe versie.</p>
      <ErrorBox error={q.error} />
      {q.loading ? (
        <Loading />
      ) : (
        <DataTable
          rows={q.data ?? []}
          rowKey={(r) => r.project_code}
          empty="Nog geen exports"
          columns={[
            { key: 'project_code', label: 'Project', render: (r) => <Link to={`/projecten/${encodeURIComponent(r.project_code)}`}>{r.project_code}</Link> },
            { key: 'customer', label: 'Klant' },
            { key: 'scene_title', label: 'Tekening' },
            { key: 'last_version', label: 'Laatste versie', align: 'right', render: (r) => <Link to={`/projecten/${encodeURIComponent(r.project_code)}/v/${r.last_version}`}>v{r.last_version}</Link> },
            { key: 'last_received', label: 'Ontvangen', render: (r) => fmtDate(r.last_received) },
            { key: 'n_cabinets', label: 'Kasten', align: 'right', render: (r) => fmtInt(r.n_cabinets) },
            { key: 'n_parts', label: 'Onderdelen', align: 'right', render: (r) => fmtInt(r.n_parts) },
            { key: 'n_errors', label: 'Fouten', align: 'right', render: (r) => (r.n_errors ? <span className="badge bad">{r.n_errors}</span> : '0') },
          ]}
        />
      )}
    </section>
  )
}
