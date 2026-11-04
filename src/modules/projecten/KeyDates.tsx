import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'

/**
 * Sleutelmomenten van een project: deadline klant (+ reden), start van de werken (eerste werfdag: afbraak, onderaannemers, plaatsing)
 * en plaatsing (start + aantal werkdagen; zet ook target_install_week). De app rekent terug (view app_project_timeline):
 * eindopmeting tegen, bestellen tegen, productie start. Opvolging = Planning-agent (event `project_planning` bij elke wijziging
 * + `dagplanning` elke werkdag): stelt opdrachten, afspraken, berichten en taken voor. Geen vaste regels in de control tower.
 */
type T = {
  project_code: string; deadline: string | null; deadline_reason: string | null; works_start: string | null; install_start: string | null; install_days: number | null
  install_end: string | null; first_job: string | null; production_by: string | null; final_measure_by: string | null; final_measure_done: boolean
  order_by: string | null; order_by_supplier: string | null; target_install_week: string | null
}
const d = (v: string | null) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }) : '—')
const today = new Date().toLocaleDateString('sv-SE')

export function KeyDates({ code, onSaved }: { code: string; onSaved?: () => void }) {
  const [t, setT] = useState<T | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('app_project_timeline').select('*').eq('project_code', code).maybeSingle()
    setT(data as T | null)
  }, [code])
  useEffect(() => { load() }, [load])

  const save = async (patch: Partial<T>) => {
    const { error } = await supabase.from('projects').update(patch).eq('project_code', code)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); await load(); onSaved?.() }
  }
  const planFromDeadline = async () => {
    if (!t?.deadline) return
    const { data, error } = await supabase.rpc('latest_free_install_week', { p_deadline: t.deadline })
    if (error) return toast(error.message, 'err')
    if (!data) return toast('Geen vrije week meer vóór de deadline (Planning → Capaciteit)', 'err')
    if (confirm(`Plaatsing op maandag ${d(data as string)} zetten (laatste vrije week vóór de deadline)?`)) save({ install_start: data as string, install_days: t.install_days ?? 4 })
  }
  if (!t) return null

  const late = !!(t.deadline && t.install_end && t.install_end > t.deadline)
  // tijdlijn: enkel de momenten die er zijn, chronologisch
  const steps = [
    { k: 'Eindopmeting tegen', v: t.final_measure_by, done: t.final_measure_done },
    { k: 'Bestellen tegen' + (t.order_by_supplier ? ` (${t.order_by_supplier})` : ''), v: t.order_by, done: false },
    { k: 'Start van de werken', v: t.works_start ?? t.first_job, done: false, mine: true },
    { k: 'Productie start', v: t.production_by, done: false },
    { k: 'Plaatsing', v: t.install_start, done: false, mine: true, extra: t.install_end && t.install_end !== t.install_start ? ` → ${d(t.install_end)}` : '' },
    { k: 'Deadline klant' + (t.deadline_reason ? ` (${t.deadline_reason})` : ''), v: t.deadline, done: false, mine: true, deadline: true },
  ].filter((s) => s.v).sort((a, b) => a.v!.localeCompare(b.v!))

  return (
    <div className="panel keydates">
      <div className="tasks-head"><h2>Planning</h2>{t.deadline && <button className="link small" onClick={planFromDeadline}>Plan vanaf deadline</button>}</div>
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
      {late && <p className="notice bad-txt">Deadline in gevaar: de plaatsing is pas klaar op {d(t.install_end)}, de deadline is {d(t.deadline)}.</p>}
      {steps.length > 0 && (
        <ol className="kd-line">
          {steps.map((s, i) => (
            <li key={i} className={(s.v! < today ? 'past ' : '') + (s.done ? 'done ' : '') + (s.mine ? 'mine ' : '') + (s.deadline ? 'deadline' : '')}>
              <span className="kd-dot" />
              <b>{d(s.v)}{s.extra ?? ''}</b>
              <span>{s.k}{s.done ? ' ✓' : ''}</span>
            </li>
          ))}
        </ol>
      )}
      {!steps.length && <p className="muted small">Vul een deadline, de start van de werken of de plaatsing in; de app rekent eindopmeting, bestellen en productie terug.</p>}
    </div>
  )
}
