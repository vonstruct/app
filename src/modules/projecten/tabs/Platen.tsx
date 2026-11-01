import { useState } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtEur, fmtMm, fmtNum } from '../../../core/format'

type Sheet = { id: string; material_label: string; thickness_mm: number; length_mm: number; width_mm: number; qty: number; yield_pct: number | null; price_per_sheet: number | null; format_source: string | null; article_no: string | null; ordered_by: string | null; cost: number }
type Opt = { optimizer_status: string | null; optimizer_at: string | null; cutplan_path: string | null }

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
  const sheets = useQuery<Sheet[]>(() => supabase.from('app_sheets').select('*').eq('design_version_id', dvId).order('material_label'), [dvId])
  const opt = useQuery<Opt>(() => supabase.from('design_versions').select('optimizer_status, optimizer_at, cutplan_path').eq('id', dvId).single(), [dvId])
  // zaagplan: in de pagina tonen (een nieuw venster na het laden wordt door browsers vaak geblokkeerd)
  const [plan, setPlan] = useState<{ html: string | null; busy: boolean; error: string | null }>({ html: null, busy: false, error: null })
  const togglePlan = async () => {
    if (plan.html) return setPlan({ html: null, busy: false, error: null })
    if (!opt.data?.cutplan_path) return
    setPlan({ html: null, busy: true, error: null })
    const { data, error } = await supabase.storage.from('bom-exports').download(opt.data.cutplan_path)
    if (error || !data) return setPlan({ html: null, busy: false, error: 'Zaagplan laden mislukt: ' + (error?.message ?? 'leeg bestand') })
    setPlan({ html: await data.text(), busy: false, error: null })
  }
  const printPlan = () => {
    const f = document.getElementById('zaagplan') as HTMLIFrameElement | null
    f?.contentWindow?.print()
  }
  const sum = useQuery<Sum[]>(() => supabase.from('app_parts_summary').select('*').eq('design_version_id', dvId), [dvId])
  const parts = useQuery<Part[]>(
    () => (detail ? supabase.from('app_parts').select('id, cabinet_name, name, part_no, material_label, length_mm, width_mm, thickness_mm, grain, edges, fixchips, count_flags').eq('design_version_id', dvId).order('seq') : Promise.resolve({ data: [], error: null })),
    [dvId, detail],
  )
  if (sum.loading) return <Loading />
  return (
    <>
      <ErrorBox error={sum.error || parts.error || sheets.error} />
      <h2>Platen te bestellen</h2>
      <div className="toolbar">
        <span className="muted">Plaatoptimalisatie: {opt.data?.optimizer_status ?? '…'}</span>
        {opt.data?.cutplan_path && (
          <button onClick={togglePlan} disabled={plan.busy}>{plan.busy ? 'Laden…' : plan.html ? 'Zaagplan verbergen' : 'Zaagplan tonen'}</button>
        )}
        {plan.html && <button onClick={printPlan}>Afdrukken / PDF</button>}
      </div>
      <ErrorBox error={plan.error} />
      {plan.html && <iframe id="zaagplan" className="cutplan" title="Zaagplan" srcDoc={plan.html} />}
      <DataTable
        rows={sheets.data ?? []}
        rowKey={(r) => r.id}
        filter={false}
        empty="Nog geen resultaat van de plaatoptimalisatie"
        columns={[
          { key: 'material_label', label: 'Materiaal' },
          { key: 'thickness_mm', label: 'Dikte (mm)', align: 'right', render: (r) => fmtNum(r.thickness_mm) },
          { key: 'format', label: 'Formaat (mm)', value: (r) => `${fmtNum(r.length_mm, 0)} × ${fmtNum(r.width_mm, 0)}` },
          { key: 'qty', label: 'Platen', align: 'right', total: true },
          { key: 'yield_pct', label: 'Benutting', align: 'right', render: (r) => (r.yield_pct == null ? '' : `${fmtNum(r.yield_pct, 0)} %`) },
          { key: 'price_per_sheet', label: 'Prijs per plaat', align: 'right', render: (r) => fmtEur(r.price_per_sheet) },
          { key: 'cost', label: 'Totaal', align: 'right', total: true, value: (r) => Number(r.cost), render: (r) => fmtEur(r.cost) },
          { key: 'format_source', label: 'Leverancier' },
          { key: 'ordered_by', label: 'Besteld door' },
        ]}
      />
      <h2>Onderdelen per materiaal</h2>
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
