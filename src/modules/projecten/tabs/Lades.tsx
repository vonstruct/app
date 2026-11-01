import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtMm } from '../../../core/format'

type Row = { id: string; cabinet_name: string | null; base_name: string; soort: string | null; hoogte: string | null; zijkant: string; tip_on: string | null; kleur: string | null; inlegmat: string | null; n_opvul: number; nl_order: number | null; is_movento: boolean; article_no: string | null; size_x_mm: number; size_y_mm: number }

export function Lades({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('app_drawers').select('*').eq('design_version_id', dvId).order('cabinet_name'), [dvId])
  if (q.loading) return <Loading />
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">Bestellengte (NL): diepte − 7 mm (Movento − 26 mm), afgerond naar de standaardlengte eronder. Zijkant leeg = M bij hoogte D en C.</p>
      <DataTable
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        columns={[
          { key: 'cabinet_name', label: 'Kast' },
          { key: 'base_name', label: 'Lade' },
          { key: 'soort', label: 'Soort' },
          { key: 'hoogte', label: 'Hoogte' },
          { key: 'zijkant', label: 'Zijkant' },
          { key: 'tip_on', label: 'Tip-On' },
          { key: 'inlegmat', label: 'Inlegmat' },
          { key: 'size_x_mm', label: 'Breedte (mm)', align: 'right', render: (r) => fmtMm(r.size_x_mm) },
          { key: 'nl_order', label: 'NL', align: 'right' },
          { key: 'n_opvul', label: 'Opvullijsten', align: 'right', total: true },
          { key: 'article_no', label: 'Artikel', render: (r) => r.article_no ?? (r.is_movento ? 'Du Pont-regels' : '') },
        ]}
      />
    </>
  )
}
