import { Fragment } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtEur, fmtNum } from '../../../core/format'

type Line = { id: string; category: string; subgroup: string | null; sort: number; description: string; supplier: string | null; article_no: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number; ordered_by: string | null; note: string | null }
type Status = { cost_status: string | null; cost_at: string | null }

export const COST_ORDER = ['Platen', 'Kanten', 'Lades', 'Werkbladen', 'Sanitair', 'Elektriciteit', 'Toestellen', 'Grepen', 'Verbinders & Beslagen', 'Varia', 'Productiekosten']

/** Kostprijs per regel, zoals de tabbladen van de stuklijst. Berekend in Supabase/GitHub, hier alleen getoond. */
export function Kosten({ dvId }: { dvId: string }) {
  const q = useQuery<Line[]>(() => supabase.from('cost_lines').select('*').eq('design_version_id', dvId).order('sort'), [dvId])
  const st = useQuery<Status>(() => supabase.from('design_versions').select('cost_status, cost_at').eq('id', dvId).single(), [dvId])
  if (q.loading) return <Loading />
  const lines = q.data ?? []
  const cats = COST_ORDER.filter((c) => lines.some((l) => l.category === c))
  const total = lines.reduce((s, l) => s + Number(l.total), 0)
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">Kostprijsberekening: {st.data?.cost_status ?? 'nog niet berekend'}</p>
      {cats.map((c) => {
        const ls = lines.filter((l) => l.category === c)
        const subs = [...new Set(ls.map((l) => l.subgroup ?? ''))]
        const sum = ls.reduce((s, l) => s + Number(l.total), 0)
        return (
          <div key={c}>
            <h2>{c} <span className="muted">{fmtEur(sum)}</span></h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Omschrijving</th><th>Leverancier</th><th>Artikel</th><th className="num">Aantal</th><th className="num">Eenheidsprijs</th>
                    <th className="num">Totaal</th><th>Besteld door</th><th>Opmerking</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <Fragment key={s}>
                      {s && (
                        <tr className="subhead"><td colSpan={8}>{s}</td></tr>
                      )}
                      {ls.filter((l) => (l.subgroup ?? '') === s).map((l) => (
                        <tr key={l.id}>
                          <td>{l.description}</td>
                          <td>{l.supplier}</td>
                          <td>{l.article_no}</td>
                          <td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}`}</td>
                          <td className="num">{l.unit_price == null ? '' : fmtEur(l.unit_price)}</td>
                          <td className="num">{fmtEur(l.total)}</td>
                          <td>{l.ordered_by}</td>
                          <td className={l.note?.startsWith('prijs ontbreekt') ? 'warn-text' : 'muted'}>{l.note}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={5}>Totaal {c}</td><td className="num">{fmtEur(sum)}</td><td colSpan={2} /></tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
      {lines.length > 0 && <h2>Projecttotaal (kostprijs) <span>{fmtEur(total)}</span></h2>}
    </>
  )
}
