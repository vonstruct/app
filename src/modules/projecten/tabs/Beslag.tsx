import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'

/** own_* = ingevulde prijs (manual_prices, herkend op artikelnummer of naam) met leverancier en zijn artikelnummer (own_ref): telt mee in de kostprijs, ook zonder artikelnummer in PaletteCAD. */
type Row = { category: string | null; name: string; manufacturer: string | null; article_no: string | null; qty: number; own_supplier: string | null; own_article_no: string | null; own_origin: string | null; own_ref: string | null }
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
          { key: 'manufacturer', label: 'Fabrikant', value: (r) => r.manufacturer ?? r.own_supplier ?? '' },
          { key: 'article_no', label: 'Artikelnummer', value: (r) => r.article_no ?? r.own_ref ?? r.own_article_no ?? '', render: (r) => r.article_no ?? r.own_ref ?? r.own_article_no ?? (r.own_origin
            ? <span className="muted small" title="Prijs ingevuld bij Geld › Kostprijs, zonder artikelnummer van de leverancier">nummer niet gekend{r.own_origin !== 'Bestellen' ? ` · ${r.own_origin.toLowerCase()}` : ''}</span>
            : <span className="badge warn">ontbreekt</span>) },
          { key: 'qty', label: 'Aantal', align: 'right', total: true },
        ]}
      />
    </>
  )
}
