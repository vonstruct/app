import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from './supabase'
import { useDictation, dueFromText } from './useDictation'
import { toast } from './toast'
import { NewEvent } from '../modules/agenda/Agenda'
import { JobEditor } from '../modules/agenda/JobEditor'
import { DateInput } from './DateInput'

/** Takenlijst van Olivier (tabel `tasks`): ingesproken via Siri/VON of hier getypt. Overal dezelfde component. */
export type Task = { id: string; text: string; project_code: string | null; due_date: string | null; done_at: string | null; source: string; created_at: string; proposal_ids?: string[] | null; kind?: 'buiten' | 'app'; link?: string | null }

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
const dueLabel = (d: string | null) => {
  if (!d) return null
  const t = today(), tm = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
  if (d < t) return { text: 'te laat · ' + new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }), cls: 'bad-t' }
  if (d === t) return { text: 'vandaag', cls: 'wait-t' }
  if (d === tm) return { text: 'morgen', cls: '' }
  return { text: new Date(d).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }), cls: 'muted' }
}

/** kind = 'buiten': enkel taken buiten de app (bellen, opmeten, ophalen); wat in de app moet, staat op Vandaag in de juiste categorie. */
export function Tasks({ project, limit, title = 'Mijn taken', showAdd = true, kind }: { project?: string; limit?: number; title?: string; showAdd?: boolean; kind?: 'buiten' | 'app' }) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [text, setText] = useState('')
  const dict = useDictation()
  const [due, setDue] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [plan, setPlan] = useState<{ t: Task; kind: 'afspraak' | 'opdracht' } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [phones, setPhones] = useState<Record<string, { name: string | null; phone: string }>>({})
  const startPlan = async (t: Task, kind: 'afspraak' | 'opdracht') => {
    setMenu(null)
    if (kind === 'afspraak' && !projects.length) {
      const { data } = await supabase.from('app_projects').select('project_code,title,client_name,intro_at,target_install_week,phase').eq('phase_active', true)
      setProjects(data ?? [])
    }
    setPlan({ t, kind })
  }
  const planned = async () => { if (plan) await supabase.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', plan.t.id); setPlan(null); load() }

  const load = useCallback(async () => {
    let q = supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    q = showDone ? q.not('done_at', 'is', null).order('done_at', { ascending: false }).limit(30) : q.is('done_at', null)
    if (project) q = q.eq('project_code', project)
    if (kind) q = q.eq('kind', kind)
    const { data } = await q
    const list = (data as Task[]) ?? []
    setTasks(list)
    // telefoon van de klant, om meteen te bellen
    const codes = [...new Set(list.map((t) => t.project_code).filter(Boolean))] as string[]
    if (codes.length) {
      const { data: pr } = await supabase.from('app_projects').select('project_code,client_name,client_phone').in('project_code', codes)
      setPhones(Object.fromEntries(((pr ?? []) as { project_code: string; client_name: string | null; client_phone: string | null }[]).filter((x) => x.client_phone).map((x) => [x.project_code, { name: x.client_name, phone: x.client_phone! }])))
    }
  }, [project, showDone, kind])
  useEffect(() => { load() }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    await supabase.from('tasks').insert({ text: text.trim(), project_code: project ?? null, due_date: due || null, source: 'app', kind: kind ?? 'buiten' })
    setText(''); setDue(''); load()
  }
  const toggle = async (t: Task) => {
    await supabase.from('tasks').update({ done_at: t.done_at ? null : new Date().toISOString() }).eq('id', t.id)
    load()
  }
  // "Laat VON dit doen": VON zet de taak om in voorstel(len); goedgekeurd + uitgevoerd = taak vanzelf af (trigger trg_tasks_follow_proposal)
  const [vonBusy, setVonBusy] = useState<string | null>(null)
  const [vonSaid, setVonSaid] = useState<Record<string, string>>({})
  const askVon = async (t: Task) => {
    setMenu(null); setVonBusy(t.id)
    const since = new Date(Date.now() - 5000).toISOString()
    const { data, error } = await supabase.functions.invoke('von', { body: { message: `Doe deze taak voor mij${t.project_code ? ` (project ${t.project_code})` : ''}: "${t.text}". Zet ze om in voorstel(len) die ik kan goedkeuren. Kan het niet in de app, zeg dan in één zin waarom en wat ik zelf moet doen.` } })
    const { data: props } = await supabase.from('von_proposals').select('id').eq('status', 'voorstel').gte('created_at', since)
    setVonBusy(null)
    if (error) return toast('VON kon het niet: ' + error.message, 'err')
    const ids = (props ?? []).map((p: { id: string }) => p.id)
    if (ids.length) {
      await supabase.from('tasks').update({ proposal_ids: [...(t.proposal_ids ?? []), ...ids] }).eq('id', t.id)
      toast(`VON maakte ${ids.length} voorstel${ids.length > 1 ? 'len' : ''}: goedkeuren in Vandaag`)
    } else setVonSaid((x) => ({ ...x, [t.id]: String((data as { answer?: string })?.answer ?? 'Geen voorstel.') }))
    load()
  }
  const remove = async (t: Task) => { if (confirm('Taak verwijderen?')) { await supabase.from('tasks').delete().eq('id', t.id); load() } }
  const shown = limit && tasks ? tasks.slice(0, limit) : tasks

  return (
    <div className="panel tasks">
      <div className="tasks-head">
        <h2>{title}</h2>
        <button className="link small" onClick={() => setShowDone((x) => !x)}>{showDone ? 'open taken' : 'afgewerkt'}</button>
      </div>
      {showAdd && !showDone && (
        <form className="tasks-add" onSubmit={add}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={project ? 'Nieuwe taak voor dit project…' : 'Nieuwe taak…'} />
          {dict.supported && (
            <button type="button" className={'tasks-mic' + (dict.listening ? ' on' : '')} title="Taak inspreken (bv. &quot;offerte Sarah nakijken tegen vrijdag&quot;)"
              onClick={() => dict.start((t, final) => { if (!final) return setText(t); const r = dueFromText(t); setText(r.text.charAt(0).toUpperCase() + r.text.slice(1)); if (r.due) setDue(r.due) }, (m) => toast(m, 'err'))}>
              {dict.listening ? '■' : '🎤'}
            </button>
          )}
          <DateInput value={due} onChange={(e) => setDue(e.target.value)} title="Tegen wanneer" />
          <button type="submit" disabled={!text.trim()}>+</button>
        </form>
      )}
      {shown === null ? <p className="muted small">Laden…</p> : shown.length === 0 ? (
        <p className="muted small">{showDone ? 'Nog niets afgewerkt.' : 'Geen open taken. Tik op 🎤 om er een in te spreken (of "Hey Siri, noteer taak").'}</p>
      ) : (
        <ul className="tasks-list">
          {shown.map((t) => {
            const d = dueLabel(t.due_date)
            return (
              <li key={t.id} className={t.done_at ? 'done' : ''}>
                <input type="checkbox" checked={!!t.done_at} onChange={() => toggle(t)} aria-label="Afgewerkt" />
                <span className="tasks-main">
                  <span>{t.text}</span>
                  <span className="small">
                    {d && <span className={d.cls}>{d.text}</span>}
                    {!project && t.project_code && <> {d ? '· ' : ''}<Link to={`/projecten/${encodeURIComponent(t.project_code)}`}>{t.project_code}</Link></>}
                    {t.project_code && phones[t.project_code] && !t.done_at && <> · <a href={`tel:${phones[t.project_code].phone.replace(/[^+\d]/g, '')}`} title={`Bel ${phones[t.project_code].name ?? 'de klant'}`}>📞 {phones[t.project_code].name?.split(' ')[0] ?? 'bellen'}</a></>}
                    {t.link && !t.done_at && <> · <Link to={t.link}>openen →</Link></>}
                    {t.source === 'siri' && <span className="muted"> · 🎙</span>}
                    {!t.done_at && !!t.proposal_ids?.length && <> · <Link to="/overzicht" className="chip gold">✨ voorstel klaar</Link></>}
                    {vonBusy === t.id && <span className="muted"> · VON is bezig…</span>}
                  </span>
                  {vonSaid[t.id] && <span className="small tasks-von">VON: {vonSaid[t.id]}</span>}
                </span>
                {!t.done_at && (
                  <span className="tasks-plan">
                    <button className="link small" onClick={() => setMenu(menu === t.id ? null : t.id)} title="Inplannen als afspraak of opdracht, of laten doen door VON">📅</button>
                    {menu === t.id && (
                      <span className="tasks-menu">
                        <button onClick={() => startPlan(t, 'afspraak')}>Afspraak maken</button>
                        <button onClick={() => startPlan(t, 'opdracht')}>Opdracht maken</button>
                        <button onClick={() => askVon(t)}>✨ Laat VON dit doen</button>
                      </span>
                    )}
                  </span>
                )}
                <button className="link small tasks-del" onClick={() => remove(t)} title="Verwijderen">✕</button>
              </li>
            )
          })}
        </ul>
      )}
      {limit && tasks && tasks.length > limit && <Link className="small" to="/taken">Alle {tasks.length} taken →</Link>}
      {plan?.kind === 'afspraak' && (
        <NewEvent day={plan.t.due_date ? new Date(plan.t.due_date) : new Date()} project={plan.t.project_code ?? ''} initialTitle={plan.t.text}
          projects={projects} onClose={() => setPlan(null)} onCreated={planned} />
      )}
      {plan?.kind === 'opdracht' && (
        <JobEditor draft={{ title: plan.t.text, project_code: plan.t.project_code ?? undefined, ...(plan.t.due_date ? { start_at: `${plan.t.due_date}T08:00:00`, end_at: `${plan.t.due_date}T16:30:00` } : {}) }}
          onClose={() => setPlan(null)} onSaved={planned} />
      )}
    </div>
  )
}
