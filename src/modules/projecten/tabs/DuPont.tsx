import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'

type Row = { description: string; article_no: string | null; qty: number }

export function DuPont({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('bom_drawer_dupont_lines').select('*').eq('design_version_id', dvId), [dvId])
  if (q.loading) return <Loading />
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">Lade-onderdelen die apart bij Du Pont besteld worden (Movento-tabletlades). Regels: menu Regels.</p>
      <DataTable
        rows={q.data ?? []}
        filter={false}
        empty="Geen Du Pont-regels voor lades in deze versie"
        columns={[
          { key: 'description', label: 'Omschrijving' },
          { key: 'article_no', label: 'Artikelnummer' },
          { key: 'qty', label: 'Aantal', align: 'right', total: true },
        ]}
      />
    </>
  )
}
