import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { ErrorBox, Stat } from '../../../core/ui'
import { fmtInt, fmtNum } from '../../../core/format'

type Sum = { n_kasten: number; n_objecten: number; n_platen_onderdelen: number; plaat_m2: number; n_materialen: number; kant_m: number; n_lades: number; n_beslag: number; n_werkbladen: number }

/**
 * Aantallen van een versie (kasten, lades, plaatonderdelen, m² plaat, kantenband, beslag, werkbladdelen).
 * 9/11/2026 (Olivier): staat op de projectpagina › Ontwerp › Ontwerpen, boven de lijst met versies (vroeger tabblad Overzicht van de versie).
 */
export function VersionStats({ dvId }: { dvId: string }) {
  const s = useQuery<Sum>(() => supabase.from('app_version_summary').select('*').eq('design_version_id', dvId).single(), [dvId])
  const d = s.data
  return (
    <>
      <ErrorBox error={s.error} />
      <div className="stats">
        <Stat label="kasten" value={d ? fmtInt(d.n_kasten) : '…'} />
        <Stat label="lades" value={d ? fmtInt(d.n_lades) : '…'} />
        <Stat label="plaatonderdelen" value={d ? fmtInt(d.n_platen_onderdelen) : '…'} />
        <Stat label="m² plaat (netto)" value={d ? fmtNum(d.plaat_m2) : '…'} />
        <Stat label="m kantenband" value={d ? fmtNum(d.kant_m) : '…'} />
        <Stat label="beslagartikelen" value={d ? fmtInt(d.n_beslag) : '…'} />
        <Stat label="werkbladdelen" value={d ? fmtInt(d.n_werkbladen) : '…'} />
      </div>
    </>
  )
}
