import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtEur, fmtNum, parseAmount } from '../../../core/format'
import { OwnArticleEditor } from '../../../core/OwnArticle'
import { ItemWhere } from '../../../core/ItemWhere'

type Line = { id: string; category: string; subgroup: string | null; sort: number; description: string; supplier: string | null; article_no: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number; ordered_by: string | null; note: string | null }
type Status = { cost_status: string | null; cost_at: string | null }

/**
 * Rubrieken van de kostprijs, in de volgorde en met de namen van de stuklijst in PaletteCAD (9/11/2026, Olivier: "ik had graag dit gezien":
 * Kasten Overzicht · Platen · Kanten · Lades · Werkbladen · Sanitair · Elektriciteit · Toestellen · Grepen · Verbinders & Beslagen · Varia ·
 * Productiekosten · Projectkosten). tab = het tabblad van de versie waar de rubriek staat. "Zelf maken" staat in de rubriek van herkomst
 * (subgroup), "Uitbesteed" bij Platen.
 */
export const RUBRIEKEN: { tab: string; cat: string }[] = [
  { tab: 'platen', cat: 'Platen' }, { tab: 'platen', cat: 'Uitbesteed' }, { tab: 'kanten', cat: 'Kanten' }, { tab: 'lades', cat: 'Lades' },
  { tab: 'werkbladen', cat: 'Werkbladen' }, { tab: 'sanitair', cat: 'Sanitair' }, { tab: 'elektriciteit', cat: 'Elektriciteit' },
  { tab: 'toestellen', cat: 'Toestellen' }, { tab: 'grepen', cat: 'Grepen' }, { tab: 'beslag', cat: 'Verbinders & Beslagen' },
  { tab: 'varia', cat: 'Varia' }, { tab: 'productiekosten', cat: 'Productiekosten' },
]
const missing = (l: Line) => !!l.note?.startsWith('prijs ontbreekt')
/** rubriek van een regel: "Zelf maken" telt in de rubriek waar het vandaan komt */
const rubriek = (l: Line) => (l.category === 'Zelf maken' ? l.subgroup || 'Varia' : l.category)

/** Regels waarvan je de prijs zelf kan invullen (beslag, rubrieken, losse Du Pont-onderdelen van lades). */
const editable = (l: Line) =>
  !['Platen', 'Kanten', 'Productiekosten', 'Uitbesteed'].includes(l.category) && (l.category !== 'Lades' || l.subgroup === 'Du Pont (apart bestellen)')

function useLines(dvId: string) {
  return useQuery<Line[]>(() => supabase.from('cost_lines').select('*').eq('design_version_id', dvId).order('sort'), [dvId])
}

/** Eenheidsprijs die je aanklikt en wijzigt. Bewaard als eigen prijs (Eigen artikels): geldt ook voor alle volgende projecten. */
function PriceCell({ line, onSaved }: { line: Line; onSaved: (msg: string | null) => void }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState('')
  const miss = missing(line)
  const start = () => {
    setVal(miss || line.unit_price == null ? '' : String(line.unit_price).replace('.', ','))
    setEdit(true)
  }
  const save = async () => {
    setEdit(false)
    const v = parseAmount(val)
    if (v == null || Number.isNaN(v)) return
    if (!miss && v === Number(line.unit_price)) return
    const { error } = await supabase.rpc('set_manual_price', {
      p_article_no: line.article_no ?? '', p_description: line.description, p_supplier: line.supplier, p_price: v,
    })
    onSaved(error ? error.message : `Prijs voor "${line.description}" bewaard in je eigen prijslijst (Eigen artikels). Geldt ook voor volgende projecten.`)
  }
  if (edit)
    return (
      <input autoFocus className="price-input" inputMode="decimal" value={val} placeholder="€ per stuk"
        onChange={(e) => setVal(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
    )
  return (
    <button type="button" className={miss ? 'price-btn missing' : 'price-btn'} onClick={start} title="Prijs aanpassen: bewaard in je eigen prijslijst, ook voor volgende projecten">
      {miss ? 'prijs invullen' : line.unit_price == null ? '' : fmtEur(line.unit_price)}
    </button>
  )
}

/** Artikels zonder prijs: herkomst (bestellen, zelf maken, negeren) en prijs per stuk kiezen. */
function NoPrice({ dvId, lines, onSaved, focus }: { dvId: string; lines: Line[]; onSaved: (m: string | null) => void; focus?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (focus) box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [focus])
  if (!lines.length) return null
  return (
    <div ref={box} className={'todo-box' + (focus ? ' focus' : '')}>
      <h2>Zonder prijs <span className="muted">{lines.length}</span></h2>
      <p className="muted">
        Kies per artikel de herkomst en vul de prijs per stuk in. <strong>Bestellen</strong> = bij een leverancier,{' '}
        <strong>Zelf maken</strong> = niet op bestellijsten, <strong>Negeren</strong> = telt nergens mee.
        Bewaard in je eigen prijslijst (Eigen artikels) en herkend op artikelnummer of naam, ook in volgende projecten.
      </p>
      <table>
        <thead><tr><th>Omschrijving</th><th>Leverancier</th><th>Artikel</th><th className="num">Aantal</th><th>Herkomst en prijs per stuk</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{l.description} <ItemWhere dvId={dvId} name={l.description} /></td><td>{l.supplier}</td><td>{l.article_no}</td>
              <td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}`}</td>
              <td><OwnArticleEditor articleNo={l.article_no} description={l.description} supplier={l.supplier} onSaved={onSaved} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Kostregels van één rubriek (tabblad van de versie), met de prijs aan te klikken waar dat kan. */
export function CostLines({ dvId, cats, title }: { dvId: string; cats: string[]; title?: string }) {
  const q = useLines(dvId)
  const [msg, setMsg] = useState<string | null>(null)
  if (q.loading && !q.data) return <Loading />
  const lines = (q.data ?? []).filter((l) => cats.includes(rubriek(l)))
  const onSaved = (m: string | null) => { setMsg(m); q.reload() }
  const sum = lines.reduce((s, l) => s + Number(l.total), 0)
  const subs = [...new Set(lines.map((l) => (l.category === 'Zelf maken' ? 'Zelf maken' : l.subgroup ?? '')))]
  return (
    <>
      <ErrorBox error={q.error} />
      {title && <h2 className="vt-h">{title} <span className="muted">{fmtEur(sum)}</span></h2>}
      {msg && <p className="notice">{msg}</p>}
      {!lines.length ? <p className="muted">Geen regels in deze rubriek.</p> : (
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
                  {s && <tr className="subhead"><td colSpan={8}>{s}</td></tr>}
                  {lines.filter((l) => (l.category === 'Zelf maken' ? 'Zelf maken' : l.subgroup ?? '') === s).map((l) => (
                    <tr key={l.id}>
                      <td>{l.description}{!['Platen', 'Kanten', 'Productiekosten', 'Uitbesteed'].includes(l.category) && <> <ItemWhere dvId={dvId} name={l.description} /></>}</td>
                      <td>{l.supplier}</td>
                      <td>{l.article_no}</td>
                      <td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}`}</td>
                      <td className="num">{missing(l) ? '' : editable(l) ? <PriceCell line={l} onSaved={onSaved} /> : l.unit_price == null ? '' : fmtEur(l.unit_price)}</td>
                      <td className="num">{fmtEur(l.total)}</td>
                      <td>{l.ordered_by}</td>
                      <td className={missing(l) ? 'warn-text' : l.note === 'eigen prijs' || l.note === 'zelf maken' ? 'ok-text' : 'muted'}>
                        {missing(l)
                          ? <><div className="small">{l.note}</div><OwnArticleEditor articleNo={l.article_no} description={l.description} supplier={l.supplier} onSaved={onSaved} /></>
                          : l.note}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={5}>Totaal</td><td className="num">{fmtEur(sum)}</td><td colSpan={2} /></tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}

/** Projectkosten: totaal per rubriek (klik = naar het tabblad), alles zonder prijs, en waar je groepen, marges en prijslijsten vindt. */
export function Projectkosten({ dvId }: { dvId: string }) {
  const { code = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const q = useLines(dvId)
  const st = useQuery<Status>(() => supabase.from('design_versions').select('cost_status, cost_at').eq('id', dvId).single(), [dvId])
  const [msg, setMsg] = useState<string | null>(null)
  if (q.loading && !q.data) return <Loading />
  const lines = q.data ?? []
  const total = lines.reduce((s, l) => s + Number(l.total), 0)
  const known = new Set(RUBRIEKEN.map((r) => r.cat))
  const rows = [
    ...RUBRIEKEN.map((r) => ({ ...r, ls: lines.filter((l) => rubriek(l) === r.cat) })),
    ...[...new Set(lines.map(rubriek).filter((c) => !known.has(c)))].map((c) => ({ tab: 'projectkosten', cat: c, ls: lines.filter((l) => rubriek(l) === c) })),
  ].filter((r) => r.ls.length)
  const onSaved = (m: string | null) => { setMsg(m); q.reload() }
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">
        Kostprijsberekening: {st.data?.cost_status ?? 'nog niet berekend'}. Klik op een rubriek voor de regels.
        Groepen, marges en offerte: <Link to={`/projecten/${encodeURIComponent(code)}?tab=kost`}>Ontwerp › Kostprijs</Link>.
        Prijslijsten raadplegen: <Link to="/regels?sectie=Prijzen">Rekenregels › Prijzen</Link>.
      </p>
      {msg && <p className="notice">{msg}</p>}
      <div className="table-wrap">
        <table className="cost-sum">
          <thead><tr><th>Rubriek</th><th className="num">Regels</th><th className="num">Zonder prijs</th><th className="num">Kostprijs</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const miss = r.ls.filter(missing).length
              return (
                <tr key={r.cat}>
                  <td>{r.tab === 'projectkosten' ? r.cat : <button className="link" onClick={() => setParams({ tab: r.tab }, { replace: true })}>{r.cat}</button>}</td>
                  <td className="num">{r.ls.length}</td>
                  <td className="num">{miss ? <span className="warn-text">{miss}</span> : ''}</td>
                  <td className="num">{fmtEur(r.ls.reduce((x, l) => x + Number(l.total), 0))}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr><td>Totaal kostprijs</td><td /><td /><td className="num">{fmtEur(total)}</td></tr></tfoot>
        </table>
      </div>
      <NoPrice dvId={dvId} lines={lines.filter(missing)} onSaved={onSaved} focus={params.get('focus') === 'prijzen'} />
    </>
  )
}
