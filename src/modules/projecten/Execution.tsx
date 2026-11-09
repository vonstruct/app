import { useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'

/**
 * Uitvoering van een plaatmateriaal in een project (9/11/2026, vervangt "besteld door" en het vinkje "onderaannemer"):
 * - Vonstruct = plaatkost telt mee, Vonstruct bestelt (tabel plate_execution);
 * - een partner (Vlinth) = plaatkost + productiekost, op de bestelling van de partner (plate_execution);
 * - een firma (regel uitvoering_platen, bv. GF Group, of "Andere…") = uitbesteed: enkel de offerteprijs (project_outsourcing).
 * Daarna wordt de versie opnieuw berekend (platen, kanten, productiekost), behalve als enkel de firma wijzigt.
 */
export type ExecOptions = { partners: string[]; firms: string[] }

let cache: Promise<ExecOptions> | null = null
function loadExecOptions() {
  cache ??= (async () => {
    const [p, r] = await Promise.all([
      supabase.from('partners').select('name').eq('active', true),
      supabase.from('rule_settings').select('value').eq('key', 'uitvoering_platen').maybeSingle(),
    ])
    if (p.error || r.error) { cache = null; return { partners: ['Vlinth'], firms: [] } }
    const partners = (p.data ?? []).map((x: { name: string }) => x.name).filter(Boolean)
    const firms = ((r.data?.value as { firmas?: string[] } | null)?.firmas ?? []).map((f) => String(f).trim()).filter(Boolean)
    return { partners, firms }
  })()
  return cache
}

export function useExecOptions(): ExecOptions {
  const [o, setO] = useState<ExecOptions>({ partners: [], firms: [] })
  useEffect(() => { let live = true; loadExecOptions().then((x) => live && setO(x)).catch(() => {}); return () => { live = false } }, [])
  return o
}

export const isInHouse = (who: string, o: ExecOptions) => who === 'Vonstruct' || who === 'Zelf' || o.partners.includes(who)

/** Bewaart de keuze. Geeft true als de versie opnieuw berekend moet worden. */
export async function saveExecution(p: {
  projectCode: string; family: string; thickness: number | null; label: string; to: string; opts: ExecOptions
  outsourcingId?: number | null
}): Promise<boolean> {
  const { projectCode, thickness, label, to, opts, outsourcingId } = p
  let family = p.family
  if (!family && outsourcingId) {
    const { data } = await supabase.from('project_outsourcing').select('family').eq('id', outsourcingId).maybeSingle()
    family = (data as { family?: string } | null)?.family ?? ''
  }
  if (!family) { toast('Dit materiaal is niet herkend; herbereken de versie eerst', 'err'); return false }
  if (!isInHouse(to, opts)) {
    if (outsourcingId) {
      // enkel een andere firma: de kostregel en de bestellijst volgen meteen (trigger project_outsourcing_apply)
      const { error } = await supabase.from('project_outsourcing').update({ firm: to, updated_at: new Date().toISOString() }).eq('id', outsourcingId)
      if (error) { toast(error.message, 'err'); return false }
      toast(`${label}: uitgevoerd door ${to}`)
      return false
    }
    if (!confirm(`${label} laten uitvoeren door ${to}?\n\nAlle diktes van dit materiaal in dit project: geen platen, kanten of productiekost meer, enkel de offerteprijs van ${to} (vul je daarna in bij Totaal).`)) return false
    const { error } = await supabase.from('project_outsourcing').insert({ project_code: projectCode, family, material_label: label, firm: to, amount: null, description: label })
    if (error) { toast(error.message, 'err'); return false }
    return true
  }
  if (outsourcingId) {
    if (!confirm(`${label} terug laten uitvoeren door ${to}? Dan komen de platen, kanten en productiekost terug en verdwijnt de offerteprijs.`)) return false
    const { error } = await supabase.from('project_outsourcing').delete().eq('id', outsourcingId)
    if (error) { toast(error.message, 'err'); return false }
  }
  // dikte 0 = alle diktes van dit materiaal (voor een regel die uitbesteed was: die heeft geen dikte)
  const { error } = await supabase.from('plate_execution').upsert(
    { project_code: projectCode, family, thickness_mm: thickness ?? 0, material_label: label, executor: to, updated_at: new Date().toISOString() },
    { onConflict: 'project_code,family,thickness_mm' },
  )
  if (error) { toast(error.message, 'err'); return false }
  return true
}

/** Keuzelijst Uitvoering in een tabelcel: Vonstruct, partners, vaste firma's, "Andere…" (typen, met de firma's uit Relaties). */
export function ExecutionSelect({ value, opts, onPick, disabled, listId }: {
  value: string; opts: ExecOptions; onPick: (to: string) => void; disabled?: boolean; listId?: string
}) {
  const [other, setOther] = useState(false)
  const [v, setV] = useState('')
  const shown = value === 'Zelf' ? 'Vonstruct' : value
  const list = [...new Set(['Vonstruct', ...opts.partners, ...opts.firms, shown].filter(Boolean))]
  if (other) {
    return (
      <input autoFocus className="cell-input" list={listId} placeholder="naam van de firma" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { setOther(false); if (v.trim() && v.trim() !== shown) onPick(v.trim()) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(''); setOther(false) } }} />
    )
  }
  return (
    <select className="cell-select" value={shown} disabled={disabled} aria-label="Uitvoering"
      title="Wie voert dit uit: Vonstruct (zelf bestellen), de partner (met productiekost) of een firma (enkel haar offerteprijs)"
      onChange={(e) => { const t = e.target.value; if (t === '__other') { setV(''); setOther(true) } else if (t !== shown) onPick(t) }}>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__other">Andere…</option>
    </select>
  )
}

/** Herberekening starten (platen, kanten, productiekost); de Kostprijs en de versie tonen de status. */
export async function startRecalc(dvId: string, done: string) {
  const r = await supabase.functions.invoke('recalc', { body: { design_version_id: dvId } })
  const err = (r.data as { error?: string } | null)?.error ?? (r.error ? 'de herberekening kon niet gestart worden' : null)
  if (err) { toast(`Bewaard, maar ${err}. Klik later op Herberekenen.`, 'err'); return false }
  toast(`${done} De platen en kosten worden opnieuw berekend (± 1 minuut).`)
  window.dispatchEvent(new Event('vonstruct:recalc'))
  return true
}
