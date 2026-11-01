import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtNum } from '../../core/format'
import type { Version } from './ProjectDetail'

type Line = { group: string; item: string; unit: string; from: number; to: number }

/** Verschillen tussen twee versies: kasten, platen, kanten en beslag (alleen wat veranderde). */
export function Compare({ from, to }: { from: Version; to: Version }) {
  const ids = [from.id, to.id]
  const q = useQuery<Line[]>(async () => {
    const [cab, parts, edges, items] = await Promise.all([
      supabase.from('bom_cabinets').select('design_version_id, name').in('design_version_id', ids),
      supabase.from('app_parts_summary').select('design_version_id, material_label, thickness_mm, n_parts').in('design_version_id', ids),
      supabase.from('bom_edges').select('design_version_id, edge_label, edge_thickness_mm, board_thickness_mm, length_mm').in('design_version_id', ids),
      supabase.from('app_items_summary').select('design_version_id, name, article_no, qty').in('design_version_id', ids),
    ])
    const err = cab.error || parts.error || edges.error || items.error
    if (err) return { data: null, error: err }
    const map = new Map<string, Line>()
    const add = (group: string, item: string, unit: string, dv: string, n: number) => {
      const k = group + '|' + item
      const l = map.get(k) ?? { group, item, unit, from: 0, to: 0 }
      if (dv === from.id) l.from += n
      if (dv === to.id) l.to += n
      map.set(k, l)
    }
    for (const r of cab.data ?? []) add('Kasten', r.name ?? '?', 'stuks', r.design_version_id, 1)
    for (const r of parts.data ?? []) add('Platen', `${r.material_label ?? '?'} ${fmtNum(r.thickness_mm)} mm`, 'onderdelen', r.design_version_id, Number(r.n_parts))
    for (const r of edges.data ?? [])
      add('Kanten', `${r.edge_label ?? '?'} ${fmtNum(r.edge_thickness_mm)} mm, plaat ${fmtNum(r.board_thickness_mm)} mm`, 'm', r.design_version_id, Number(r.length_mm) / 1000)
    for (const r of items.data ?? []) add('Beslag', `${r.name ?? '?'}${r.article_no ? ' (' + r.article_no + ')' : ''}`, 'stuks', r.design_version_id, Number(r.qty))
    const lines = [...map.values()].filter((l) => Math.abs(l.to - l.from) > 0.05)
    return { data: lines, error: null }
  }, [from.id, to.id])

  if (q.loading) return <Loading />
  return (
    <>
      <ErrorBox error={q.error} />
      <DataTable
        rows={q.data ?? []}
        empty={`Geen verschillen tussen v${from.version} en v${to.version}`}
        columns={[
          { key: 'group', label: 'Soort' },
          { key: 'item', label: 'Wat' },
          { key: 'from', label: `v${from.version}`, align: 'right', render: (r) => fmtNum(r.from) },
          { key: 'to', label: `v${to.version}`, align: 'right', render: (r) => fmtNum(r.to) },
          {
            key: 'diff',
            label: 'Verschil',
            align: 'right',
            value: (r) => r.to - r.from,
            render: (r) => <span className={r.to > r.from ? 'up' : 'down'}>{(r.to > r.from ? '+' : '') + fmtNum(r.to - r.from)} {r.unit}</span>,
          },
        ]}
      />
    </>
  )
}
