import { Fragment, useState } from 'react'
import { supabase } from '../../../core/supabase'
import { toast } from '../../../core/toast'
import { fmtEur, fmtNum, parseAmount } from '../../../core/format'

export type Alt = {
  plan: string; suppliers: string[]; supplier: string; length_mm: number; width_mm: number
  count: number; cost: number; unfit: number; chosen: boolean
}
export type SheetData = {
  family?: string; family_name?: string | null; labels?: string[]; plan?: string; plan_cost?: number; suppliers?: string[]
  reasons?: string[]; alternatives?: Alt[]; fixed?: string | null; description?: string | null; note?: string | null
  catalog_supplier?: string | null; locked?: { supplier: string; length_mm: number | null; width_mm: number | null } | null; bekleding?: boolean
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

async function recalc(dvId: string, done: string) {
  const r = await supabase.functions.invoke('recalc', { body: { design_version_id: dvId } })
  const err = (r.data as { error?: string } | null)?.error ?? (r.error ? 'de herberekening kon niet gestart worden' : null)
  if (err) toast(`Bewaard, maar ${err}. Klik later op Herberekenen.`, 'err')
  else { toast(`${done} De platen en kosten worden opnieuw berekend (± 1 minuut).`); window.dispatchEvent(new Event('vonstruct:recalc')) }
}

/**
 * Platen van een versie in één tabel (8/11/2026, Olivier: "waarom niet in dezelfde tabel?"): per materiaal de gekozen platen
 * (één regel per formaat) en, op de eerste regel, de keuze van formaat/leverancier (plate_locks), "uit eigen voorraad"
 * (plate_stock, enkel dit project) en "via onderaannemer" (project_outsourcing). Wat via een onderaannemer gaat, staat als
 * regel in dezelfde tabel, met naam, firma, offertenummer en prijs om aan te passen. Prijs per plaat aanklikken = eigen prijs.
 */
export function PlatesTable({ sheets, dvId, projectCode, outsourcing, stock, firms, onChanged }: {
  sheets: PlateRow[]; dvId: string; projectCode: string; outsourcing: Outsourcing[]; stock: { family: string; thickness_mm: number }[]; firms: string[]; onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [sub, setSub] = useState<string | null>(null)          // groep waarvoor het formulier "via onderaannemer" open staat
  const [why, setWhy] = useState<Record<string, boolean>>({})
  const inStock = (fam: string | undefined, th: number) => !!fam && stock.some((x) => x.family === fam && Math.abs(Number(x.thickness_mm) - Number(th)) < 0.05)

  // groepen = materiaal + dikte, met hun platen (één regel per formaat)
  const groups = new Map<string, PlateRow[]>()
  for (const s of sheets) {
    const k = `${s.data?.family ?? s.material_label}|${s.thickness_mm}`
    groups.set(k, [...(groups.get(k) ?? []), s])
  }
  const entries: { label: string; key: string; rows?: PlateRow[]; o?: Outsourcing }[] = [
    ...[...groups.entries()].map(([key, rows]) => ({ label: rows[0].material_label, key, rows })),
    ...outsourcing.map((o) => ({ label: o.material_label ?? o.family, key: `o${o.id}`, o })),
  ].sort((x, y) => x.label.localeCompare(y.label, 'nl') || x.key.localeCompare(y.key))
  const nPlates = sheets.reduce((a, s) => a + Number(s.qty), 0)
  const total = sheets.reduce((a, s) => a + Number(s.cost), 0) + outsourcing.reduce((a, o) => a + Number(o.amount ?? 0), 0)

  const choose = async (g: PlateRow, value: string) => {
    const d = g.data ?? {}
    if (!d.family) return
    const key = `${d.family}|${g.thickness_mm}`
    setBusy(key)
    let error: { message: string } | null = null
    if (value === 'auto') {
      ;({ error } = await supabase.from('plate_locks').delete().eq('project_code', projectCode).eq('family', d.family).eq('thickness_mm', g.thickness_mm))
    } else {
      const a = (d.alternatives ?? [])[Number(value)]
      if (!a) { setBusy(null); return }
      ;({ error } = await supabase.from('plate_locks').upsert(
        { project_code: projectCode, family: d.family, thickness_mm: g.thickness_mm, material_label: g.material_label, supplier: a.supplier, length_mm: Math.round(a.length_mm), width_mm: Math.round(a.width_mm) },
        { onConflict: 'project_code,family,thickness_mm' },
      ))
    }
    if (error) { setBusy(null); toast(error.message, 'err'); return }
    await recalc(dvId, 'Keuze bewaard.')
    setBusy(null)
    onChanged()
  }
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
  const backInHouse = async (o: Outsourcing) => {
    if (!confirm(`${o.material_label ?? o.family} terug zelf laten maken? Dan komen de platen en kanten terug in de berekening en verdwijnt de regel van ${o.firm}.`)) return
    setBusy(`o${o.id}`)
    const { error } = await supabase.from('project_outsourcing').delete().eq('id', o.id)
    if (error) { setBusy(null); toast(error.message, 'err'); return }
    await recalc(dvId, 'Terug zelf maken.')
    setBusy(null)
    onChanged()
  }
  const saveOut = async (o: Outsourcing, patch: Partial<Outsourcing>, msg: string) => {
    const { error } = await supabase.from('project_outsourcing').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) return toast(error.message, 'err')
    toast(msg); onChanged()
  }
  // eigen prijs per plaat (manual_prices, geldt ook voor volgende projecten); de optimizer kiest daarna opnieuw
  const savePlatePrice = async (r: PlateRow, price: number | null) => {
    if (price == null || !r.article_no) return
    const { error } = await supabase.rpc('set_manual_item', {
      p_article_no: r.article_no, p_description: r.data?.description || r.material_label, p_supplier: r.data?.catalog_supplier || r.supplier, p_price: price, p_origin: 'Bestellen',
    })
    if (error) return toast(error.message, 'err')
    await recalc(dvId, `Eigen prijs ${fmtEur(price)} per plaat bewaard (artikel ${r.article_no}, ook voor volgende projecten).`)
    onChanged()
  }

  if (!entries.length) return <p className="muted">Nog geen resultaat van de plaatoptimalisatie</p>
  return (
    <div className="table-wrap">
      <table className="plt">
        <thead>
          <tr>
            <th>Materiaal</th><th className="num">Dikte</th><th>Formaat (mm)</th><th className="num">Platen</th><th className="num">Benutting</th>
            <th className="num">Per plaat</th><th className="num">Totaal</th><th>Leverancier</th><th>Artikel</th><th>Besteld door</th>
            <th className="ck" title="Uit eigen voorraad: telt mee in de kost, niet bestellen (enkel dit project)">Voorraad</th>
            <th className="ck" title="Via onderaannemer: een andere firma maakt dit, met zijn prijs">Onder&shy;aannemer</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((en) => {
            if (en.o) {
              const o = en.o
              return (
                <tr key={en.key} className="plt-first plt-sub">
                  <td className="mat">
                    <InlineText value={o.description || o.material_label || o.family} onSave={(v) => saveOut(o, { description: v }, 'Naam bewaard')} />
                    <div><span className="chip gold">via onderaannemer</span></div>
                  </td>
                  <td /><td className="muted">—</td><td /><td />
                  <td className="num"><InlineMoney value={o.amount} empty="prijs invullen" onSave={(v) => saveOut(o, { amount: v }, v == null ? 'Prijs leeggemaakt' : `Prijs ${fmtEur(v)} bewaard`)} /></td>
                  <td className="num">{o.amount == null ? <span className="bad-text">—</span> : fmtEur(o.amount)}</td>
                  <td><InlineText value={o.firm} list="plt-firms" onSave={(v) => v && saveOut(o, { firm: v }, 'Firma bewaard')} /></td>
                  <td><InlineText value={o.quote_ref ?? ''} placeholder="offerte nr." onSave={(v) => saveOut(o, { quote_ref: v || null }, 'Offertenummer bewaard')} /></td>
                  <td>Vonstruct</td>
                  <td className="ck"><input type="checkbox" disabled aria-label="Voorraad" /></td>
                  <td className="ck"><input type="checkbox" checked disabled={busy === en.key} onChange={() => backInHouse(o)} aria-label="Via onderaannemer" title="Uitvinken = terug zelf maken" /></td>
                </tr>
              )
            }
            const rows = en.rows!
            const g = rows[0]
            const d = g.data ?? {}
            const alts = d.alternatives ?? []
            const lk = d.locked
            const idx = lk ? alts.findIndex((a) => a.supplier === lk.supplier && (lk.length_mm == null || (same(a.length_mm, lk.length_mm) && same(a.width_mm, lk.width_mm)))) : -1
            const stockOn = inStock(d.family, g.thickness_mm)
            return (
              <Fragment key={en.key}>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i === 0 ? 'plt-first' : ''}>
                    {i === 0 && (
                      <td className="mat" rowSpan={rows.length}>
                        <b>{g.material_label}</b>
                        <div className="chips">
                          {lk && <span className="chip gold">met de hand gekozen</span>}
                          {d.bekleding && <span className="chip">bekleding</span>}
                          {stockOn && <span className="chip ok">uit eigen voorraad</span>}
                        </div>
                        {d.family && alts.length > 0 && (
                          <select className="plt-pick" value={lk ? (idx >= 0 ? String(idx) : 'lock') : 'auto'} disabled={busy === en.key} onChange={(e) => choose(g, e.target.value)} title="Ander formaat of andere leverancier vastzetten (ook voor volgende versies)">
                            <option value="auto">Automatisch: voordeligste</option>
                            {lk && idx < 0 && <option value="lock">Vast: {lk.supplier}{lk.length_mm ? ` ${Math.round(lk.length_mm)}×${Math.round(lk.width_mm ?? 0)}` : ''}</option>}
                            {alts.map((a, j) => (
                              <option key={j} value={String(j)}>{a.plan} · {a.suppliers.join(' + ')} · {fmtEur(a.cost)}{a.unfit ? ` · ${a.unfit} past niet` : ''}{a.chosen ? ' ✓' : ''}</option>
                            ))}
                          </select>
                        )}
                        {!!d.reasons?.length && (
                          <button className="link small" onClick={() => setWhy({ ...why, [en.key]: !why[en.key] })}>{why[en.key] ? 'waarom ▴' : 'waarom ▾'}</button>
                        )}
                        {why[en.key] && <ul className="pc-why">{(d.reasons ?? []).map((x, j) => <li key={j}>{x}</li>)}</ul>}
                      </td>
                    )}
                    <td className="num">{fmtNum(r.thickness_mm)}</td>
                    <td>{fmtNum(r.length_mm, 0)} × {fmtNum(r.width_mm, 0)}</td>
                    <td className="num">{fmtNum(r.qty, 0)}</td>
                    <td className="num">{r.yield_pct == null ? '' : `${fmtNum(r.yield_pct, 0)} %`}</td>
                    <td className="num">
                      {r.article_no
                        ? <InlineMoney value={r.price_per_sheet} empty="prijs invullen" title="Eigen prijs per plaat (geldt ook voor volgende projecten); daarna wordt opnieuw berekend" onSave={(v) => savePlatePrice(r, v)} />
                        : fmtEur(r.price_per_sheet)}
                    </td>
                    <td className="num">{fmtEur(r.cost)}</td>
                    <td>{r.supplier ?? r.format_source ?? ''}</td>
                    <td title={[r.data?.description, r.data?.note].filter(Boolean).join(' · ')}>{r.article_no ?? ''}{r.data?.note ? <div className="small muted">{r.data.note}</div> : null}</td>
                    <td>{r.ordered_by}</td>
                    {i === 0 && (
                      <>
                        <td className="ck" rowSpan={rows.length}>{d.family && <input type="checkbox" checked={stockOn} onChange={() => toggleStock(g)} aria-label="Uit eigen voorraad" />}</td>
                        <td className="ck" rowSpan={rows.length}>{d.family && <input type="checkbox" checked={sub === en.key} onChange={() => setSub(sub === en.key ? null : en.key)} aria-label="Via onderaannemer" />}</td>
                      </>
                    )}
                  </tr>
                ))}
                {sub === en.key && d.family && (
                  <tr className="find-row"><td colSpan={12}>
                    <OutsourceForm projectCode={projectCode} dvId={dvId} family={d.family} label={g.material_label} onDone={() => { setSub(null); onChanged() }} onCancel={() => setSub(null)} />
                  </td></tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr><td>Totaal</td><td /><td /><td className="num">{fmtNum(nPlates, 0)}</td><td /><td /><td className="num">{fmtEur(total)}</td><td colSpan={5} /></tr>
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

/** "Via onderaannemer" voor een materiaal: firma (uit Relaties of vrij), prijs (mag later), naam; daarna herberekenen. */
function OutsourceForm({ projectCode, dvId, family, label, onDone, onCancel }: {
  projectCode: string; dvId: string; family: string; label: string; onDone: () => void; onCancel: () => void
}) {
  const [firm, setFirm] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState(label)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!firm.trim()) { toast('Kies of typ de firma', 'err'); return }
    const value = parseAmount(amount)
    if (value != null && Number.isNaN(value)) { toast('Prijs is geen geldig bedrag', 'err'); return }
    setBusy(true)
    const { error } = await supabase.from('project_outsourcing').insert({ project_code: projectCode, family, material_label: label, firm: firm.trim(), amount: value, description: description.trim() || null })
    if (error) { setBusy(false); toast(error.message, 'err'); return }
    await recalc(dvId, `${label} via ${firm.trim()}.`)
    setBusy(false)
    onDone()
  }
  return (
    <div className="pc-form">
      <label>Onderaannemer / firma<input list="plt-firms" value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="kies uit Relaties of typ" autoFocus /></label>
      <label>Prijs excl. btw<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="later invullen mag" /></label>
      <label>Naam<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="toolbar">
        <button className="primary" disabled={busy} onClick={save}>{busy ? 'Bezig…' : 'Via onderaannemer'}</button>
        <button className="link" onClick={onCancel}>Annuleren</button>
      </div>
      <p className="small muted">Alle platen van dit materiaal in dit project: geen plaatkost, kanten of productiekost meer, wel deze prijs (ook op de bestellijst bij die firma).</p>
    </div>
  )
}
