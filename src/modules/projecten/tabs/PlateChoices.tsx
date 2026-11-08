import { useState } from 'react'
import { supabase } from '../../../core/supabase'
import { toast } from '../../../core/toast'
import { fmtEur, fmtNum } from '../../../core/format'

export type Alt = {
  plan: string; suppliers: string[]; supplier: string; length_mm: number; width_mm: number
  count: number; cost: number; unfit: number; chosen: boolean
}
export type SheetData = {
  family?: string; family_name?: string | null; labels?: string[]; plan?: string; plan_cost?: number; suppliers?: string[]
  reasons?: string[]; alternatives?: Alt[]; fixed?: string | null; description?: string | null; note?: string | null
  locked?: { supplier: string; length_mm: number | null; width_mm: number | null } | null; bekleding?: boolean
}
export type ChoiceSheet = { id: string; material_label: string; thickness_mm: number; data: SheetData | null }
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
 * Keuze per materiaal (sinds 8/11/2026): de optimizer probeert alle formaten van alle leveranciers (materiaalfamilie)
 * en kiest het voordeligste zaagplan. Hier zie je waarom, en kan je een ander plan vastzetten voor dit project
 * (tabel plate_locks: leverancier + hoofdformaat; geldt ook voor volgende versies). Na een keuze wordt opnieuw gerekend.
 * "Uitbesteden" (project_outsourcing): een andere firma maakt dit materiaal (bv. een werkblad); geen platen, kanten of
 * productiekost, wel één kostregel met de offerteprijs van die firma.
 */
export function PlateChoices({ sheets, dvId, projectCode, outsourcing, firms, onChanged }: {
  sheets: ChoiceSheet[]; dvId: string; projectCode: string; outsourcing: Outsourcing[]; firms: string[]; onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState<{ key: string; family: string; label: string; row?: Outsourcing } | null>(null)
  const groups: ChoiceSheet[] = []
  const seen = new Set<string>()
  for (const s of sheets) {
    const k = `${s.data?.family ?? s.material_label}|${s.thickness_mm}`
    if (!seen.has(k)) { seen.add(k); groups.push(s) }
  }
  const outFams = new Set(outsourcing.map((o) => o.family))
  const shown = groups.filter((g) => !g.data?.family || !outFams.has(g.data.family))
  if (!shown.some((g) => g.data?.alternatives) && !outsourcing.length) {
    return sheets.length ? <p className="muted small">Klik <b>Herberekenen</b> om per materiaal te zien welke formaten en leveranciers vergeleken werden.</p> : null
  }

  const choose = async (g: ChoiceSheet, value: string) => {
    const d = g.data ?? {}
    if (!d.family) return
    const key = `${d.family}|${g.thickness_mm}`
    if (value === 'out') { setForm({ key, family: d.family, label: g.material_label }); return }
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

  const backInHouse = async (o: Outsourcing) => {
    if (!confirm(`${o.material_label ?? o.family} terug zelf laten maken? Dan komen de platen en kanten terug in de berekening en verdwijnt de regel van ${o.firm}.`)) return
    setBusy(o.family)
    const { error } = await supabase.from('project_outsourcing').delete().eq('id', o.id)
    if (error) { setBusy(null); toast(error.message, 'err'); return }
    await recalc(dvId, 'Terug zelf maken.')
    setBusy(null)
    onChanged()
  }

  return (
    <div className="pc-list">
      <h3 className="vt-h">Keuze per materiaal</h3>
      <p className="muted small">De optimizer probeert alle formaten bij alle leveranciers en kiest het voordeligste zaagplan. Kies een ander plan om het voor dit project vast te zetten (geldt ook voor de volgende versies), of laat een materiaal maken door een andere firma.</p>
      {outsourcing.map((o) => (
        <div key={`o${o.id}`} className="pc-row">
          <div className="pc-main">
            <div><b>{o.material_label ?? o.family}</b> <span className="chip gold" style={{ marginLeft: 8 }}>uitbesteed</span></div>
            <div className="pc-plan">
              Gemaakt door <b>{o.firm}</b> · {o.amount == null ? <span className="bad-text">offerteprijs nog invullen</span> : <b>{fmtEur(o.amount)}</b>}
              {o.quote_ref ? <span className="muted"> · offerte {o.quote_ref}</span> : null}
            </div>
            <ul className="pc-why">
              <li>geen platen, kanten of productiekost voor dit materiaal; één kostregel "{o.description || o.material_label || o.family}" met de offerteprijs (groep Werkblad of Uitbesteed in de Kostprijs)</li>
            </ul>
            {form?.row?.id === o.id && <OutsourceForm projectCode={projectCode} dvId={dvId} family={o.family} label={o.material_label ?? o.family} row={o} onDone={() => { setForm(null); onChanged() }} />}
          </div>
          <div className="pc-actions">
            <button className="link small" onClick={() => setForm(form?.row?.id === o.id ? null : { key: `o${o.id}`, family: o.family, label: o.material_label ?? o.family, row: o })}>Wijzigen</button>
            <button className="link small" disabled={busy === o.family} onClick={() => backInHouse(o)}>Terug zelf laten maken</button>
          </div>
        </div>
      ))}
      {shown.map((g) => {
        const d = g.data ?? {}
        const alts = d.alternatives ?? []
        const lk = d.locked
        const idx = lk ? alts.findIndex((a) => a.supplier === lk.supplier && (lk.length_mm == null || (same(a.length_mm, lk.length_mm) && same(a.width_mm, lk.width_mm)))) : -1
        const key = `${d.family}|${g.thickness_mm}`
        return (
          <div key={g.id} className="pc-row">
            <div className="pc-main">
              <div>
                <b>{g.material_label}</b> <span className="muted">{fmtNum(g.thickness_mm)} mm</span>
                {lk && <span className="chip gold" style={{ marginLeft: 8 }}>met de hand gekozen</span>}
                {d.bekleding && <span className="chip" style={{ marginLeft: 8 }}>bekleding</span>}
              </div>
              <div className="pc-plan">
                {d.plan} · {(d.suppliers ?? []).join(' + ') || '—'} · <b>{fmtEur(d.plan_cost)}</b>
              </div>
              {!!d.reasons?.length && (
                <ul className="pc-why">{d.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              )}
              {form?.key === key && !form.row && (
                <OutsourceForm projectCode={projectCode} dvId={dvId} family={form.family} label={form.label} onDone={() => { setForm(null); onChanged() }} onCancel={() => setForm(null)} />
              )}
            </div>
            {d.family && (
              <select className="pc-pick" value={form?.key === key && !form.row ? 'out' : lk ? (idx >= 0 ? String(idx) : 'lock') : 'auto'} disabled={busy === key} onChange={(e) => choose(g, e.target.value)}>
                <option value="auto">Automatisch: voordeligste</option>
                {lk && idx < 0 && <option value="lock">Vast: {lk.supplier}{lk.length_mm ? ` ${Math.round(lk.length_mm)}×${Math.round(lk.width_mm ?? 0)}` : ''}</option>}
                {alts.map((a, i) => (
                  <option key={i} value={String(i)}>
                    {a.plan} · {a.suppliers.join(' + ')} · {fmtEur(a.cost)}{a.unfit ? ` · ${a.unfit} past niet` : ''}{a.chosen ? ' ✓' : ''}
                  </option>
                ))}
                <option value="out">Uitbesteden: een andere firma maakt dit…</option>
              </select>
            )}
          </div>
        )
      })}
      <datalist id="pc-firms">{firms.map((f) => <option key={f} value={f} />)}</datalist>
    </div>
  )
}

/** Uitbesteden of de uitbesteding wijzigen: firma, offerteprijs (excl. btw, mag later), omschrijving, offertenummer. */
function OutsourceForm({ projectCode, dvId, family, label, row, onDone, onCancel }: {
  projectCode: string; dvId: string; family: string; label: string; row?: Outsourcing; onDone: () => void; onCancel?: () => void
}) {
  const [firm, setFirm] = useState(row?.firm ?? '')
  const [amount, setAmount] = useState(row?.amount == null ? '' : String(row.amount).replace('.', ','))
  const [description, setDescription] = useState(row?.description ?? label)
  const [quoteRef, setQuoteRef] = useState(row?.quote_ref ?? '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!firm.trim()) { toast('Vul de firma in', 'err'); return }
    const t = amount.trim().replace(/\./g, '').replace(',', '.')
    const value = t === '' ? null : Number(t)
    if (value != null && isNaN(value)) { toast('Offerteprijs is geen getal', 'err'); return }
    setBusy(true)
    const fields = { firm: firm.trim(), amount: value, description: description.trim() || null, quote_ref: quoteRef.trim() || null, updated_at: new Date().toISOString() }
    const { error } = row
      ? await supabase.from('project_outsourcing').update(fields).eq('id', row.id)
      : await supabase.from('project_outsourcing').insert({ project_code: projectCode, family, material_label: label, ...fields })
    if (error) { setBusy(false); toast(error.message, 'err'); return }
    if (row) toast('Uitbesteding bijgewerkt')
    else await recalc(dvId, `Uitbesteed aan ${firm.trim()}.`)
    setBusy(false)
    onDone()
  }
  return (
    <div className="pc-form">
      <label>Firma<input list="pc-firms" value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="wie maakt het" /></label>
      <label>Offerteprijs excl. btw<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="later invullen mag" /></label>
      <label>Omschrijving<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label>Offertenummer firma<input value={quoteRef} onChange={(e) => setQuoteRef(e.target.value)} placeholder="optioneel" /></label>
      <div className="toolbar">
        <button className="primary" disabled={busy} onClick={save}>{busy ? 'Bezig…' : row ? 'Bewaren' : 'Uitbesteden'}</button>
        {onCancel && <button className="link" onClick={onCancel}>Annuleren</button>}
      </div>
      {!row && <p className="small muted">Geen platen, kanten of productiekost meer voor dit materiaal in dit project; wel één kostregel met de offerteprijs, ook op de bestellijst bij die firma.</p>}
    </div>
  )
}
