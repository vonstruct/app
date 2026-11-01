import { useState } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtMm, fmtNum } from '../../../core/format'

type Sum = { material_label: string | null; thickness_mm: number; n_parts: number; area_m2: number }
type Part = {
  id: string; cabinet_name: string | null; name: string; part_no: string | null; material_label: string | null
  length_mm: number; width_mm: number; thickness_mm: number; grain: boolean | null; edges: Record<string, { label?: string; thickness?: number } | null> | null
  fixchips: unknown[] | null; count_flags: string | null
}

const edgeShort = (e: Part['edges'], side: string) => {
  const x = e?.[side]
  return x && x.label ? `${fmtNum(x.thickness)}` : ''
}

export function Platen({ dvId }: { dvId: string }) {
  const [detail, setDetail] = useState(false)
  const sum = useQuery<Sum[]>(() => supabase.from('app_parts_summary').select('*').eq('design_version_id', dvId), [dvId])
  const parts = useQuery<Part[]>(
    () => (detail ? supabase.from('app_parts').select('id, cabinet_name, name, part_no, material_label, length_mm, width_mm, thickness_mm, grain, edges, fixchips, count_flags').eq('design_version_id', dvId).order('seq') : Promise.resolve({ data: [], error: null })),
    [dvId, detail],
  )
  if (sum.loading) return <Loading />
  return (
    <>
      <ErrorBox error={sum.error || parts.error} />
      <p className="muted">Onderdelen per materiaal. Het aantal platen volgt na de plaatoptimalisatie.</p>
      <DataTable
        rows={sum.data ?? []}
        columns={[
          { key: 'material_label', label: 'Materiaal' },
          { key: 'thickness_mm', label: 'Dikte (mm)', align: 'right', render: (r) => fmtNum(r.thickness_mm) },
          { key: 'n_parts', label: 'Onderdelen', align: 'right', total: true },
          { key: 'area_m2', label: 'Oppervlakte (m²)', align: 'right', total: true, render: (r) => fmtNum(r.area_m2, 2) },
        ]}
      />
      <button className="link" onClick={() => setDetail(!detail)}>
        {detail ? 'Onderdelen verbergen' : 'Alle onderdelen tonen'}
      </button>
      {detail &&
        (parts.loading ? (
          <Loading />
        ) : (
          <DataTable
            rows={parts.data ?? []}
            rowKey={(r) => r.id}
            columns={[
              { key: 'part_no', label: 'Nr', align: 'right', value: (r) => Number(r.part_no) || r.part_no },
              { key: 'cabinet_name', label: 'Kast' },
              { key: 'name', label: 'Onderdeel' },
              { key: 'material_label', label: 'Materiaal' },
              { key: 'length_mm', label: 'Lengte', align: 'right', render: (r) => fmtMm(r.length_mm) },
              { key: 'width_mm', label: 'Breedte', align: 'right', render: (r) => fmtMm(r.width_mm) },
              { key: 'thickness_mm', label: 'Dikte', align: 'right', render: (r) => fmtMm(r.thickness_mm) },
              { key: 'grain', label: 'Nerf', render: (r) => (r.grain ? 'ja' : '') },
              { key: 'edges', label: 'Kanten r/b/l/o (mm)', value: (r) => ['right', 'top', 'left', 'bottom'].map((s) => edgeShort(r.edges, s) || '-').join(' / ') },
              { key: 'fixchips', label: 'Fixchips', align: 'right', value: (r) => (r.fixchips ?? []).length || '' },
            ]}
          />
        ))}
    </>
  )
}
