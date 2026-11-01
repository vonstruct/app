import { useState } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtMm } from '../../../core/format'

type Row = { id: string; name: string; kind: string; kind_label: string; kind_prio: number; catalog_file: string | null; width_mm: number; depth_mm: number; height_mm: number; n_parts: number; n_drawers: number; n_items: number }

/** Kasten (catalogus ...\Kasten) en daaronder de andere objecten (plinten, paslatten, greeplijsten ...). Soort = regel in Supabase. */
export function Kasten({ dvId }: { dvId: string }) {
  const [all, setAll] = useState(false)
  const q = useQuery<Row[]>(() => supabase.from('app_cabinets').select('*').eq('design_version_id', dvId).order('name'), [dvId])
  if (q.loading) return <Loading />
  const rows = q.data ?? []
  const kasten = rows.filter((r) => r.kind === 'kast')
  const other = rows.filter((r) => r.kind !== 'kast')
  const cols = (withKind: boolean) => [
    ...(withKind ? [{ key: 'kind_label', label: 'Soort' }] : []),
    { key: 'name', label: withKind ? 'Object' : 'Kast' },
    { key: 'catalog_file', label: 'Catalogus' },
    { key: 'width_mm', label: 'Breedte (mm)', align: 'right' as const, render: (r: Row) => fmtMm(r.width_mm) },
    { key: 'depth_mm', label: 'Diepte (mm)', align: 'right' as const, render: (r: Row) => fmtMm(r.depth_mm) },
    { key: 'height_mm', label: 'Hoogte (mm)', align: 'right' as const, render: (r: Row) => fmtMm(r.height_mm) },
    { key: 'n_parts', label: 'Platen', align: 'right' as const, total: true },
    { key: 'n_drawers', label: 'Lades', align: 'right' as const, total: true },
    { key: 'n_items', label: 'Beslag', align: 'right' as const, total: true },
  ]
  return (
    <>
      <ErrorBox error={q.error} />
      <DataTable rows={kasten} rowKey={(r) => r.id} columns={cols(false)} />
      <button className="link" onClick={() => setAll(!all)}>
        {all ? 'Andere objecten verbergen' : `Andere objecten tonen (${other.length}: plinten, paslatten, greeplijsten …)`}
      </button>
      {all && <DataTable rows={other} rowKey={(r) => r.id} columns={cols(true)} />}
    </>
  )
}
