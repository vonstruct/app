import { Fragment, useState } from 'react'
import { supabase } from '../../../core/supabase'
import { toast } from '../../../core/toast'
import { fmtEur, fmtNum, parseAmount } from '../../../core/format'
import { ExecutionSelect, saveExecution, startRecalc, useExecOptions } from '../Execution'

export type Alt = {
  plan: string; suppliers: string[]; supplier: string; length_mm: number; width_mm: number
  count: number; cost: number; unfit: number; chosen: boolean
}
export type SheetData = {
  family?: string; family_name?: string | null; labels?: string[]; plan?: string; plan_cost?: number; suppliers?: string[]
  reasons?: string[]; alternatives?: Alt[]; fixed?: string | null; description?: string | null; note?: string | null
  catalog_supplier?: string | null; locked?: { supplier: string; length_mm: number | null; width_mm: number | null } | null; bekleding?: boolean
  primary?: { supplier: string; length_mm: number; width_mm: number } | null; executor?: string | null
}
export type PlateRow = {
  id: string; material_label: string; thickness_mm: number; length_mm: number; width_mm: number; qty: number; yield_pct: number | null
  price_per_sheet: number | null; format_source: string | null; supplier: string | null; article_no: string | null; ordered_by: string | null
  cost: number; data: SheetData | null
}
export type Outsourcing = {
  id: number; project_code: string; family: string; material_label: string | null; firm: string; amount: number | null
  description: string | null; quote_ref: string | null
}

const same = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.round(Number(a)) === Math.round(Number(b))
const fmtSize = (l: number, w: number) => `${fmtNum(l, 0)} × ${fmtNum(w, 0)}`
const diffTxt = (d: number) => (Math.abs(d) < 0.005 ? '' : ` (${d > 0 ? '+' : '−'}${fmtEur(Math.abs(d))})`)

/**
 * Platen van een versie als gewone tabel (9/11/2026, Olivier: "terug in tabelvorm, met de info van dit"): één regel per
 * formaat. Alles is in de regel te wijzigen: formaat en leverancier (zet de keuze vast, plate_locks), prijs per plaat
 * (eigen prijs), Uitvoering (Vonstruct / partner / firma, zie Execution.tsx), voorraad (plate_stock) en Regel
 * (A = automatisch het voordeligste, M = met de hand gekozen; aanklikken wisselt). ⓘ bij de naam = waarom deze keuze.
 * Uitbesteed werk staat als regel in dezelfde tabel (naam, offertenummer en prijs aan te passen).
 */
export function PlatesTable({ sheets, dvId, projectCode, outsourcing, stock, firms, onChanged }: {
  sheets: PlateRow[]; dvId: string; projectCode: string; outsourcing: Outsourcing[]; stock: { family: string; thickness_mm: number }[]; firms: string[]; onChanged: () => void
}) {
  const opts = useExecOptions()
  const [busy, setBusy] = useState<string | null>(null)
  const [why, setWhy] = useState<Record<string, boolean>>({})
  const inStock = (fam: string | undefined, th: number) => !!fam && stock.some((x) => x.family === fam && Math.abs(Number(x.thickness_mm) - Number(th)) < 0.05)

  // groepen = materiaal + dikte; het hoofdformaat eerst (daar staan de keuzes), dan de rest
  const groups = new Map<string, PlateRow[]>()
  for (const s of sheets) {
    const k = `${s.data?.family ?? s.material_label}|${s.thickness_mm}`
    groups.set(k, [...(groups.get(k) ?? []), s])
  }
  const isPrimary = (r: PlateRow) => {
    const p = r.data?.primary
    return !!p && ((same(r.length_mm, p.length_mm) && same(r.width_mm, p.width_mm)) || (same(r.length_mm, p.width_mm) && same(r.width_mm, p.length_mm)))
  }
  for (const rows of groups.values()) rows.sort((a, b) => Number(isPrimary(b)) - Number(isPrimary(a)) || Number(b.qty) - Number(a.qty))
  const entries: { label: string; key: string; rows?: PlateRow[]; o?: Outsourcing }[] = [
    ...[...groups.entries()].map(([key, rows]) => ({ label: rows[0].material_label, key, rows })),
    ...outsourcing.map((o) => ({ label: o.material_label ?? o.family, key: `o${o.id}`, o })),
  ].sort((x, y) => x.label.localeCompare(y.label, 'nl') || x.key.localeCompare(y.key))
  const nPlates = sheets.reduce((a, s) => a + Number(s.qty), 0)
  const total = sheets.reduce((a, s) => a + Number(s.cost), 0) + outsourcing.reduce((a, o) => a + Number(o.amount ?? 0), 0)

  const run = async (key: string, fn: () => Promise<boolean>, done: string) => {
    setBusy(key)
    const again = await fn()
    if (again) await startRecalc(dvId, done)
    setBusy(null)
    onChanged()
  }
  // formaat en/of leverancier vastzetten (ook voor volgende versies van dit project); null = terug automatisch
  const lock = (g: PlateRow, key: string, l: { supplier: string; length_mm: number | null; width_mm: number | null } | null, done: string) => run(key, async () => {
    const fam = g.data?.family
    if (!fam) return false
    const { error } = l == null
      ? await supabase.from('plate_locks').delete().eq('project_code', projectCode).eq('family', fam).eq('thickness_mm', g.thickness_mm)
      : await supabase.from('plate_locks').upsert(
        {
          project_code: projectCode, family: fam, thickness_mm: g.thickness_mm, material_label: g.material_label, supplier: l.supplier,
          length_mm: l.length_mm == null ? null : Math.round(l.length_mm), width_mm: l.width_mm == null ? null : Math.round(l.width_mm),
        },
        { onConflict: 'project_code,family,thickness_mm' })
    if (error) { toast(error.message, 'err'); return false }
    return true
  }, done)
  const toggleStock = async (g: PlateRow) => {
    const fam = g.data?.family
    if (!fam) return
    const on = inStock(fam, g.thickness_mm)
    const { error } = on
      ? await supabase.from('plate_stock').delete().eq('project_code', projectCode).eq('family', fam).eq('thickness_mm', g.thickness_mm)
      : await supabase.from('plate_stock').insert({ project_code: projectCode, family: fam, thickness_mm: g.thickness_mm, material_label: g.material_label })
    if (error) { toast(error.message, 'err'); return }
    toast(on ? `${g.material_label}: weer bestellen` : `${g.material_label} uit eigen voorraad: telt mee in de kost, komt niet op de bestellijst (enkel dit project)`)
    onChanged()
  }
  const saveOut = async (o: Outsourcing, patch: Partial<Outsourcing>, msg: string) => {
    const { error } = await supabase.from('project_outsourcing').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) return toast(error.message, 'err')
    toast(msg); onChanged()
  }
  // eigen prijs per plaat (manual_prices, geldt ook voor volgende projecten); de optimizer kiest daarna opnieuw
  const savePlatePrice = (r: PlateRow, price: number | null) => {
    if (price == null || !r.article_no) return
    run(r.id, async () => {
      const { error } = await supabase.rpc('set_manual_item', {
        p_article_no: r.article_no, p_description: r.data?.description || r.material_label, p_supplier: r.data?.catalog_supplier || r.supplier, p_price: price, p_origin: 'Bestellen',
      })
      if (error) { toast(error.message, 'err'); return false }
      return true
    }, `Eigen prijs ${fmtEur(price)} per plaat bewaard (ook voor volgende projecten).`)
  }

  if (!entries.length) return <p className="muted">Nog geen resultaat van de plaatoptimalisatie</p>
  return (
    <div className="table-wrap">
      <table className="plt">
        <thead>
          <tr>
            <th>Materiaal</th><th className="num">Dikte</th><th>Formaat (mm)</th><th className="num">Platen</th><th className="num">Benutting</th>
            <th className="num">Per plaat</th><th className="num">Totaal</th><th>Leverancier</th>
            <th title="Wie voert het uit: Vonstruct (plaatkost, jij bestelt), de partner (plaatkost + productiekost, de partner bestelt) of een firma (enkel haar offerteprijs)">Uitvoering</th>
            <th className="ck" title="Uit eigen voorraad: telt mee in de kost, niet bestellen (enkel dit project)">Voorraad</th>
            <th className="ck" title="A = automatisch het voordeligste formaat en de voordeligste leverancier · M = met de hand gekozen (geldt ook voor volgende versies)">Regel</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((en) => {
            if (en.o) {
              const o = en.o
              const label = o.material_label ?? o.family
              return (
                <tr key={en.key} className="plt-first plt-sub">
                  <td className="mat"><InlineText value={o.description || label} onSave={(v) => saveOut(o, { description: v }, 'Naam bewaard')} /></td>
                  <td /><td className="muted">uitbesteed</td><td /><td /><td />
                  <td className="num"><InlineMoney value={o.amount} empty="prijs invullen" title={`Offerteprijs van ${o.firm} (excl. btw)`} onSave={(v) => saveOut(o, { amount: v }, v == null ? 'Prijs leeggemaakt' : `Prijs ${fmtEur(v)} bewaard`)} /></td>
                  <td>{o.firm}<div className="small"><InlineText value={o.quote_ref ?? ''} placeholder="offertenr." onSave={(v) => saveOut(o, { quote_ref: v || null }, 'Offertenummer bewaard')} /></div></td>
                  <td>
                    <ExecutionSelect value={o.firm} opts={opts} listId="plt-firms" disabled={busy === en.key}
                      onPick={(to) => run(en.key, () => saveExecution({ projectCode, family: o.family, thickness: null, label, to, opts, outsourcingId: o.id }), `${label}: uitgevoerd door ${to}.`)} />
                  </td>
                  <td className="ck" /><td className="ck" />
                </tr>
              )
            }
            const rows = en.rows!
            const g = rows[0]
            const d = g.data ?? {}
            const alts = d.alternatives ?? []
            const lk = d.locked
            const fixed = d.fixed || null
            const chosen = alts.find((a) => a.chosen)
            const base = chosen?.cost ?? Number(d.plan_cost ?? 0)
            const prim = d.primary
            const curSup = prim?.supplier ?? g.supplier ?? ''
            // leveranciers met een zaagplan voor dit materiaal (goedkoopste plan per leverancier)
            const supCost = new Map<string, number>()
            for (const a of alts) supCost.set(a.supplier, Math.min(supCost.get(a.supplier) ?? Infinity, a.cost))
            const sups = [...supCost.keys()]
            if (curSup && !sups.includes(curSup)) sups.unshift(curSup)
            // hoofdformaten van de gekozen leverancier (bij een vaste leverancier: alle), één per maat
            const fmts = new Map<string, Alt>()
            for (const a of alts.filter((x) => fixed || x.supplier === curSup)) {
              const k = `${Math.round(a.length_mm)}x${Math.round(a.width_mm)}|${a.supplier}`
              const prev = fmts.get(k)
              if (!prev || a.chosen || (!prev.chosen && a.cost < prev.cost)) fmts.set(k, a)
            }
            const curFmt = prim ? `${Math.round(prim.length_mm)}x${Math.round(prim.width_mm)}|${prim.supplier}` : ''
            const stockOn = inStock(d.family, g.thickness_mm)
            const can = !!d.family && busy !== en.key
            return (
              <Fragment key={en.key}>
                {rows.map((r, i) => {
                  const main = i === 0
                  return (
                    <tr key={r.id} className={main ? 'plt-first' : ''}>
                      <td className="mat">
                        {main && (
                          <>
                            {g.material_label}
                            {d.bekleding && <span className="muted small"> · bekleding</span>}
                            {(!!d.reasons?.length || alts.length > 1) && (
                              <button className="link small plt-i" title="Waarom deze keuze en wat de andere mogelijkheden kosten" onClick={() => setWhy({ ...why, [en.key]: !why[en.key] })}>ⓘ</button>
                            )}
                          </>
                        )}
                      </td>
                      <td className="num">{fmtNum(r.thickness_mm)}</td>
                      <td>
                        {main && d.family && fmts.size > 1 ? (
                          <select className="cell-select" value={fmts.has(curFmt) ? curFmt : ''} disabled={!can} aria-label="Formaat"
                            title="Ander hoofdformaat kiezen (zet de keuze vast: Regel M)"
                            onChange={(e) => {
                              const a = fmts.get(e.target.value)
                              if (a) lock(g, en.key, { supplier: a.supplier, length_mm: a.length_mm, width_mm: a.width_mm }, `${g.material_label}: ${fmtSize(a.length_mm, a.width_mm)} vastgezet.`)
                            }}>
                            {!fmts.has(curFmt) && <option value="">{fmtSize(r.length_mm, r.width_mm)}</option>}
                            {[...fmts.entries()].map(([k, a]) => (
                              <option key={k} value={k}>{fmtSize(a.length_mm, a.width_mm)}{fixed && sups.length > 1 ? ` ${a.supplier}` : ''}{a.chosen ? '' : diffTxt(a.cost - base)}{a.unfit ? ' · past niet' : ''}</option>
                            ))}
                          </select>
                        ) : (
                          <span title={main ? undefined : 'Voor onderdelen die niet op het hoofdformaat passen (de rest van die plaat wordt eerst gevuld)'}>{fmtSize(r.length_mm, r.width_mm)}</span>
                        )}
                      </td>
                      <td className="num">{fmtNum(r.qty, 0)}</td>
                      <td className="num">{r.yield_pct == null ? '' : `${fmtNum(r.yield_pct, 0)} %`}</td>
                      <td className="num">
                        {r.article_no
                          ? <InlineMoney value={r.price_per_sheet} empty="prijs invullen" title="Eigen prijs per plaat (geldt ook voor volgende projecten); daarna wordt opnieuw berekend" onSave={(v) => savePlatePrice(r, v)} />
                          : fmtEur(r.price_per_sheet)}
                      </td>
                      <td className="num">{fmtEur(r.cost)}</td>
                      <td title={[r.article_no && `artikel ${r.article_no}`, r.data?.description, fixed && `vaste leverancier ${fixed} (Rekenregels → Bestellen)`].filter(Boolean).join(' · ')}>
                        {main && d.family && !fixed && sups.length > 1 ? (
                          <select className="cell-select" value={curSup} disabled={!can} aria-label="Leverancier"
                            title="Andere leverancier kiezen (zet de keuze vast: Regel M); het voordeligste formaat van die leverancier wordt gekozen"
                            onChange={(e) => lock(g, en.key, { supplier: e.target.value, length_mm: null, width_mm: null }, `${g.material_label}: ${e.target.value} vastgezet.`)}>
                            {sups.map((x) => <option key={x} value={x}>{x}{x === curSup ? '' : diffTxt((supCost.get(x) ?? base) - base)}</option>)}
                          </select>
                        ) : (r.supplier ?? r.format_source ?? '')}
                        {r.data?.note ? <div className="small muted">{r.data.note}</div> : null}
                      </td>
                      <td>
                        {main && d.family ? (
                          <ExecutionSelect value={g.ordered_by ?? ''} opts={opts} listId="plt-firms" disabled={!can}
                            onPick={(to) => run(en.key, () => saveExecution({ projectCode, family: d.family!, thickness: Number(g.thickness_mm), label: g.material_label, to, opts }), `${g.material_label}: uitgevoerd door ${to}.`)} />
                        ) : main ? g.ordered_by : null}
                      </td>
                      <td className="ck">{main && d.family && <input type="checkbox" checked={stockOn} onChange={() => toggleStock(g)} aria-label="Uit eigen voorraad" />}</td>
                      <td className="ck">
                        {main && d.family && prim && (
                          <button className={`plt-rule${lk ? ' m' : ''}`} disabled={!can}
                            title={lk ? 'M: met de hand gekozen. Klik = terug automatisch (A)' : 'A: automatisch het voordeligste. Klik = deze keuze vastzetten (M), ook voor volgende versies'}
                            onClick={() => (lk
                              ? lock(g, en.key, null, `${g.material_label}: terug automatisch.`)
                              : lock(g, en.key, { supplier: prim.supplier, length_mm: prim.length_mm, width_mm: prim.width_mm }, `${g.material_label}: keuze vastgezet.`))}>
                            {lk ? 'M' : 'A'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {why[en.key] && (
                  <tr className="plt-why-row"><td colSpan={11}>
                    {!!d.reasons?.length && <ul className="pc-why">{(d.reasons ?? []).map((x, j) => <li key={j}>{x}</li>)}</ul>}
                    {alts.length > 1 && (
                      <p className="small muted">Mogelijkheden: {alts.map((a) => `${a.plan} ${a.suppliers.join(' + ')} ${fmtEur(a.cost)}${a.unfit ? ` (${a.unfit} past niet)` : ''}${a.chosen ? ' ✓' : ''}`).join(' · ')}</p>
                    )}
                  </td></tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr><td>Totaal</td><td /><td /><td className="num">{fmtNum(nPlates, 0)}</td><td /><td /><td className="num">{fmtEur(total)}</td><td colSpan={4} /></tr>
        </tfoot>
      </table>
      <datalist id="plt-firms">{firms.map((f) => <option key={f} value={f} />)}</datalist>
    </div>
  )
}

/** tekst in de tabel: aanklikken, wijzigen, Enter of ernaast klikken = bewaren */
function InlineText({ value, onSave, placeholder, list }: { value: string; onSave: (v: string) => void; placeholder?: string; list?: string }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(value)
  if (!edit) return <button type="button" className="cell-btn" onClick={() => { setV(value); setEdit(true) }}>{value || <span className="muted">{placeholder ?? '—'}</span>}</button>
  return (
    <input autoFocus className="cell-input" list={list} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEdit(false); if (v.trim() !== value) onSave(v.trim()) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
  )
}

/** bedrag in de tabel: komma of punt (gsm), leeg = geen prijs */
function InlineMoney({ value, onSave, empty, title }: { value: number | null; onSave: (v: number | null) => void; empty: string; title?: string }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState('')
  if (!edit) return <button type="button" className="price-btn" title={title} onClick={() => { setV(value == null ? '' : String(value).replace('.', ',')); setEdit(true) }}>{value == null ? empty : fmtEur(value)}</button>
  return (
    <input autoFocus className="price-input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEdit(false); const n = parseAmount(v); if (n !== null && Number.isNaN(n)) return toast('Geen geldig bedrag', 'err'); if (n !== (value == null ? null : Number(value))) onSave(n) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
  )
}
