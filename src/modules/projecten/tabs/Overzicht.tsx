import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { ErrorBox, Loading, Stat } from '../../../core/ui'
import { fmtInt, fmtNum } from '../../../core/format'

type Sum = { n_kasten: number; n_objecten: number; n_platen_onderdelen: number; plaat_m2: number; n_materialen: number; kant_m: number; n_lades: number; n_beslag: number; n_werkbladen: number }

/** Hoog niveau van een versie: enkel de aantallen (9 nov 2026: objecten per soort en de kostprijsregel weg, op vraag van Olivier). */
export function Overzicht({ dvId }: { dvId: string }) {
  const s = useQuery<Sum>(() => supabase.from('app_version_summary').select('*').eq('design_version_id', dvId).single(), [dvId])
  if (s.loading) return <Loading />
  const d = s.data
  return (
    <>
      <ErrorBox error={s.error} />
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
    </>
  )
}
