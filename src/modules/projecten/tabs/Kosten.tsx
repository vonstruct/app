import { Fragment, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { ErrorBox, Loading } from '../../../core/ui'
import { fmtEur, fmtNum, parseAmount } from '../../../core/format'
import { OwnArticleEditor } from '../../../core/OwnArticle'
import { ItemWhere } from '../../../core/ItemWhere'

type Line = {
  id: string; category: string; subgroup: string | null; sort: number; description: string; supplier: string | null; article_no: string | null; qty: number | null
  unit: string | null; unit_price: number | null; total: number; ordered_by: string | null; note: string | null
  details?: { werkblad?: boolean; outsourcing_id?: string; dikte_mm?: number } | null
}
type Status = { cost_status: string | null; cost_at: string | null }

/**
 * Rubrieken van de kostprijs, in de volgorde en met de namen van de stuklijst in PaletteCAD (9/11/2026, Olivier: "ik had graag dit gezien":
 * Kasten Overzicht · Platen · Kanten · Lades · Werkbladen · Sanitair · Elektriciteit · Toestellen · Grepen · Verbinders & Beslagen · Varia ·
 * Productiekosten · Projectkosten). tab = het tabblad van de versie waar de rubriek staat. "Zelf maken" staat in de rubriek van herkomst
 * (subgroup), platen en uitbesteed werk met telvlag WB bij Werkbladen, ander uitbesteed werk bij Platen.
 */
export const RUBRIEKEN: { tab: string; cat: string }[] = [
  { tab: 'platen', cat: 'Platen' }, { tab: 'platen', cat: 'Uitbesteed' }, { tab: 'kanten', cat: 'Kanten' }, { tab: 'lades', cat: 'Lades' },
  { tab: 'werkbladen', cat: 'Werkbladen' }, { tab: 'sanitair', cat: 'Sanitair' }, { tab: 'elektriciteit', cat: 'Elektriciteit' },
  { tab: 'toestellen', cat: 'Toestellen' }, { tab: 'grepen', cat: 'Grepen' }, { tab: 'beslag', cat: 'Verbinders & Beslagen' },
  { tab: 'varia', cat: 'Varia' }, { tab: 'productiekosten', cat: 'Productiekosten' },
]
const missing = (l: Line) => !!l.note?.startsWith('prijs ontbreekt')
/** rubriek van een regel: "Zelf maken" telt in de rubriek waar het vandaan komt; platen met telvlag WB (details.werkblad) = Werkbladen */
const rubriek = (l: Line) => (l.category === 'Zelf maken' ? l.subgroup || 'Varia' : l.details?.werkblad ? 'Werkbladen' : l.category)
/** subgroep in de tabel */
const subOf = (l: Line) => (l.category === 'Zelf maken' ? 'Zelf maken' : l.details?.werkblad && l.category === 'Platen' ? 'Platen' : l.subgroup ?? '')
const isOut = (l: Line) => !!l.details?.outsourcing_id

/** Regels waarvan je de prijs zelf kan invullen (beslag, rubrieken, losse Du Pont-onderdelen van lades). */
const editable = (l: Line) =>
  !isOut(l) && !['Platen', 'Kanten', 'Productiekosten', 'Uitbesteed'].includes(l.category) && (l.category !== 'Lades' || l.subgroup === 'Du Pont (apart bestellen)')

/** Offerteprijs van uitbesteed werk aanklikken (project_outsourcing.amount); de kostregel volgt meteen (trigger). */
function OutsourcePriceCell({ line, onSaved }: { line: Line; onSaved: (msg: string | null) => void }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState('')
  const miss = missing(line)
  const save = async () => {
    setEdit(false)
    const v = parseAmount(val)
    if (v != null && Number.isNaN(v)) return
    if (!miss && v === Number(line.unit_price)) return
    const { error } = await supabase.from('project_outsourcing').update({ amount: v, updated_at: new Date().toISOString() }).eq('id', Number(line.details?.outsourcing_id))
    onSaved(error ? error.message : v == null ? 'Offerteprijs leeggemaakt' : `Offerteprijs ${line.supplier ?? ''} bewaard: ${fmtEur(v)}`)
  }
  if (edit)
    return (
      <input autoFocus className="price-input" inputMode="decimal" value={val} placeholder="offerteprijs" onChange={(e) => setVal(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
    )
  return (
    <button type="button" className={miss ? 'price-btn missing' : 'price-btn'} title={`Offerteprijs van ${line.supplier ?? 'de firma'} (excl. btw)`}
      onClick={() => { setVal(miss || line.unit_price == null ? '' : String(line.unit_price).replace('.', ',')); setEdit(true) }}>
      {miss || line.unit_price == null ? 'prijs invullen' : fmtEur(line.unit_price)}
    </button>
  )
}

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

/** Tabel met kostregels (per subgroep), de prijs aan te klikken waar dat kan; zonder prijs: herkomst + prijs in de regel. */
function LinesTable({ dvId, lines, onSaved }: { dvId: string; lines: Line[]; onSaved: (m: string | null) => void }) {
  const sum = lines.reduce((s, l) => s + Number(l.total), 0)
  const subs = [...new Set(lines.map(subOf))]
  return (
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
              {lines.filter((l) => subOf(l) === s).map((l) => (
                <tr key={l.id}>
                  <td>{l.description}{!isOut(l) && !['Platen', 'Kanten', 'Productiekosten', 'Uitbesteed'].includes(l.category) && <> <ItemWhere dvId={dvId} name={l.description} /></>}</td>
                  <td>{l.supplier}</td>
                  <td>{l.article_no}</td>
                  <td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}`}</td>
                  <td className="num">{isOut(l) ? <OutsourcePriceCell line={l} onSaved={onSaved} /> : missing(l) ? '' : editable(l) ? <PriceCell line={l} onSaved={onSaved} /> : l.unit_price == null ? '' : fmtEur(l.unit_price)}</td>
                  <td className="num">{fmtEur(l.total)}</td>
                  <td>{l.ordered_by}</td>
                  <td className={missing(l) ? 'warn-text' : l.note === 'eigen prijs' || l.note === 'zelf maken' ? 'ok-text' : 'muted'}>
                    {missing(l) && !isOut(l)
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
  )
}

/** Kostregels van één rubriek (tabblad van de versie). */
export function CostLines({ dvId, cats, title }: { dvId: string; cats: string[]; title?: string }) {
  const q = useLines(dvId)
  const [msg, setMsg] = useState<string | null>(null)
  if (q.loading && !q.data) return <Loading />
  const lines = (q.data ?? []).filter((l) => cats.includes(rubriek(l)))
  const onSaved = (m: string | null) => { setMsg(m); q.reload() }
  return (
    <>
      <ErrorBox error={q.error} />
      {title && <h2 className="vt-h">{title} <span className="muted">{fmtEur(lines.reduce((s, l) => s + Number(l.total), 0))}</span></h2>}
      {msg && <p className="notice">{msg}</p>}
      {!lines.length ? <p className="muted">Geen regels in deze rubriek.</p> : <LinesTable dvId={dvId} lines={lines} onSaved={onSaved} />}
    </>
  )
}

/**
 * Projectkosten: totaal per rubriek; elke rubriek klapt open met haar regels (9/11/2026, Olivier: "elke rubriek kunnen uitklappen").
 * Met ?focus=prijzen klappen de rubrieken met artikels zonder prijs vanzelf open.
 */
export function Projectkosten({ dvId }: { dvId: string }) {
  const { code = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const q = useLines(dvId)
  const st = useQuery<Status>(() => supabase.from('design_versions').select('cost_status, cost_at').eq('id', dvId).single(), [dvId])
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string> | null>(null)
  if (q.loading && !q.data) return <Loading />
  const lines = q.data ?? []
  const total = lines.reduce((s, l) => s + Number(l.total), 0)
  const known = new Set(RUBRIEKEN.map((r) => r.cat))
  const rows = [
    ...RUBRIEKEN.map((r) => ({ ...r, ls: lines.filter((l) => rubriek(l) === r.cat) })),
    ...[...new Set(lines.map(rubriek).filter((c) => !known.has(c)))].map((c) => ({ tab: '', cat: c, ls: lines.filter((l) => rubriek(l) === c) })),
  ].filter((r) => r.ls.length)
  // standaard dicht; via "zonder prijs"-links (?focus=prijzen) de rubrieken met een ontbrekende prijs open
  const opened = open ?? new Set(params.get('focus') === 'prijzen' ? rows.filter((r) => r.ls.some(missing)).map((r) => r.cat) : [])
  const toggle = (c: string) => { const n = new Set(opened); if (n.has(c)) n.delete(c); else n.add(c); setOpen(n) }
  const allOpen = rows.length > 0 && rows.every((r) => opened.has(r.cat))
  const onSaved = (m: string | null) => { setMsg(m); q.reload() }
  return (
    <>
      <ErrorBox error={q.error} />
      <p className="muted">
        Kostprijsberekening: {(st.data?.cost_status ?? 'nog niet berekend').replace(/(\d+(?:\.\d+)?) EUR/, (_, n: string) => fmtEur(Number(n)))}. Klik op een rubriek om ze open te klappen.
        Groepen, marges en offerte: <Link to={`/projecten/${encodeURIComponent(code)}?tab=kost`}>Ontwerp › Kostprijs</Link>.
        Prijslijsten raadplegen: <Link to="/regels?sectie=Prijzen">Rekenregels › Prijzen</Link>.
      </p>
      {msg && <p className="notice">{msg}</p>}
      {rows.length > 0 && (
        <div className="toolbar">
          <button className="link" onClick={() => setOpen(allOpen ? new Set() : new Set(rows.map((r) => r.cat)))}>{allOpen ? 'Alles dichtklappen' : 'Alles openklappen'}</button>
        </div>
      )}
      <div className="table-wrap">
        <table className="cost-sum">
          <thead><tr><th>Rubriek</th><th className="num">Regels</th><th className="num">Zonder prijs</th><th className="num">Kostprijs</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const miss = r.ls.filter(missing).length
              const isOpen = opened.has(r.cat)
              return (
                <Fragment key={r.cat}>
                  <tr className={isOpen ? 'cost-row open' : 'cost-row'} onClick={() => toggle(r.cat)}>
                    <td>
                      <button className="link cost-toggle" aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); toggle(r.cat) }}>{isOpen ? '▾' : '▸'} {r.cat}</button>
                      {r.tab && (
                        <button className="link small muted cost-tab" title="Naar het tabblad van deze rubriek" onClick={(e) => { e.stopPropagation(); setParams({ tab: r.tab }, { replace: true }) }}>tabblad ›</button>
                      )}
                    </td>
                    <td className="num">{r.ls.length}</td>
                    <td className="num">{miss ? <span className="warn-text">{miss}</span> : ''}</td>
                    <td className="num">{fmtEur(r.ls.reduce((x, l) => x + Number(l.total), 0))}</td>
                  </tr>
                  {isOpen && (
                    <tr className="cost-open"><td colSpan={4}><LinesTable dvId={dvId} lines={r.ls} onSaved={onSaved} /></td></tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot><tr><td>Totaal kostprijs</td><td /><td /><td className="num">{fmtEur(total)}</td></tr></tfoot>
        </table>
      </div>
    </>
  )
}
