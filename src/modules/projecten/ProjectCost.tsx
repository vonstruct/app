import { useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur, fmtNum } from '../../core/format'
import { toast } from '../../core/toast'
import { useSearchParams } from 'react-router'
import { OwnArticleEditor } from '../../core/OwnArticle'

/**
 * Tab "Projectkost" op de projectpagina: de kostprijs van het project op detailniveau, in groepen.
 * Groepen = standaardgroepen uit de stuklijst (regel projectkost_groepen: platen, kanten en productie = "Kasten volgens 3D-plan", werkbladplaten = "Werkblad", de rest per rubriek) + eigen groepen. Eigen regels (met de hand, uit een prijslijst,
 * uit een mail of een nieuw artikel) blijven staan bij een nieuwe versie. De offerte wordt hieruit opgebouwd (quote_generate):
 * de klant ziet per groep titel, uitleg en prijs; Olivier ziet deze opbouw. Rekenen gebeurt in de views app_project_cost(_groups).
 * Knop "Offerte opbouwen" (sinds 7 nov 2026 weer: offertes worden in de app gemaakt) → quote_generate → tab Offerte.
 */
type Line = {
  project_code: string; kind: 'stuklijst' | 'eigen'; id: string; group_name: string; rubriek: string | null; sort: number; description: string; explanation: string | null
  supplier: string | null; article_no: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number; note: string | null
  line_key: string; no_price: boolean; in_stock: boolean; duplicate: boolean; source: string; source_ref: string | null; version: number | null; default_group?: string | null
  plate_key?: string | null // plaat: familie|dikte → voorraad per project (plate_stock)
}
type Group = {
  project_code: string; group_name: string; sort: number; client_title: string; client_text: string | null; vat_rate: number | null; margin_pct: number | null
  show_lines: boolean; is_custom: boolean; n_lines: number; cost: number; n_no_price: number; group_id: string | null; sell?: number | null; margin_eff?: number | null; vat_eff?: number | null
}
/** Zoekresultaat (RPC cost_search2): unit_price = per stuk; pack_qty/pack_price = verpakking (doos van N); pack_sure = al gedeeld door N. */
type Hit = { src: string; supplier: string | null; article_no: string | null; description: string; unit_price: number | null; unit: string | null; ref: string; seen: string | null; pack_qty?: number | null; pack_price?: number | null; pack_sure?: boolean | null }

const SRC: Record<string, string> = { stuklijst: 'stuklijst', hand: 'met de hand', prijslijst: 'prijslijst', mail: 'uit een mail', artikel: 'nieuw artikel', eigen: 'eigen artikel' }
const num = (s: string) => { const v = Number(String(s).trim().replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : NaN }

export function ProjectCost({ project, onQuote }: { project: string; onQuote: () => void }) {
  const gq = useQuery<Group[]>(() => supabase.from('app_project_cost_groups').select('*').eq('project_code', project).order('sort').order('group_name'), [project])
  const lq = useQuery<Line[]>(() => supabase.from('app_project_cost').select('*').eq('project_code', project).order('sort').order('description'), [project])
  const mq = useQuery<{ markup_pct: number | null; vat_pct: number | null; vat_reason: string | null; new_build: boolean; rule: number }>(async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('projects').select('markup_pct,vat_pct,vat_reason,new_build').eq('project_code', project).maybeSingle(),
      supabase.from('rule_settings').select('value').eq('key', 'projectmarge').maybeSingle(),
    ])
    const pp = p as { markup_pct: number | null; vat_pct: number | null; vat_reason: string | null; new_build: boolean } | null
    return { data: { markup_pct: pp?.markup_pct ?? null, vat_pct: pp?.vat_pct ?? null, vat_reason: pp?.vat_reason ?? null, new_build: !!pp?.new_build, rule: Number((r as { value: { pct?: number } } | null)?.value?.pct ?? 30) }, error: null }
  }, [project])
  const vq = useQuery<{ rate: number; reason: string; appliance_rate: number; mention: string | null; automatic: boolean } | null>(async () => {
    const { data, error } = await supabase.rpc('project_vat', { p_code: project })
    return { data: ((data ?? []) as never[])[0] ?? null, error }
  }, [project])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  // ?focus=prijzen (vanuit Vandaag of het Verloop): de groepen met artikels zonder prijs meteen open
  const [params] = useSearchParams()
  const focusPrices = params.get('focus') === 'prijzen'
  const openNoPrice = () => setOpen(Object.fromEntries((gq.data ?? []).filter((g) => g.n_no_price > 0).map((g) => [g.group_name, true])))
  useEffect(() => { if (focusPrices && gq.data) openNoPrice() }, [focusPrices, gq.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState<string | null>(null)
  const reload = () => { gq.reload(); lq.reload() }
  const groups = (gq.data ?? []).filter((g) => g.n_lines > 0 || g.group_id)
  const lines = lq.data ?? []
  const projectMargin = mq.data?.markup_pct ?? mq.data?.rule ?? 30
  const marginOf = (g: Group) => g.margin_eff ?? g.margin_pct ?? projectMargin
  const sellOf = (g: Group) => g.sell ?? Number(g.cost) * (1 + marginOf(g) / 100)
  const totCost = groups.reduce((a, g) => a + Number(g.cost), 0)
  const totSell = groups.reduce((a, g) => a + sellOf(g), 0)
  const noPrice = lines.filter((l) => l.no_price).length
  const version = lines.find((l) => l.version)?.version

  const saveGroup = async (g: Group, patch: Partial<Record<'sort' | 'client_title' | 'client_text' | 'vat_rate' | 'margin_pct' | 'show_lines' | 'is_custom', unknown>>) => {
    const { error } = await supabase.from('project_cost_groups').upsert({ project_code: project, name: g.group_name, is_custom: g.is_custom, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'project_code,name' })
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); reload() }
  }
  const moveLine = async (l: Line, to: string) => {
    if (!to || to === l.group_name) return
    let error
    if (l.kind === 'eigen') ({ error } = await supabase.from('project_cost_items').update({ group_name: to, updated_at: new Date().toISOString() }).eq('id', l.id))
    else if (to === (l.default_group ?? l.rubriek)) ({ error } = await supabase.from('project_cost_moves').delete().eq('project_code', project).eq('line_key', l.line_key))
    else ({ error } = await supabase.from('project_cost_moves').upsert({ project_code: project, line_key: l.line_key, group_name: to, updated_at: new Date().toISOString() }))
    if (error) return toast(error.message, 'err')
    toast(`Naar ${to}`); reload()
  }
  const newGroup = async (name: string, from?: Line) => {
    const n = name.trim()
    if (!n) return null
    const { error } = await supabase.from('project_cost_groups').upsert({ project_code: project, name: n, is_custom: true, show_lines: true, sort: Math.max(500, ...groups.map((g) => g.sort)) + 10 }, { onConflict: 'project_code,name' })
    if (error) { toast(error.message, 'err'); return null }
    if (from) await moveLine(from, n); else reload()
    return n
  }
  const askNewGroup = async (from?: Line) => { const n = window.prompt('Naam van de nieuwe groep (bv. Gyprocwerken, Werkblad, Plaatsing)'); if (n) await newGroup(n, from) }
  const merge = async (g: Group, to: string) => {
    for (const l of lines.filter((x) => x.group_name === g.group_name)) await moveLine(l, to)
  }
  const reorder = async (g: Group, dir: -1 | 1) => {
    const list = [...groups]; const i = list.findIndex((x) => x.group_name === g.group_name); const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    const rows = list.map((x, k) => ({ project_code: project, name: x.group_name, is_custom: x.is_custom, sort: (k + 1) * 10, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('project_cost_groups').upsert(rows, { onConflict: 'project_code,name' })
    if (error) toast(error.message, 'err'); else reload()
  }
  const toggleStock = async (l: Line) => {
    // een plaat uit eigen voorraad geldt enkel voor dit project (plate_stock); beslag e.d. blijft voor alle projecten
    if (l.plate_key) {
      const i = l.plate_key.lastIndexOf('|')
      const family = l.plate_key.slice(0, i), thickness = Number(l.plate_key.slice(i + 1))
      const { error } = l.in_stock
        ? await supabase.from('plate_stock').delete().eq('project_code', project).eq('family', family).eq('thickness_mm', thickness)
        : await supabase.from('plate_stock').insert({ project_code: project, family, thickness_mm: thickness, material_label: l.description })
      if (error) return toast(error.message, 'err')
      toast(l.in_stock ? `${l.description}: weer bestellen` : `${l.description} uit eigen voorraad: telt mee in de kost, komt niet op de bestellijst (enkel dit project)`)
      return reload()
    }
    const { error } = await supabase.from('stock_articles').upsert({ price_key: l.line_key, article_no: l.article_no, description: l.description, supplier: l.supplier, active: !l.in_stock, set_at: new Date().toISOString() })
    if (error) return toast(error.message, 'err')
    toast(l.in_stock ? `${l.description}: weer bestellen` : `${l.description} op voorraad: telt mee in de kost, komt niet op een bestellijst (ook in volgende projecten)`)
    reload()
  }
  const removeItem = async (l: Line) => {
    if (!confirm(`"${l.description}" uit de projectkost halen?`)) return
    const { error } = await supabase.from('project_cost_items').delete().eq('id', l.id)
    if (error) toast(error.message, 'err'); else { toast('Weggehaald'); reload() }
  }
  const vatChoice = mq.data?.vat_pct == null ? '' : Number(mq.data.vat_pct) === 0 ? `0:${mq.data.vat_reason === 'buitenland' ? 'buitenland' : 'verlegd'}` : String(Number(mq.data.vat_pct))
  const saveVat = async (v: string) => {
    const [pct, why] = v.split(':')
    const { error } = await supabase.from('projects').update({ vat_pct: v === '' ? null : Number(pct), vat_reason: v === '' ? null : why ?? 'zelf gekozen' }).eq('project_code', project)
    if (error) toast(error.message, 'err'); else { toast('Btw bewaard'); mq.reload(); vq.reload(); gq.reload() }
  }
  const saveNewBuild = async (on: boolean) => {
    const { error } = await supabase.from('projects').update({ new_build: on }).eq('project_code', project)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); mq.reload(); vq.reload(); gq.reload() }
  }
  const [building, setBuilding] = useState(false)
  const buildQuote = async () => {
    setBuilding(true)
    const { error } = await supabase.rpc('quote_generate', { p_code: project, p_margin: null })
    setBuilding(false)
    if (error) return toast(error.message, 'err')
    toast('Offerte opgebouwd uit de projectkost'); onQuote()
  }

  if (gq.loading || lq.loading) return <Loading />
  const groupNames = groups.map((g) => g.group_name)
  return (
    <div className="pcost">
      <ErrorBox error={gq.error ?? lq.error} />
      <div className="pcost-sum">
        <div><span className="lbl">Kostprijs</span><b>{fmtEur(totCost)}</b><small className="muted">{version ? `stuklijst v${version} + eigen regels` : 'nog geen berekende stuklijst'}</small></div>
        <div><span className="lbl">Voor de klant (± {fmtNum(projectMargin, 0)} % marge)</span><b>{fmtEur(totSell)}</b><small className="muted">excl. btw, per groep afgerond in de offerte</small></div>
        {noPrice > 0 && <button className="warn" onClick={openNoPrice}><span className="lbl">Zonder prijs</span><b>{noPrice}</b><small>toon ze · "prijs zoeken" of "zelf invullen"</small></button>}
        <div className="pcost-vat"><span className="lbl">Btw</span>
          <select value={vatChoice} onChange={(e) => saveVat(e.target.value)} aria-label="Btw van het project">
            <option value="">{mq.data?.new_build ? 'standaard: 21 % (nieuwbouw)' : 'standaard: 6 % (renovatie)'}</option>
            <option value="6">6 %</option><option value="21">21 %</option>
            <option value="0:verlegd">0 % btw verlegd (bedrijf)</option><option value="0:buitenland">0 % klant in het buitenland</option>
          </select>
          <small className="muted">{vq.data ? `${fmtNum(vq.data.rate, 0)} % · ${vq.data.reason} · toestellen ${fmtNum(vq.data.appliance_rate, 0)} % (kraan, spoelbak, dampkap: ${fmtNum(vq.data.rate, 0)} %)` : ''}</small>
          <label className="small"><input type="checkbox" checked={!!mq.data?.new_build} onChange={(e) => saveNewBuild(e.target.checked)} /> nieuwbouw of woning jonger dan 10 jaar</label>
        </div>
        <div className="pcost-actions">
          <button onClick={() => setAdding('Varia')}>+ Regel</button>
          <button onClick={() => askNewGroup()}>+ Groep</button>
          <button className="primary" disabled={building || !groups.length} onClick={buildQuote}>{building ? 'Bezig…' : 'Offerte opbouwen'}</button>
        </div>
      </div>
      {adding && <AddLine project={project} groups={groupNames} group={adding} onClose={() => setAdding(null)} onSaved={reload} />}
      {!groups.length && <p className="muted">Nog niets in de projectkost. Laad een ontwerp op uit PaletteCAD, of voeg zelf regels toe.</p>}
      {groups.map((g, gi) => {
        const ls = lines.filter((l) => l.group_name === g.group_name)
        const isOpen = open[g.group_name] ?? false
        return (
          <section key={g.group_name} className={'pcost-group' + (isOpen ? ' open' : '')}>
            <header onClick={() => setOpen((o) => ({ ...o, [g.group_name]: !isOpen }))}>
              <span className="chev" aria-hidden>{isOpen ? '▾' : '▸'}</span>
              <div className="pcg-name">
                <b>{g.group_name}</b>{g.client_title !== g.group_name && <span className="muted"> → klant ziet "{g.client_title}"</span>}
                <div className="small muted">
                  {[`${g.n_lines} regel${g.n_lines === 1 ? '' : 's'}`, g.is_custom ? 'eigen groep' : 'rubriek stuklijst', g.show_lines ? 'regels apart op de offerte' : 'één regel op de offerte',
                    g.vat_eff != null ? `btw ${fmtNum(g.vat_eff, 0)} %` : g.vat_rate ? `btw ${g.vat_rate} %` : null, g.margin_pct != null ? `marge ${fmtNum(g.margin_pct, 0)} %` : null].filter(Boolean).join(' · ')}
                  {g.n_no_price > 0 && <span className="tag t-noprice">{g.n_no_price} zonder prijs</span>}
                </div>
              </div>
              <div className="pcg-amt"><b>{fmtEur(g.cost)}</b><small className="muted">klant ± {fmtEur(sellOf(g))}</small></div>
              <div className="pcg-move" onClick={(e) => e.stopPropagation()}>
                <button className="link small" disabled={gi === 0} onClick={() => reorder(g, -1)} title="Hoger op de offerte">↑</button>
                <button className="link small" disabled={gi === groups.length - 1} onClick={() => reorder(g, 1)} title="Lager op de offerte">↓</button>
              </div>
            </header>
            {isOpen && (
              <div className="pcg-body">
                <GroupSettings g={g} others={groupNames.filter((n) => n !== g.group_name)} onSave={(p) => saveGroup(g, p)} onMerge={(to) => merge(g, to)} />
                <div className="table-wrap">
                  <table className="pcost-lines">
                    <thead><tr><th>Omschrijving</th><th>Leverancier</th><th className="num">Aantal</th><th className="num">Per stuk</th><th className="num">Kost</th><th>Groep</th><th title="Op voorraad: niet bestellen">Voorraad</th><th /></tr></thead>
                    <tbody>
                      {ls.map((l) => <LineRow key={l.kind + l.id} l={l} groups={groupNames} onMove={(to) => to === '__new' ? askNewGroup(l) : moveLine(l, to)} onStock={() => toggleStock(l)} onRemove={() => removeItem(l)} onSaved={reload} />)}
                    </tbody>
                  </table>
                </div>
                <button className="link small" onClick={() => setAdding(g.group_name)}>+ regel in {g.group_name}</button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function GroupSettings({ g, others, onSave, onMerge }: { g: Group; others: string[]; onSave: (p: Record<string, unknown>) => void; onMerge: (to: string) => void }) {
  const [title, setTitle] = useState(g.client_title)
  const [text, setText] = useState(g.client_text ?? '')
  const [vat, setVat] = useState(g.vat_rate == null ? '' : String(g.vat_rate))
  const [margin, setMargin] = useState(g.margin_pct == null ? '' : String(g.margin_pct).replace('.', ','))
  const [show, setShow] = useState(g.show_lines)
  const dirty = title !== g.client_title || text !== (g.client_text ?? '') || vat !== (g.vat_rate == null ? '' : String(g.vat_rate)) || margin !== (g.margin_pct == null ? '' : String(g.margin_pct).replace('.', ',')) || show !== g.show_lines
  const save = () => {
    const m = margin.trim() === '' ? null : num(margin)
    if (m !== null && isNaN(m)) return toast('Marge: vul een getal in, of laat leeg voor de projectmarge', 'err')
    onSave({ client_title: title.trim() === g.group_name ? null : title.trim(), client_text: text.trim() || null, vat_rate: vat === '' ? null : Number(vat), margin_pct: m, show_lines: show })
  }
  return (
    <div className="pcg-set">
      <label>Titel op de offerte<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="wide">Uitleg voor de klant<textarea rows={2} value={text} placeholder="leeg = de app maakt een korte uitleg (materialen, merken)" onChange={(e) => setText(e.target.value)} /></label>
      <label>Btw<select value={vat} onChange={(e) => setVat(e.target.value)}><option value="">zoals het project</option><option value="6">6 %</option><option value="21">21 %</option></select></label>
      <label>Marge %<input inputMode="decimal" value={margin} placeholder="projectmarge" onChange={(e) => setMargin(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> regels apart tonen aan de klant</label>
      <div className="pcg-set-act">
        <button className="primary" disabled={!dirty} onClick={save}>Bewaren</button>
        {others.length > 0 && (
          <select value="" onChange={(e) => e.target.value && onMerge(e.target.value)} title="Alle regels naar een andere groep">
            <option value="">Samenvoegen met…</option>{others.map((o) => <option key={o}>{o}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

function LineRow({ l, groups, onMove, onStock, onRemove, onSaved }: { l: Line; groups: string[]; onMove: (to: string) => void; onStock: () => void; onRemove: () => void; onSaved: () => void }) {
  const [find, setFind] = useState(false)
  const [own, setOwn] = useState(false)
  // eenheidsprijs van beslag en rubrieken uit de stuklijst aanpassen = eigen prijs (geldt ook voor volgende projecten)
  const priceEditable = l.kind === 'stuklijst' && !l.no_price && !['Platen', 'Kanten', 'Productiekosten', 'Lades', 'Uitbesteed'].includes(l.rubriek ?? '')
  // uitbesteed werk (andere firma maakt dit, bv. een werkblad): prijs = offerte van die firma, bewaard bij het project
  const outsourced = l.kind === 'stuklijst' && l.rubriek === 'Uitbesteed' && !!l.source_ref
  return (
    <>
      <tr className={l.no_price ? 'warn-row' : ''}>
        <td>
          {l.description}
          {l.explanation && <div className="small muted">{l.explanation}</div>}
          <div>
            {l.kind === 'eigen' && <span className="tag t-src">{SRC[l.source] ?? l.source}</span>}
            {outsourced && <span className="tag t-src" title="Een andere firma maakt dit; geen platen, kanten of productiekost. Wijzigen bij de versie › Platen.">uitbesteed{l.note && !l.no_price ? ` · ${l.note}` : ''}</span>}
            {l.no_price && <span className="tag t-noprice">geen prijs</span>}
            {l.duplicate && <span className="tag t-noprice" title="Hetzelfde artikel staat ook in de stuklijst">ook in de stuklijst</span>}
            {l.in_stock && <span className="tag t-stock">op voorraad</span>}
          </div>
        </td>
        <td>{l.supplier}{l.article_no && <div className="small muted">{l.article_no}</div>}</td>
        <td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}`}</td>
        <td className="num">{outsourced ? <OutsourcePriceEdit l={l} onSaved={onSaved} /> : priceEditable ? <PriceEdit l={l} onSaved={onSaved} /> : l.unit_price == null ? '' : fmtEur(l.unit_price)}</td>
        <td className="num">{fmtEur(l.total)}</td>
        <td>
          <select value={l.group_name} onChange={(e) => onMove(e.target.value)} aria-label="Groep">
            {groups.map((g) => <option key={g}>{g}</option>)}
            {l.kind === 'stuklijst' && (l.default_group ?? l.rubriek) && !groups.includes((l.default_group ?? l.rubriek)!) && <option value={(l.default_group ?? l.rubriek)!}>{l.default_group ?? l.rubriek} (standaard)</option>}
            <option value="__new">+ nieuwe groep…</option>
          </select>
        </td>
        <td className="pc-stock"><input type="checkbox" checked={l.in_stock} onChange={onStock} aria-label="Op voorraad" /></td>
        <td className="nowrap">
          {l.no_price && !outsourced && <button className="link small" onClick={() => { setFind((x) => !x); setOwn(false) }}>prijs zoeken</button>}
          {l.no_price && !outsourced && <button className="link small" onClick={() => { setOwn((x) => !x); setFind(false) }} title="Herkomst (bestellen, zelf maken, negeren) en prijs per stuk">zelf invullen</button>}
          {l.kind === 'eigen' && <button className="link small" onClick={onRemove}>weg</button>}
        </td>
      </tr>
      {own && (
        <tr className="find-row"><td colSpan={8}>
          <p className="small muted">Bestellen = bij een leverancier · Zelf maken = niet op een bestellijst · Negeren = telt nergens mee. Herkend op artikelnummer, anders op naam, ook in volgende projecten.</p>
          <OwnArticleEditor articleNo={l.article_no} description={l.description} supplier={l.supplier} onSaved={(m) => { toast(m); setOwn(false); onSaved() }} />
        </td></tr>
      )}
      {find && (
        <tr className="find-row"><td colSpan={8}>
          <PriceFinder query={l.description} onPick={async (h) => {
            const { error } = await supabase.rpc('set_manual_item', { p_article_no: l.article_no ?? '', p_description: l.description, p_supplier: h.supplier, p_price: h.unit_price, p_origin: 'Bestellen' })
            if (error) return toast(error.message, 'err')
            // het artikelnummer van de leverancier (prijslijst of factuur) mee bewaren, los van de herkenning op naam
            if (h.article_no) await supabase.rpc('set_manual_ref', { p_article_no: l.article_no ?? '', p_description: l.description, p_ref: h.article_no })
            toast(`Prijs bewaard: ${fmtEur(h.unit_price ?? 0)} per stuk (${h.supplier ?? h.src}). Geldt ook voor volgende projecten.`)
            setFind(false); onSaved()
          }} />
        </td></tr>
      )}
    </>
  )
}

/** Offerteprijs van de firma voor uitbesteed werk (project_outsourcing.amount); de kostregel volgt meteen (trigger). */
function OutsourcePriceEdit({ l, onSaved }: { l: Line; onSaved: () => void }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState('')
  const save = async () => {
    setEdit(false)
    const t = val.trim().replace(/\./g, '').replace(',', '.')
    const amount = t === '' ? null : Number(t)
    if (amount != null && isNaN(amount)) return
    if (!l.no_price && amount === Number(l.unit_price)) return
    const { error } = await supabase.from('project_outsourcing').update({ amount, updated_at: new Date().toISOString() }).eq('id', Number(l.source_ref))
    if (error) return toast(error.message, 'err')
    toast(amount == null ? 'Prijs leeggemaakt' : `Offerteprijs ${l.supplier ?? ''} bewaard: ${fmtEur(amount)}`); onSaved()
  }
  if (edit) return <input autoFocus className="price-input" inputMode="decimal" placeholder="offerteprijs" value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
  return <button type="button" className="price-btn" title={`Offerteprijs van ${l.supplier ?? 'de firma'} (excl. btw)`} onClick={() => { setVal(l.no_price || l.unit_price == null ? '' : String(l.unit_price).replace('.', ',')); setEdit(true) }}>{l.no_price || l.unit_price == null ? 'prijs invullen' : fmtEur(l.unit_price)}</button>
}

/** Eenheidsprijs aanklikken en wijzigen; bewaard als eigen prijs (RPC set_manual_price), ook voor volgende projecten. */
function PriceEdit({ l, onSaved }: { l: Line; onSaved: () => void }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState('')
  const save = async () => {
    setEdit(false)
    const v = val.trim().replace(/\./g, '').replace(',', '.')
    if (v === '' || isNaN(Number(v)) || Number(v) === Number(l.unit_price)) return
    const { error } = await supabase.rpc('set_manual_price', { p_article_no: l.article_no ?? '', p_description: l.description, p_supplier: l.supplier, p_price: Number(v) })
    if (error) return toast(error.message, 'err')
    toast(`Prijs voor "${l.description}" bewaard. Geldt ook voor volgende projecten.`); onSaved()
  }
  if (edit) return <input autoFocus className="price-input" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
  return <button type="button" className="price-btn" title="Prijs aanpassen (eigen prijs)" onClick={() => { setVal(l.unit_price == null ? '' : String(l.unit_price).replace('.', ',')); setEdit(true) }}>{l.unit_price == null ? '—' : fmtEur(l.unit_price)}</button>
}

/** Zoekt in eigen artikels, prijslijsten (Häfele, Du Pont, …) en de regels van bestellingen en facturen uit je mailbox. */
function PriceFinder({ query, onPick }: { query: string; onPick: (h: Hit) => void }) {
  const [q, setQ] = useState(query)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (text = q) => {
    setBusy(true)
    const { data, error } = await supabase.rpc('cost_search2', { p_q: text, p_limit: 15 })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    setHits((data ?? []) as Hit[])
  }
  useEffect(() => { if (query) run(query) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="finder">
      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} placeholder="naam of artikelnummer" />
        <button onClick={() => run()} disabled={busy}>{busy ? 'Zoeken…' : 'Zoeken'}</button>
        <span className="small muted">in eigen artikels, prijslijsten en bestellingen/facturen uit je mailbox</span>
      </div>
      {hits && !hits.length && <p className="small muted">Niets gevonden. Probeer een kortere naam of het artikelnummer.</p>}
      {hits && hits.length > 0 && (
        <table className="finder-hits">
          <tbody>
            {hits.map((h, i) => (
              <tr key={i}>
                <td><span className={'tag t-' + h.src}>{h.src === 'mail' ? 'mail' : h.src === 'eigen' ? 'eerder ingevuld' : 'prijslijst'}</span></td>
                <td>{h.description}<div className="small muted">{[h.supplier, h.article_no, h.seen && new Date(h.seen).toLocaleDateString('nl-BE')].filter(Boolean).join(' · ')}</div></td>
                <td className="num">
                  {h.unit_price == null ? '' : fmtEur(h.unit_price)}{h.unit ? <small className="muted"> / {h.unit}</small> : null}
                  {h.pack_qty && h.pack_price != null && h.pack_sure && <div className="small muted">doos van {fmtNum(h.pack_qty, 0)}: {fmtEur(h.pack_price)}</div>}
                  {h.pack_qty && h.pack_price != null && !h.pack_sure && <div className="small muted">verpakking per {fmtNum(h.pack_qty, 0)}</div>}
                </td>
                <td className="nowrap">
                  <button className="small" disabled={h.unit_price == null} onClick={() => onPick(h)}>{h.pack_qty && !h.pack_sure ? 'Kies (per stuk)' : 'Kies'}</button>
                  {/* twijfel: is de prijs per stuk of per verpakking van N? dan kies je zelf */}
                  {h.pack_qty && !h.pack_sure && h.pack_price != null && (
                    <button className="small" title={`De prijs geldt voor de verpakking van ${h.pack_qty}: delen door ${h.pack_qty}`} onClick={() => onPick({ ...h, unit_price: Math.round((h.pack_price! / h.pack_qty!) * 10000) / 10000 })}>÷ {fmtNum(h.pack_qty, 0)}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Regel toevoegen: zoeken (prijslijst/mail/eigen artikel), nieuw artikel (+ leverancier) of vrije regel met uitleg en prijs. */
function AddLine({ project, groups, group, onClose, onSaved }: { project: string; groups: string[]; group: string; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'zoeken' | 'artikel' | 'vrij'>('zoeken')
  const [g, setG] = useState(group)
  const [f, setF] = useState({ description: '', explanation: '', article_no: '', supplier: '', qty: '1', unit: 'stuk', price: '', source: 'hand', source_ref: '' })
  const [picked, setPicked] = useState(false)
  const sq = useQuery<{ name: string }[]>(() => supabase.from('suppliers').select('name').order('name'), [])
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const pick = (h: Hit) => {
    setF((x) => ({ ...x, description: h.description, article_no: h.article_no ?? '', supplier: h.supplier ?? '', unit: h.unit ?? 'stuk', price: h.unit_price == null ? '' : String(h.unit_price).replace('.', ','),
      source: h.src === 'mail' ? 'mail' : h.src === 'eigen' ? 'eigen' : 'prijslijst', source_ref: h.ref }))
    setPicked(true)
  }
  const save = async () => {
    const qty = num(f.qty), price = f.price.trim() === '' ? 0 : num(f.price)
    if (!f.description.trim()) return toast('Vul een omschrijving in', 'err')
    if (isNaN(qty) || isNaN(price)) return toast('Aantal en prijs: vul een getal in', 'err')
    if (!g.trim()) return toast('Kies een groep', 'err')
    let source = mode === 'vrij' ? 'hand' : f.source
    if (mode === 'artikel') {
      const { error } = await supabase.rpc('article_create', { p_article_no: f.article_no, p_description: f.description, p_supplier: f.supplier, p_price: price, p_unit: f.unit || null })
      if (error) return toast(error.message, 'err')
      source = 'artikel'
    }
    if (!groups.includes(g.trim())) await supabase.from('project_cost_groups').upsert({ project_code: project, name: g.trim(), is_custom: true, show_lines: true, sort: 900 }, { onConflict: 'project_code,name' })
    const { error } = await supabase.from('project_cost_items').insert({
      project_code: project, group_name: g.trim(), description: f.description.trim(), explanation: f.explanation.trim() || null, article_no: f.article_no.trim() || null,
      supplier: f.supplier.trim() || null, qty, unit: f.unit.trim() || null, unit_cost: price, source, source_ref: f.source_ref || null,
    })
    if (error) return toast(error.message, 'err')
    toast(`Toegevoegd aan ${g.trim()}`); onSaved(); onClose()
  }
  const form = (
    <div className="pcg-set">
      <label className="wide">Omschrijving<input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={mode === 'vrij' ? 'bv. Gyprocwerken keuken' : ''} /></label>
      <label className="wide">Uitleg (voor de klant als de regels apart staan)<textarea rows={2} value={f.explanation} onChange={(e) => set('explanation', e.target.value)} /></label>
      {mode !== 'vrij' && <label>Artikelnummer<input value={f.article_no} onChange={(e) => set('article_no', e.target.value)} /></label>}
      {mode !== 'vrij' && <label>Leverancier<input list="pc-suppliers" value={f.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="bestaand of nieuw" /></label>}
      <label>Aantal<input inputMode="decimal" value={f.qty} onChange={(e) => set('qty', e.target.value)} /></label>
      <label>Eenheid<input value={f.unit} onChange={(e) => set('unit', e.target.value)} /></label>
      <label>{mode === 'vrij' ? 'Prijs per eenheid (kost)' : 'Kostprijs per eenheid'}<input inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="€" /></label>
      <label>Groep<input list="pc-groups" value={g} onChange={(e) => setG(e.target.value)} /></label>
      <datalist id="pc-groups">{groups.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="pc-suppliers">{(sq.data ?? []).map((s) => <option key={s.name} value={s.name} />)}</datalist>
      <div className="pcg-set-act"><button className="primary" onClick={save}>Toevoegen</button><button className="link" onClick={onClose}>Annuleren</button></div>
    </div>
  )
  return (
    <section className="panel pcost-add">
      <div className="seg">
        <button className={mode === 'zoeken' ? 'on' : ''} onClick={() => { setMode('zoeken'); setPicked(false) }}>Zoeken in prijslijsten en mails</button>
        <button className={mode === 'artikel' ? 'on' : ''} onClick={() => setMode('artikel')}>Nieuw artikel</button>
        <button className={mode === 'vrij' ? 'on' : ''} onClick={() => setMode('vrij')}>Vrije regel</button>
      </div>
      {mode === 'zoeken' && !picked && <PriceFinder query="" onPick={pick} />}
      {mode === 'artikel' && <p className="small muted">Komt bij je eigen artikels (Rekenregels → Prijzen) en is volgende keer terug te vinden. Een nieuwe leverancier wordt mee aangemaakt.</p>}
      {mode === 'vrij' && <p className="small muted">Voor werk zonder artikel, zoals gyprocwerken, plaatsing of transport. Wil je de prijs zonder marge op de offerte, zet dan in de groep de marge op 0.</p>}
      {(mode !== 'zoeken' || picked) && form}
    </section>
  )
}
