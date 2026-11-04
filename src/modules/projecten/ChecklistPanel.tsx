import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'

/**
 * Checklist van het project als bord: één kolom per fase (Aanvraag → Plaatsing), alle fases altijd zichtbaar.
 * Standaardpunten in checklist_template (Rekenregels → Checklist); punten met een auto_rule vinken vanzelf af
 * uit de gegevens (view app_project_checklist: vragenlijst, ontwerp, kosten, offerte, voorschot, bestellingen, opdrachten, PV, werkpunten, eindfactuur, review).
 */
type Item = { project_code: string; stage: string; stage_label: string; stage_sort: number; sort: number; template_id: number; label: string; automatic: boolean; done: boolean; done_at: string | null; done_by: string | null }
const day = (v: string) => new Date(v).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })

export function ChecklistPanel({ code, currentStage }: { code: string; currentStage?: string | null }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('app_project_checklist').select('*').eq('project_code', code).order('stage_sort').order('sort')
    setItems((data as Item[]) ?? [])
  }, [code])
  useEffect(() => { load() }, [load])

  const toggle = async (it: Item) => {
    if (it.done && it.done_by === 'automatisch') return
    if (it.done) await supabase.from('project_checklist').delete().eq('project_code', code).eq('template_id', it.template_id)
    else await supabase.from('project_checklist').insert({ project_code: code, template_id: it.template_id })
    load()
  }
  if (!items) return null
  const stages = [...new Map(items.map((i) => [i.stage, { stage: i.stage, label: i.stage_label, sort: i.stage_sort }])).values()].sort((a, b) => a.sort - b.sort)
  const curSort = stages.find((s) => s.stage === currentStage)?.sort ?? stages[0]?.sort ?? 0
  const done = items.filter((i) => i.done).length

  return (
    <div className="panel checklist">
      <div className="tasks-head">
        <h2>Checklist</h2>
        <span className="muted small">{done}/{items.length} gedaan · ⚙ = vinkt vanzelf af</span>
      </div>
      <div className="cl-board" style={{ '--cl-n': stages.length } as React.CSSProperties}>
        {stages.map((s) => {
          const its = items.filter((i) => i.stage === s.stage)
          const n = its.filter((i) => i.done).length
          const cls = s.sort < curSort ? 'past' : s.sort === curSort ? 'now' : 'next'
          const open = s.sort < curSort ? its.filter((i) => !i.done).length : 0
          return (
            <section key={s.stage} className={'cl-col ' + cls + (n === its.length ? ' full' : '')}>
              <header>
                <b>{s.label}</b>
                {s.sort === curSort && <span className="cl-now">nu</span>}
                <span className="cl-count">{n}/{its.length}</span>
              </header>
              <div className="cl-bar"><span style={{ width: (its.length ? (n / its.length) * 100 : 0) + '%' }} /></div>
              {open > 0 && <div className="cl-warn">{open} nog open</div>}
              <ul>
                {its.map((i) => (
                  <li key={i.template_id} className={i.done ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={i.done} disabled={i.done && i.done_by === 'automatisch'} onChange={() => toggle(i)} />
                      <span>{i.label}</span>
                    </label>
                    <small className="muted">{i.done ? `${i.done_by === 'automatisch' ? '⚙' : '✓'} ${day(i.done_at!)}` : i.automatic ? '⚙' : ''}</small>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
