import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'

type Row = { category: string | null; name: string; manufacturer: string | null; article_no: string | null; qty: number }
const CAT: Record<string, string> = { LA: 'Lades', WB: 'Werkblad', SA: 'Sanitair', EL: 'Elektriciteit', TO: 'Toestellen', GR: 'Grepen', VA: 'Varia' }

export function Beslag({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('app_items_summary').select('*').eq('design_version_id', dvId).neq('category', 'LA').order('qty', { ascending: false }), [dvId])
  const q2 = useQuery<Row[]>(() => supabase.from('app_items_summary').select('*').eq('design_version_id', dvId).is('category', null).order('qty', { ascending: false }), [dvId])
  if (q.loading || q2.loading) return <Loading />
  const rows = [...(q2.data ?? []), ...(q.data ?? [])]
  return (
    <>
      <ErrorBox error={q.error || q2.error} />
      <DataTable
        rows={rows}
        columns={[
          { key: 'category', label: 'Rubriek', value: (r) => (r.category ? CAT[r.category] ?? r.category : 'Beslag') },
          { key: 'name', label: 'Artikel' },
          { key: 'manufacturer', label: 'Fabrikant' },
          { key: 'article_no', label: 'Artikelnummer', render: (r) => r.article_no ?? <span className="badge warn">ontbreekt</span> },
          { key: 'qty', label: 'Aantal', align: 'right', total: true },
        ]}
      />
    </>
  )
}
