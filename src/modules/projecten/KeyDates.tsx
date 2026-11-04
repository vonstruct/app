import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'

/**
 * Planning van een project = de enige tijdlijn op de projectpagina: bovenaan de fases (✓ voorbij, "nu" = waar het project staat,
 * met tegen wanneer), daaronder de datums. Zelf in te vullen: deadline klant (+ reden), start van de werken (eerste werfdag) en plaatsing
 * (start + dagen, ook weekend). De app rekent terug (view app_project_timeline) en toont per stage gate tegen wanneer
 * die klaar moet zijn of wanneer ze klaar was (view app_project_gates: due / done_at). Ingevuld = ingeklapt, "wijzigen" klapt open.
 * Opvolging = Planning-agent (events project_planning + dagplanning), geen vaste regels in de control tower.
 */
type T = {
  project_code: string; deadline: string | null; deadline_reason: string | null; works_start: string | null; install_start: string | null; install_days: number | null
  install_end: string | null; first_job: string | null; production_by: string | null; final_measure_by: string | null; final_measure_done: boolean
  order_by: string | null; order_by_supplier: string | null; target_install_week: string | null
}
type G = { stage: string; label: string; gate_label: string; sort: number; n: number; n_done: number; done_at: string | null; passed: boolean; due: string | null }
type Entry = { date: string; label: string; sub?: string; kind: 'gate' | 'moment' | 'mine' | 'deadline' | 'today'; state?: 'ok' | 'late' | 'open' | 'risk' }

const d = (v: string | null) => (v ? new Date(v + 'T12:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }) : '—')
const today = new Date().toLocaleDateString('sv-SE')
const days = (a: string, b: string) => Math.round((+new Date(a + 'T12:00') - +new Date(b + 'T12:00')) / 864e5)

export function KeyDates({ code, onSaved }: { code: string; onSaved?: () => void }) {
  const [t, setT] = useState<T | null>(null)
  const [gates, setGates] = useState<G[]>([])
  const [edit, setEdit] = useState<boolean | null>(null)
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('app_project_timeline').select('*').eq('project_code', code).maybeSingle(),
      supabase.from('app_project_gates').select('*').eq('project_code', code).order('sort'),
    ])
    setT(a.data as T | null); setGates((b.data as G[]) ?? [])
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
  const hasDates = !!(t.deadline || t.works_start || t.install_start)
  const open = edit ?? !hasDates
  const late = !!(t.deadline && t.install_end && t.install_end > t.deadline)

  // tijdlijn: stage gates (tegen / klaar) + momenten, chronologisch, met "vandaag"
  const E: Entry[] = []
  for (const g of gates) {
    const done = !!g.done_at
    if (g.stage === 'lead' || (!done && !g.due) || (g.stage === 'design' && !done)) continue
    if (done) {
      const lateBy = g.due ? days(g.done_at!, g.due) : 0
      E.push({ date: g.done_at!, label: g.gate_label, kind: 'gate', state: lateBy > 0 ? 'late' : 'ok', sub: lateBy > 0 ? `klaar · ${lateBy} d te laat (moest ${d(g.due)})` : 'klaar ✓' })
    } else if (g.passed) {
      E.push({ date: g.due!, label: g.gate_label, kind: 'gate', state: 'late', sub: `doorgegaan · ${g.n - g.n_done} punt${g.n - g.n_done === 1 ? '' : 'en'} open` })
    } else {
      const over = g.due! < today
      E.push({ date: g.due!, label: g.gate_label, kind: 'gate', state: over ? 'risk' : 'open', sub: `${over ? `${days(today, g.due!)} d te laat · ` : 'klaar tegen · '}${g.n_done}/${g.n} punten` })
    }
  }
  if (t.final_measure_by && !t.final_measure_done) E.push({ date: t.final_measure_by, label: 'Eindopmeting', sub: 'tegen', kind: 'moment', state: t.final_measure_by < today ? 'risk' : 'open' })
  if (t.order_by) E.push({ date: t.order_by, label: 'Bestellen', sub: 'tegen' + (t.order_by_supplier ? ` · ${t.order_by_supplier}` : ''), kind: 'moment', state: t.order_by < today ? 'risk' : 'open' })
  if (t.works_start ?? t.first_job) E.push({ date: (t.works_start ?? t.first_job)!, label: 'Start van de werken', sub: t.works_start ? undefined : 'eerste opdracht', kind: 'mine' })
  if (t.install_start) E.push({ date: t.install_start, label: 'Plaatsing', sub: t.install_end && t.install_end !== t.install_start ? `tot ${d(t.install_end)}` : undefined, kind: 'mine' })
  if (t.deadline) E.push({ date: t.deadline, label: 'Deadline klant', sub: t.deadline_reason ?? undefined, kind: 'deadline', state: late ? 'risk' : undefined })
  E.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'gate' ? 1 : -1))
  // waar staan we nu: de eerste fase die nog niet voorbij is
  const current = gates.find((g) => !g.passed)
  if (E.length) { const i = E.findIndex((e) => e.date > today); E.splice(i < 0 ? E.length : i, 0, { date: today, label: current ? `Vandaag · nu in ${current.label}` : 'Vandaag', kind: 'today' }) }

  return (
    <div className="panel keydates">
      <div className="tasks-head">
        <h2>Planning</h2>
        <span className="small">
          {t.deadline && <><button className="link small" onClick={planFromDeadline}>plan vanaf deadline</button>{hasDates ? ' · ' : ''}</>}
          {hasDates && <button className="link small" onClick={() => setEdit(!open)}>{open ? 'klaar' : 'wijzigen'}</button>}
        </span>
      </div>
      {open && (
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
      )}
      {gates.length > 0 && (
        <ol className="kd-steps" style={{ gridTemplateColumns: `repeat(${gates.length}, minmax(0, 1fr))` }}>
          {gates.map((g) => {
            const now = g === current
            const st = g.passed ? 'done' : now ? 'now' : 'next'
            const lateDue = !g.passed && g.due && g.due < today && g.n_done < g.n
            return (
              <li key={g.stage} className={st + (lateDue ? ' late' : '')} title={g.gate_label}>
                <b>{g.label}</b>
                <small>{g.passed ? `✓${g.done_at ? ' ' + d(g.done_at) : ''}` : now ? `nu · ${g.n_done}/${g.n}${g.due ? ' · tegen ' + d(g.due) : ''}` : g.due ? 'tegen ' + d(g.due) : ''}</small>
              </li>
            )
          })}
        </ol>
      )}
      {late && <p className="notice bad-txt">Deadline in gevaar: de plaatsing is pas klaar op {d(t.install_end)}, de deadline is {d(t.deadline)}.</p>}
      {E.length > 1 && (
        <ol className="kd-line">
          {E.map((e, i) => (
            <li key={i} className={`k-${e.kind}${e.state ? ' s-' + e.state : ''}${e.date < today && e.kind !== 'today' ? ' past' : ''}`}>
              <span className="kd-dot" />
              <b>{d(e.date)}</b>
              <span className="kd-l">{e.label}</span>
              {e.sub && <small>{e.sub}</small>}
            </li>
          ))}
        </ol>
      )}
      {!hasDates && <p className="muted small">Vul een deadline, de start van de werken of de plaatsing in; de app rekent eindopmeting, bestellen, productie en de fases terug.</p>}
    </div>
  )
}
