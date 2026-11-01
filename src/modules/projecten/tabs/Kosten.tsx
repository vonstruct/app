import { Fragment, useState } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtEur, fmtNum } from '../../../core/format'

type Line = { id: string; category: string; subgroup: string | null; sort: number; description: string; supplier: string | null; article_no: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number; ordered_by: string | null; note: string | null }
type Status = { cost_status: string | null; cost_at: string | null }

export const COST_ORDER = ['Platen', 'Kanten', 'Lades', 'Werkbladen', 'Sanitair', 'Elektriciteit', 'Toestellen', 'Grepen', 'Verbinders & Beslagen', 'Varia', 'Productiekosten']

/** Regels waarvan je de prijs zelf kan invullen (beslag, rubrieken, losse Du Pont-onderdelen van lades). */
const editable = (l: Line) =>
  !['Platen', 'Kanten', 'Productiekosten'].includes(l.category) && (l.category !== 'Lades' || l.subgroup === 'Du Pont (apart bestellen)')

/** Eenheidsprijs die je aanklikt en wijzigt. Bewaard als eigen prijs: geldt ook voor alle volgende projecten. */
function PriceCell({ line, onSaved }: { line: Line; onSaved: (msg: string | null) => void }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState('')
  const missing = line.note?.startsWith('prijs ontbreekt')
  const start = () => {
    setVal(missing || line.unit_price == null ? '' : String(line.unit_price).replace('.', ','))
    setEdit(true)
  }
  const save = async () => {
    setEdit(false)
    const v = val.trim().replace(',', '.')
    if (v === '' || isNaN(Number(v))) return
    if (!missing && Number(v) === Number(line.unit_price)) return
    const { error } = await supabase.rpc('set_manual_price', {
      p_article_no: line.article_no ?? '', p_description: line.description, p_supplier: line.supplier, p_price: Number(v),
    })
    onSaved(error ? error.message : `Prijs voor "${line.description}" bewaard. Geldt ook voor volgende projecten.`)
  }
  if (edit)
    return (
      <input autoFocus className="price-input" inputMode="decimal" value={val} placeholder="€ per stuk"
        onChange={(e) => setVal(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
    )
  return (
    <button type="button" className={missing ? 'price-btn missing' : 'price-btn'} onClick={start} title="Prijs aanpassen">
      {missing ? 'prijs invullen' : line.unit_price == null ? '' : fmtEur(line.unit_price)}
    </button>
  )
}

/** Kostprijs per regel, zoals de tabbladen van de stuklijst. Berekend in Supabase/GitHub, hier alleen getoond. */
export function Kosten({ dvId }: { dvId: string }) {
  const q = useQuery<Line[]>(() => supabase.from('cost_lines').select('*').eq('design_version_id', dvId).order('sort'), [dvId])
  const st = useQuery<Status>(() => supabase.from('design_versions').select('cost_status, cost_at').eq('id', dvId).single(), [dvId])
  const [msg, setMsg] = useState<string | null>(null)
  if (q.loading && !q.data) return <Loading />
  const lines = q.data ?? []
  const cats = COST_ORDER.filter((c) => lines.some((l) => l.category === c))
  const total = lines.reduce((s, l) => s + Number(l.total), 0)
  const onSaved = (m: string | null) => { setMsg(m); q.reload() }
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">Kostprijsberekening: {st.data?.cost_status ?? 'nog niet berekend'}. Klik op een eenheidsprijs bij beslag om ze aan te passen.</p>
      {msg && <p className="notice">{msg}</p>}
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
                          <td className="num">{editable(l) ? <PriceCell line={l} onSaved={onSaved} /> : l.unit_price == null ? '' : fmtEur(l.unit_price)}</td>
                          <td className="num">{fmtEur(l.total)}</td>
                          <td>{l.ordered_by}</td>
                          <td className={l.note?.startsWith('prijs ontbreekt') ? 'warn-text' : l.note === 'eigen prijs' ? 'ok-text' : 'muted'}>{l.note}</td>
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
