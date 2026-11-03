import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'

/**
 * Checklist van het project per fase (view app_project_checklist). Standaardpunten staan in checklist_template
 * (aanpasbaar), een deel wordt automatisch afgevinkt uit de gegevens (vragenlijst, ontwerpversie, kosten, opdrachten).
 */
type Item = { project_code: string; stage: string; stage_label: string; stage_sort: number; sort: number; template_id: number; label: string; automatic: boolean; done: boolean; done_at: string | null; done_by: string | null }

export function ChecklistPanel({ code, currentStage }: { code: string; currentStage?: string | null }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [openAll, setOpenAll] = useState(false)
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
        <span className="muted small">{done}/{items.length} gedaan · <button className="link small" onClick={() => setOpenAll((x) => !x)}>{openAll ? 'enkel huidige fase' : 'alle fases'}</button></span>
      </div>
      <div className="cl-stages">
        {stages.map((s) => {
          const its = items.filter((i) => i.stage === s.stage)
          const n = its.filter((i) => i.done).length
          const cls = s.sort < curSort ? 'past' : s.sort === curSort ? 'now' : 'next'
          return <span key={s.stage} className={'cl-step ' + cls + (n === its.length ? ' full' : '')}>{s.label} <b>{n}/{its.length}</b></span>
        })}
      </div>
      {stages.filter((s) => openAll || s.sort === curSort || (s.sort < curSort && items.some((i) => i.stage === s.stage && !i.done))).map((s) => (
        <div key={s.stage} className="cl-group">
          <h4>{s.label}{s.sort < curSort ? <span className="muted small"> · nog open uit een vorige fase</span> : null}</h4>
          <ul>
            {items.filter((i) => i.stage === s.stage && (openAll || s.sort === curSort || !i.done)).map((i) => (
              <li key={i.template_id} className={i.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={i.done} disabled={i.done && i.done_by === 'automatisch'} onChange={() => toggle(i)} />
                  <span>{i.label}</span>
                </label>
                <span className="muted small">
                  {i.done ? `${i.done_by === 'automatisch' ? '⚙ automatisch' : '✓'} · ${new Date(i.done_at!).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}` : i.automatic ? '⚙ vinkt vanzelf af' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
