import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading, Stat } from '../../../core/ui'
import { fmtDate, fmtInt, fmtNum } from '../../../core/format'
import { Compare } from '../Compare'
import type { Version } from '../ProjectDetail'

type Sum = { n_kasten: number; n_objecten: number; n_platen_onderdelen: number; plaat_m2: number; n_materialen: number; kant_m: number; n_lades: number; n_beslag: number; n_werkbladen: number }

/**
 * Overzicht van een versie: de aantallen, alle versies van het project en wat er veranderde (9/11/2026, Olivier: "de verschillende
 * versies en de verschillen wil ik wel terug kunnen zien"). Standaard: deze versie tegenover de vorige.
 */
export function Overzicht({ dvId }: { dvId: string }) {
  const { code = '', version = '' } = useParams()
  const s = useQuery<Sum>(() => supabase.from('app_version_summary').select('*').eq('design_version_id', dvId).single(), [dvId])
  const vq = useQuery<Version[]>(
    () => supabase.from('design_versions').select('id, version, received_at, exported_at, scene_title, n_cabinets, n_parts, n_errors, n_warnings').eq('project_code', code).order('version', { ascending: false }),
    [code],
  )
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  if (s.loading) return <Loading />
  const d = s.data
  const versions = vq.data ?? []
  const cur = Number(version)
  const prev = versions.find((v) => v.version < cur)?.version ?? null
  const va = versions.find((v) => v.version === (a ?? prev))
  const vb = versions.find((v) => v.version === (b ?? cur))
  return (
    <>
      <ErrorBox error={s.error || vq.error} />
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
      <h2 className="vt-h">Versies</h2>
      <DataTable
        rows={versions}
        filter={false}
        rowKey={(r) => r.id}
        columns={[
          { key: 'version', label: 'Versie', render: (r) => r.version === cur ? <b>v{r.version} (deze)</b> : <Link to={`/projecten/${encodeURIComponent(code)}/v/${r.version}`}>v{r.version}</Link> },
          { key: 'received_at', label: 'Ontvangen', render: (r) => fmtDate(r.received_at) },
          { key: 'scene_title', label: 'Tekening' },
          { key: 'n_parts', label: 'Objecten', align: 'right', render: (r) => fmtInt(r.n_parts) },
          { key: 'n_errors', label: 'Fouten', align: 'right' },
          { key: 'n_warnings', label: 'Aandachtspunten', align: 'right' },
        ]}
      />
      <h2 className="vt-h">Verschillen</h2>
      {versions.length < 2 || !va || !vb ? (
        <p className="muted">Er is nog maar één versie: nog niets om te vergelijken.</p>
      ) : (
        <>
          <div className="toolbar">
            <select value={va.version} onChange={(e) => setA(Number(e.target.value))} aria-label="Van versie">{versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}</select>
            <span>met</span>
            <select value={vb.version} onChange={(e) => setB(Number(e.target.value))} aria-label="Naar versie">{versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}</select>
          </div>
          <Compare from={va} to={vb} />
        </>
      )}
    </>
  )
}
