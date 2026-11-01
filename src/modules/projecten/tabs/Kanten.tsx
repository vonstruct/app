import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtNum } from '../../../core/format'

type Row = { edge_label: string; article_no: string | null; edge_thickness_mm: number; board_thickness_mm: number; n_edges: number; length_mm: number; raw_length_mm: number }

export function Kanten({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('bom_edges').select('*').eq('design_version_id', dvId).order('length_mm', { ascending: false }), [dvId])
  if (q.loading) return <Loading />
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">Kantbreedte = plaatdikte (zweef en bestelbreedte 23/33/43 mm volgen in Supabase).</p>
      <DataTable
        rows={q.data ?? []}
        columns={[
          { key: 'edge_label', label: 'Kantmateriaal' },
          { key: 'edge_thickness_mm', label: 'Dikte (mm)', align: 'right', render: (r) => fmtNum(r.edge_thickness_mm) },
          { key: 'board_thickness_mm', label: 'Plaatdikte (mm)', align: 'right', render: (r) => fmtNum(r.board_thickness_mm) },
          { key: 'n_edges', label: 'Kanten', align: 'right', total: true },
          { key: 'm', label: 'Lopende meter', align: 'right', total: true, value: (r) => Number(r.raw_length_mm) / 1000, render: (r) => fmtNum(Number(r.raw_length_mm) / 1000) },
        ]}
      />
    </>
  )
}
