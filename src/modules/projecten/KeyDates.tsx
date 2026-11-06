import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'

/**
 * Datums van een project (view app_project_timeline) en de stage gates (view app_project_gates: due / done_at / passed).
 * Zelf in te vullen: deadline klant (+ reden), start van de werken (eerste werfdag) en plaatsing (start + dagen, ook weekend).
 * De app rekent terug. Getoond in het Verloop op het Overzicht (Overview.tsx); "Datums wijzigen" opent DatesForm.
 */
export type Timeline = {
  project_code: string; deadline: string | null; deadline_reason: string | null; works_start: string | null; install_start: string | null; install_days: number | null
  install_end: string | null; first_job: string | null; production_by: string | null; final_measure_by: string | null; final_measure_done: boolean
  order_by: string | null; order_by_supplier: string | null; target_install_week: string | null
}
export type Gate = { stage: string; label: string; gate_label: string; sort: number; n: number; n_done: number; done_at: string | null; passed: boolean; due: string | null }

export const dayLabel = (v: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00' : v).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }) : '—')

export function useTimeline(code: string, onSaved?: () => void) {
  const [t, setT] = useState<Timeline | null>(null)
  const [gates, setGates] = useState<Gate[]>([])
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('app_project_timeline').select('*').eq('project_code', code).maybeSingle(),
      supabase.from('app_project_gates').select('*').eq('project_code', code).order('sort'),
    ])
    setT(a.data as Timeline | null); setGates((b.data as Gate[]) ?? [])
  }, [code])
  useEffect(() => { load() }, [load])
  const save = async (patch: Partial<Timeline>) => {
    const { error } = await supabase.from('projects').update(patch).eq('project_code', code)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); await load(); onSaved?.() }
  }
  return { t, gates, load, save }
}

/** Formulier "Datums wijzigen": deadline, start van de werken, plaatsing (+ dagen), en "plan vanaf deadline". */
export function DatesForm({ t, save, onClose }: { t: Timeline; save: (patch: Partial<Timeline>) => Promise<void>; onClose: () => void }) {
  const planFromDeadline = async () => {
    if (!t.deadline) return
    const { data, error } = await supabase.rpc('latest_free_install_week', { p_deadline: t.deadline })
    if (error) return toast(error.message, 'err')
    if (!data) return toast('Geen vrije week meer vóór de deadline (Planning → Capaciteit)', 'err')
    if (confirm(`Plaatsing op maandag ${dayLabel(data as string)} zetten (laatste vrije week vóór de deadline)?`)) save({ install_start: data as string, install_days: t.install_days ?? 4 })
  }
  const late = !!(t.deadline && t.install_end && t.install_end > t.deadline)
  return (
    <div className="ov-dates">
      <div className="kd-fields">
        <label>Deadline klant
          <input type="date" defaultValue={t.deadline ?? ''} key={'dl' + t.deadline} onBlur={(e) => (e.target.value || null) !== t.deadline && save({ deadline: e.target.value || null })} />
        </label>
        <label>Reden (optioneel)
          <input defaultValue={t.deadline_reason ?? ''} key={'dr' + t.deadline_reason} placeholder="bv. verhuis, feest" onBlur={(e) => (e.target.value.trim() || null) !== t.deadline_reason && save({ deadline_reason: e.target.value.trim() || null })} />
        </label>
        <label>Start van de werken
          <input type="date" defaultValue={t.works_start ?? ''} key={'ws' + t.works_start} onBlur={(e) => (e.target.value || null) !== t.works_start && save({ works_start: e.target.value || null })} />
          <small className="muted">eerste werfdag: afbraak, onderaannemers of plaatsing</small>
        </label>
        <label>Plaatsing vanaf
          <input type="date" defaultValue={t.install_start ?? ''} key={'is' + t.install_start} onBlur={(e) => (e.target.value || null) !== t.install_start && save({ install_start: e.target.value || null })} />
          {!t.install_start && t.target_install_week && <small className="muted">nu enkel week {t.target_install_week.split('-W')[1]}</small>}
        </label>
        <label>Dagen plaatsing (ook weekend)
          <input type="number" min={1} max={30} defaultValue={t.install_days ?? ''} key={'id' + t.install_days} placeholder="4" onBlur={(e) => (e.target.value ? Number(e.target.value) : null) !== t.install_days && save({ install_days: e.target.value ? Number(e.target.value) : null })} />
        </label>
      </div>
      {late && <p className="notice bad-txt">Deadline in gevaar: de plaatsing is pas klaar op {dayLabel(t.install_end)}, de deadline is {dayLabel(t.deadline)}.</p>}
      <div className="toolbar small">
        {t.deadline && <button className="link small" onClick={planFromDeadline}>plan de plaatsing vanaf de deadline</button>}
        <button className="link small" onClick={onClose}>klaar</button>
      </div>
    </div>
  )
}
