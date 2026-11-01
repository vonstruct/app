import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading, Stat } from '../../../core/ui'
import { fmtEur, fmtInt, fmtNum } from '../../../core/format'

type Sum = { n_kasten: number; n_objecten: number; n_platen_onderdelen: number; plaat_m2: number; n_materialen: number; kant_m: number; n_lades: number; n_beslag: number; n_werkbladen: number }
type Cost = { category: string; sort: number; total: number; n_missing: number }
type Kind = { kind_label: string; kind_prio: number; name: string }

/** Hoog niveau van een versie. De kostenposten (zoals Projectkosten in de stuklijst) komen hier zodra Supabase ze berekent. */
export function Overzicht({ dvId }: { dvId: string }) {
  const s = useQuery<Sum>(() => supabase.from('app_version_summary').select('*').eq('design_version_id', dvId).single(), [dvId])
  const c = useQuery<Cost[]>(() => supabase.from('app_cost_summary').select('*').eq('design_version_id', dvId), [dvId])
  const k = useQuery<Kind[]>(() => supabase.from('app_cabinets').select('kind_label, kind_prio, name').eq('design_version_id', dvId), [dvId])
  if (s.loading || k.loading) return <Loading />
  const d = s.data
  const groups = new Map<string, { label: string; prio: number; n: number }>()
  for (const r of k.data ?? []) {
    const g = groups.get(r.kind_label) ?? { label: r.kind_label, prio: r.kind_prio, n: 0 }
    g.n++
    groups.set(r.kind_label, g)
  }
  return (
    <>
      <ErrorBox error={s.error || k.error} />
      {d && (
        <div className="stats">
          <Stat label="kasten" value={fmtInt(d.n_kasten)} />
          <Stat label="lades" value={fmtInt(d.n_lades)} />
          <Stat label="plaatonderdelen" value={fmtInt(d.n_platen_onderdelen)} />
          <Stat label="m² plaat (netto)" value={fmtNum(d.plaat_m2)} />
          <Stat label="m kantenband" value={fmtNum(d.kant_m)} />
          <Stat label="beslagartikelen" value={fmtInt(d.n_beslag)} />
          <Stat label="werkbladdelen" value={fmtInt(d.n_werkbladen)} />
        </div>
      )}
      <h2>Objecten in de tekening</h2>
      <DataTable
        rows={[...groups.values()].sort((a, b) => a.prio - b.prio)}
        filter={false}
        columns={[
          { key: 'label', label: 'Soort' },
          { key: 'n', label: 'Aantal', align: 'right', total: true },
        ]}
      />
      <h2>Projectkosten (kostprijs)</h2>
      <DataTable
        rows={(c.data ?? []).sort((a, b) => a.sort - b.sort)}
        filter={false}
        empty="Nog niet berekend"
        columns={[
          { key: 'category', label: 'Rubriek' },
          { key: 'total', label: 'Totaal', align: 'right', total: true, value: (r) => Number(r.total), render: (r) => fmtEur(r.total) },
          { key: 'n_missing', label: 'Opmerking', render: (r) => (r.n_missing ? <span className="warn-text">{r.n_missing} zonder prijs</span> : '') },
        ]}
      />
    </>
  )
}
