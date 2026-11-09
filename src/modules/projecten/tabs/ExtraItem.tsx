import { useEffect, useState } from 'react'
import { supabase } from '../../../core/supabase'
import { fmtEur, parseAmount } from '../../../core/format'
import { howText, searchPrices } from '../priceSearch'

/**
 * Manueel een artikel toevoegen in een rubriek (9/11/2026, Olivier: "in elke rubriek de mogelijkheid hebben om manueel iets toe te
 * voegen van artikel alsook met bijhorende prijs. Dat dit dan ook opslaat in een prijslijst dat ik kan kiezen, waaronder die van
 * Vonstruct zelf").
 * - Bewaard in project_extra_items (per project, geldt voor alle versies, ook na een nieuwe upload). Een trigger zet het meteen in de
 *   kostregels van de berekende versies; de kostprijsberekening neemt het telkens opnieuw mee.
 * - Prijslijst: Vonstruct (eigen prijslijst) of een leverancier. De prijs komt dan in Eigen artikels (manual_prices, set_manual_item)
 *   met die prijslijst: geldt ook in volgende projecten en als het artikel uit PaletteCAD komt.
 * - Weghalen = active false (de regel staat meteen op € 0) + herberekenen; de app wist niets zelf.
 */

export type ExtraEdit = {
  extraId: string; category: string; description: string; article_no: string | null; supplier: string | null
  qty: number | null; unit: string | null; unit_price: number | null; ordered_by: string | null
}
type Hit = { src: string; supplier: string | null; article_no: string | null; description: string; unit_price: number | null; unit: string | null }

export const OWN_LIST = 'Vonstruct'
const UNITS = ['stuk', 'm', 'm²', 'set', 'pak', 'rol', 'plaat', 'uur']
const NOT_ORDERED = 'Zelf maken'   // ordered_by: komt niet op een bestellijst

let listsCache: Promise<{ suppliers: string[]; partners: string[] }> | null = null
/** leveranciers en partners (één keer opgevraagd, gedeeld) */
export function loadLists() {
  if (!listsCache) {
    listsCache = Promise.all([
      supabase.from('suppliers').select('name').eq('active', true).order('name'),
      supabase.from('partners').select('name').order('name'),
    ]).then(([s, p]) => ({
      suppliers: ((s.data ?? []) as { name: string }[]).map((x) => x.name).filter((n) => n !== OWN_LIST),
      partners: ((p.data ?? []) as { name: string }[]).map((x) => x.name),
    }))
    listsCache.catch(() => { listsCache = null })
  }
  return listsCache
}

const num = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','))

const codeCache = new Map<string, Promise<string | null>>()
/** projectcode van een ontwerpversie (één keer opgevraagd per versie) */
export function projectCodeOf(dvId: string) {
  let p = codeCache.get(dvId)
  if (!p) {
    p = Promise.resolve(supabase.from('design_versions').select('project_code').eq('id', dvId).single())
      .then((r) => ((r.data as { project_code: string } | null)?.project_code ?? null))
    codeCache.set(dvId, p)
    p.then((c) => { if (!c) codeCache.delete(dvId) }, () => codeCache.delete(dvId))
  }
  return p
}

export function ExtraItemForm({ dvId, cats, initialCat, edit, onDone }: {
  dvId: string; cats: string[]; initialCat?: string; edit?: ExtraEdit | null; onDone: (msg: string | null) => void
}) {
  const [lists, setLists] = useState<{ suppliers: string[]; partners: string[] }>({ suppliers: [], partners: [] })
  const [cat, setCat] = useState(edit?.category ?? initialCat ?? cats[0] ?? 'Varia')
  const [desc, setDesc] = useState(edit?.description ?? '')
  const [art, setArt] = useState(edit?.article_no ?? '')
  const [qty, setQty] = useState(edit ? num(edit.qty) : '1')
  const [unit, setUnit] = useState(edit?.unit ?? ((edit?.category ?? initialCat ?? cats[0]) === 'Platen' ? 'plaat' : (edit?.category ?? initialCat ?? cats[0]) === 'Kanten' ? 'm' : 'stuk'))
  const [price, setPrice] = useState(edit ? num(edit.unit_price) : '')
  const [list, setList] = useState(edit ? edit.supplier ?? '' : OWN_LIST)
  const [by, setBy] = useState(edit?.ordered_by ?? NOT_ORDERED)
  const [keep, setKeep] = useState(true)
  const [catalogPrice, setCatalogPrice] = useState<number | null>(null)   // gekozen uit een prijslijst van een leverancier
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [how, setHow] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { loadLists().then(setLists, () => undefined) }, [])

  const search = async () => {
    if (q.trim().length < 2) return setErr('Typ minstens 2 tekens om te zoeken (artikelnummer of naam).')
    setErr(null)
    const r = await searchPrices<Hit>(q.trim(), 8)
    if (r.error) return setErr(r.error.message)
    const list = r.hits.filter((h) => h.src !== 'mail' || h.unit_price != null)
    setHits(list)
    setHow(howText(r.how, q.trim(), list.length))
  }
  const pick = (h: Hit) => {
    setDesc(h.description)
    setArt(h.article_no ?? '')
    setPrice(num(h.unit_price))
    if (h.unit && UNITS.includes(h.unit)) setUnit(h.unit)
    const l = h.supplier || OWN_LIST
    setList(l)
    setBy(l === OWN_LIST ? NOT_ORDERED : 'Vonstruct')
    // uit de prijslijst van een leverancier en de prijs niet gewijzigd: geen eigen prijs nodig (die zou latere prijslijsten negeren)
    setCatalogPrice(h.src === 'prijslijst' ? h.unit_price : null)
    setKeep(h.src !== 'prijslijst')
    setHits(null)
  }
  const chooseList = (l: string) => {
    setList(l)
    if (!edit) setBy(l === OWN_LIST ? NOT_ORDERED : by === NOT_ORDERED ? 'Vonstruct' : by)
  }

  const p = parseAmount(price)
  const n = parseAmount(qty)
  const priceChanged = catalogPrice == null || p !== catalogPrice
  const save = async () => {
    if (!desc.trim()) return setErr('Vul een omschrijving in.')
    if (n == null || Number.isNaN(n) || n <= 0) return setErr('Vul een aantal in (groter dan 0).')
    if (p == null || Number.isNaN(p)) return setErr('Vul een prijs per eenheid in (zonder btw).')
    setBusy(true)
    setErr(null)
    const code = await projectCodeOf(dvId)
    if (!code) { setBusy(false); return setErr('Project niet gevonden.') }
    // eerst de prijslijst (eigen prijs), dan het artikel: zo blijft de opmerking "manueel toegevoegd"
    let listMsg = ''
    if (list && keep && priceChanged) {
      const r = await supabase.rpc('set_manual_item', { p_article_no: art.trim(), p_description: desc.trim(), p_supplier: list, p_price: p, p_origin: 'Bestellen' })
      if (r.error) { setBusy(false); return setErr('Prijslijst niet bijgewerkt: ' + r.error.message) }
      listMsg = ` Prijs bewaard in de prijslijst ${list === OWN_LIST ? 'Vonstruct (eigen)' : list}.`
    }
    const row = {
      project_code: code, category: cat, description: desc.trim(), article_no: art.trim() || null, supplier: list || null,
      qty: n, unit, unit_price: p, ordered_by: by,
    }
    const r = edit
      ? await supabase.from('project_extra_items').update(row).eq('id', Number(edit.extraId))
      : await supabase.from('project_extra_items').insert(row)
    setBusy(false)
    if (r.error) return setErr(r.error.message)
    onDone(`${edit ? 'Gewijzigd' : 'Toegevoegd'}: ${desc.trim()} (${cat}, ${fmtEur(n * p)}). Geldt voor alle versies van dit project.${listMsg}`)
  }

  const supplierOpts = lists.suppliers.includes(list) || !list || list === OWN_LIST ? lists.suppliers : [list, ...lists.suppliers]
  const byOpts = ['Vonstruct', ...lists.partners.filter((x) => x !== 'Vonstruct')]
  return (
    <div className="extra-form">
      <h3>{edit ? 'Artikel wijzigen' : 'Artikel toevoegen'}{cats.length === 1 ? ` in ${cat}` : ''}</h3>
      {!edit && (
        <>
          <div className="toolbar">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder="zoeken: artikelnummer (of naam)" />
            <button type="button" onClick={search}>Zoeken</button>
            <span className="small muted">eerst op artikelnummer, anders op tekst · of hieronder zelf invullen</span>
          </div>
          {hits && <p className="small muted">{how}{!hits.length && ' Vul het artikel hieronder zelf in.'}</p>}
          {hits && hits.length > 0 && (
            <ul className="extra-hits">
              {hits.map((h, i) => (
                <li key={i}>
                  <button type="button" className="link" onClick={() => pick(h)}>{h.description}</button>
                  <span className="small muted"> · {h.src === 'eigen' ? 'eigen prijs' : h.src === 'mail' ? 'uit een mail' : 'prijslijst'}{h.supplier ? ` · ${h.supplier}` : ''}{h.article_no ? ` · ${h.article_no}` : ''}</span>
                  {h.unit_price != null && <span className="small"> · {fmtEur(h.unit_price)}{h.unit ? ` / ${h.unit}` : ''}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="form-grid">
        <label className="wide">Omschrijving<input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="bv. Greep zwart 160 mm" /></label>
        <label>Artikelnummer<input value={art} onChange={(e) => setArt(e.target.value)} placeholder="optioneel" /></label>
        {cats.length > 1
          ? <label>Rubriek<select value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
          : <span />}
        <label>Aantal<input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label>Eenheid<select value={unit} onChange={(e) => setUnit(e.target.value)}>{(UNITS.includes(unit) ? UNITS : [unit, ...UNITS]).map((u) => <option key={u}>{u}</option>)}</select></label>
        <label>Prijs per eenheid (zonder btw)<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="€" /></label>
        <label>Prijslijst
          <select value={list} onChange={(e) => chooseList(e.target.value)}>
            <option value={OWN_LIST}>Vonstruct (eigen prijslijst)</option>
            {supplierOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="">Geen: enkel dit project</option>
          </select>
        </label>
        <label>Bestellen
          <select value={by} onChange={(e) => setBy(e.target.value)}>
            {byOpts.map((b) => <option key={b} value={b}>{b === 'Vonstruct' ? 'Vonstruct bestelt' : `${b} bestelt`}</option>)}
            <option value={NOT_ORDERED}>Niet bestellen (eigen werk of voorraad)</option>
          </select>
        </label>
        {list && (
          <label className="check wide">
            <input type="checkbox" checked={keep && priceChanged} disabled={!priceChanged} onChange={(e) => setKeep(e.target.checked)} />
            {priceChanged
              ? <>Prijs ook bewaren in de prijslijst {list === OWN_LIST ? 'Vonstruct (eigen)' : list}: geldt dan ook in volgende projecten</>
              : <>Prijs komt uit de prijslijst van {list}: niets apart te bewaren</>}
          </label>
        )}
      </div>
      {err && <p className="warn-text small">{err}</p>}
      <div className="toolbar">
        <button type="button" className="primary" disabled={busy} onClick={save}>{busy ? 'Bewaren…' : edit ? 'Bewaren' : 'Toevoegen'}</button>
        <button type="button" onClick={() => onDone(null)}>Annuleren</button>
        {n != null && p != null && !Number.isNaN(n) && !Number.isNaN(p) && <span className="small muted">Totaal {fmtEur(n * p)}</span>}
      </div>
    </div>
  )
}
