import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtMm } from '../../../core/format'

type Row = { id: string; name: string; family: string | null; width_mm: number; depth_mm: number; height_mm: number; n_parts: number; n_drawers: number; n_items: number }

export function Kasten({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('app_cabinets').select('*').eq('design_version_id', dvId).order('name'), [dvId])
  if (q.loading) return <Loading />
  return (
    <>
      <ErrorBox error={q.error} />
      <DataTable
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Kast' },
          { key: 'family', label: 'Model' },
          { key: 'width_mm', label: 'Breedte (mm)', align: 'right', render: (r) => fmtMm(r.width_mm) },
          { key: 'depth_mm', label: 'Diepte (mm)', align: 'right', render: (r) => fmtMm(r.depth_mm) },
          { key: 'height_mm', label: 'Hoogte (mm)', align: 'right', render: (r) => fmtMm(r.height_mm) },
          { key: 'n_parts', label: 'Platen', align: 'right', total: true },
          { key: 'n_drawers', label: 'Lades', align: 'right', total: true },
          { key: 'n_items', label: 'Beslag', align: 'right', total: true },
        ]}
      />
    </>
  )
}
