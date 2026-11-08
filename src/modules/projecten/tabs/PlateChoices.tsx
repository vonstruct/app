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

const same = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.round(Number(a)) === Math.round(Number(b))

/**
 * Keuze per materiaal (sinds 8/11/2026): de optimizer probeert alle formaten van alle leveranciers (materiaalfamilie)
 * en kiest het voordeligste zaagplan. Hier zie je waarom, en kan je een ander plan vastzetten voor dit project
 * (tabel plate_locks: leverancier + hoofdformaat; geldt ook voor volgende versies). Na een keuze wordt opnieuw gerekend.
 */
export function PlateChoices({ sheets, dvId, projectCode, onChanged }: { sheets: ChoiceSheet[]; dvId: string; projectCode: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const groups: ChoiceSheet[] = []
  const seen = new Set<string>()
  for (const s of sheets) {
    const k = `${s.data?.family ?? s.material_label}|${s.thickness_mm}`
    if (!seen.has(k)) { seen.add(k); groups.push(s) }
  }
  if (!groups.some((g) => g.data?.alternatives)) {
    return sheets.length ? <p className="muted small">Klik <b>Herberekenen</b> om per materiaal te zien welke formaten en leveranciers vergeleken werden.</p> : null
  }

  const choose = async (g: ChoiceSheet, value: string) => {
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
    const r = await supabase.functions.invoke('recalc', { body: { design_version_id: dvId } })
    const err = (r.data as { error?: string } | null)?.error ?? (r.error ? 'de herberekening kon niet gestart worden' : null)
    setBusy(null)
    if (err) toast(`Keuze bewaard, maar ${err}. Klik later op Herberekenen.`, 'err')
    else { toast('Keuze bewaard. De platen worden opnieuw berekend (± 1 minuut).'); window.dispatchEvent(new Event('vonstruct:recalc')) }
    onChanged()
  }

  return (
    <div className="pc-list">
      <h3 className="vt-h">Keuze per materiaal</h3>
      <p className="muted small">De optimizer probeert alle formaten bij alle leveranciers en kiest het voordeligste zaagplan. Kies een ander plan om het voor dit project vast te zetten; dat geldt ook voor de volgende versies.</p>
      {groups.map((g) => {
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
            </div>
            {d.family && alts.length > 0 && (
              <select className="pc-pick" value={lk ? (idx >= 0 ? String(idx) : 'lock') : 'auto'} disabled={busy === key} onChange={(e) => choose(g, e.target.value)}>
                <option value="auto">Automatisch: voordeligste</option>
                {lk && idx < 0 && <option value="lock">Vast: {lk.supplier}{lk.length_mm ? ` ${Math.round(lk.length_mm)}×${Math.round(lk.width_mm ?? 0)}` : ''}</option>}
                {alts.map((a, i) => (
                  <option key={i} value={String(i)}>
                    {a.plan} · {a.suppliers.join(' + ')} · {fmtEur(a.cost)}{a.unfit ? ` · ${a.unfit} past niet` : ''}{a.chosen ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}
