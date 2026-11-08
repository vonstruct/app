import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'
import { fmtEur } from '../../core/format'
import { PhaseSelect, type Phase, type ProjectRow } from '../../core/projects'
import { actionFor, cleanTitle, dueText, InlineProposal, keyOf, type Flag } from '../controltower/ControlTower'
import { DatesForm, dayLabel, type Gate, type Timeline } from './KeyDates'
import { useProjectPlanning } from './PlanningPanel'
import { keyOf as agendaKey } from '../agenda/Agenda'
import type { CheckItem, ProjectNumbers, ProjectPage } from './projectStatus'

/**
 * Overzicht van een project (voorstel 6 nov 2026, stap 1): één Verloop + Kerncijfers.
 * Het Verloop brengt checklist, planning en "wat ontbreekt" samen in één lijst, in de volgorde van de tijd:
 *  - Klaar (ingeklapt): afgevinkte stappen (app_project_checklist) en voorbije afspraken/opdrachten.
 *  - Nu, jij aan zet: dezelfde punten als in Vandaag (app_today, enkel dit project), eigen taken, en stappen van de huidige fase die jij
 *    nu kan doen (met de hand afvinken of één knop naar de plek).
 *  - Komt eraan: afspraken, opdrachten, leveringen, ophaling bij de partner, plaatsing, deadline, met datum; stappen van de huidige fase
 *    waarop je wacht ("wacht op de klant / partner / leverancier").
 *  - Daarna: de stappen van de volgende fase, op één regel.
 * Elk ding staat er één keer. Welke stap wie aan zet heeft en waar je hem oplost: STEP hieronder (één regel per auto_rule).
 */


/** Per automatische stap: wie aan zet is, of jij er nu iets aan kan doen, en waar (tab). Met de hand = jij, afvinken. */
const STEP: Record<string, { who: string; now: boolean; tab?: string; flags?: string[]; tick?: boolean }> = {
  agenda: { who: 'jij', now: true, tick: true }, // vinkt vanzelf af na een afspraak/opdracht met een van de woorden (checklist_template.agenda_words), of met de hand
  measures_known: { who: 'jij', now: true, tick: true }, // Maten gekend: na een afspraak "opmeting" of de vragenlijst, of met de hand met de bron (8/11/2026)
  intro_done: { who: 'jij', now: false },
  survey_submitted: { who: 'klant', now: false, tab: 'vragenlijst', flags: ['survey_open', 'survey_nieuw'] },
  go_given: { who: 'jij', now: true, flags: ['aanvraag_nieuw'] },
  design_version: { who: 'jij', now: true, tab: 'ontwerp' },
  costs_done: { who: 'automatisch', now: false, tab: 'ontwerp' },
  prices_complete: { who: 'jij', now: true, tab: 'kost', flags: ['prijzen'] },
  quote_sent: { who: 'jij', now: true, tab: 'offerte', flags: ['offerte'] },
  quote_signed: { who: 'klant', now: false, tab: 'offerte' },
  deposit_paid: { who: 'klant', now: false, tab: 'facturen', flags: ['factuur'] },
  orders_placed: { who: 'jij', now: true, tab: 'bestellingen', flags: ['levertijd'] },
  install_week_set: { who: 'jij', now: true, tab: 'datums' },
  package_sent: { who: 'jij', now: true, tab: 'productie' },
  orders_received: { who: 'leveranciers', now: false, tab: 'bestellingen', flags: ['bestelling', 'levertijd'] },
  production_done: { who: 'partner', now: false, tab: 'productie' },
  pickup_done: { who: 'jij', now: false, tab: 'productie', flags: ['partner'] },
  jobs_confirmed: { who: 'onderaannemers', now: false, flags: ['opdracht'] },
  jobs_done: { who: 'jij', now: false },
  handover_signed: { who: 'klant', now: false, tab: 'oplevering', flags: ['oplevering'] },
  punch_done: { who: 'jij', now: false, tab: 'oplevering', flags: ['werkpunt'] },
  final_invoice: { who: 'jij', now: false, tab: 'facturen', flags: ['factuur'] },
  review_requested: { who: 'jij', now: false, tab: 'oplevering', flags: ['review'] },
}
/** Waar de maten vandaan komen (stap "Maten gekend", met de hand): komt in project_checklist.done_by */
const MEASURE_SRC = ['Opmeting', 'Maten van de klant', 'Grondplan', 'Andere']
const WAIT: Record<string, string> = { klant: 'wacht op de klant', partner: 'wacht op de partner', leveranciers: 'wacht op de leveranciers', onderaannemers: 'wacht op de onderaannemers', automatisch: 'gaat vanzelf', jij: 'jij, later' }

const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
const d10 = (s: string) => (s.length > 10 ? new Date(s).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' }) : s)
const short = (s: string) => new Date(s.length === 10 ? s + 'T12:00' : s).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })

type Line = { key: string; date: string | null; when?: ReactNode; text: ReactNode; sub?: ReactNode[]; mark: 'done' | 'red' | 'or' | 'grey' | 'open' | 'ms' | 'ms-red'; act?: ReactNode; extra?: ReactNode }

function LineRow({ l, dateText }: { l: Line; dateText?: string }) {
  return (
    <li className={'ov-l m-' + l.mark}>
      <time>{l.when ?? dateText ?? (l.date ? (l.mark === 'done' ? short(l.date) : dayLabel(d10(l.date))) : '')}</time>
      <i className="ov-mk" aria-hidden="true">{l.mark === 'done' ? '✓' : ''}</i>
      <span className="ov-t">{l.text}{(l.sub ?? []).filter(Boolean).map((s, i) => <small key={i}>{s}</small>)}</span>
      {l.act ? <span className="ov-act">{l.act}</span> : <span />}
      {l.extra && <div className="ov-extra">{l.extra}</div>}
    </li>
  )
}

export function Overview({ project, page, t, gates, nums, saveDates, onTab, onSaved }: {
  project: ProjectRow; page: ProjectPage; t: Timeline | null; nums: ProjectNumbers | null; gates: Gate[]; saveDates: (p: Partial<Timeline> & { intro_at?: string | null }) => Promise<void>; onTab: (tab: string) => void; onSaved: () => void
}) {
  const code = project.project_code
  // alle gegevens komen uit project_page (één verzoek, ProjectDetail); opnieuw laden = onSaved
  const items: CheckItem[] = page.checklist
  const rules = useMemo(() => Object.fromEntries(page.templates.map((x) => [x.id, x.auto_rule])) as Record<number, string | null>, [page.templates])
  const words = useMemo(() => Object.fromEntries(page.templates.map((x) => [x.id, x.agenda_words])) as Record<number, string | null>, [page.templates])
  const flags: Flag[] = page.today
  const orders = useMemo(() => page.orders.filter((x) => !x.auto_vervallen), [page.orders])
  const po = page.partner
  const tasks = page.tasks
  const [openProp, setOpenProp] = useState<string | null>(null)
  // ?focus=datums (vanuit Vandaag: datum ontbreekt): het formulier met de datums meteen open
  const [params] = useSearchParams()
  const [dates, setDates] = useState(params.get('focus') === 'datums')
  const [newTask, setNewTask] = useState<string | null>(null)
  const plan = useProjectPlanning(project)
  const load = onSaved
  // Outlook-afspraken staan niet in de database: een voorbije afspraak van dit project met een woord uit de checklist (opmeting,
  // eindopmeting, ontwerpbespreking …) bewaren in agenda_notes, dan vinkt de stap vanzelf af (project_agenda_done_at).
  // Enkel als de stap nog open staat, zodat dit niet bij elk bezoek opnieuw gebeurt.
  useEffect(() => {
    const open = items.filter((it) => (rules[it.template_id] === 'agenda' || rules[it.template_id] === 'measures_known') && !it.done && !it.na)
    const ws = open.flatMap((it) => (words[it.template_id] ?? '').split(',')).map((w) => w.trim().toLowerCase()).filter(Boolean)
    if (!ws.length || !plan.events?.length) return
    const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + ws.map((w) => w.replace(/[^\p{L}\p{N} ]/gu, '')).join('|') + ')', 'u')
    const past = plan.events.filter((e) => new Date(e.end).getTime() < Date.now() - 3600000 && re.test(e.title.toLowerCase()))
    if (!past.length) return
    supabase.from('agenda_notes').upsert(past.map((e) => ({ event_key: agendaKey(e), project_code: code, event_title: e.title, event_start: e.start })), { onConflict: 'event_key' })
      .then(({ error }) => { if (!error) onSaved() })
  }, [plan.events, rules, words, code]) // eslint-disable-line react-hooks/exhaustive-deps
  const reload = onSaved

  const tick = async (it: CheckItem, na = false, by?: string) => {
    const { error } = await supabase.from('project_checklist').upsert({ project_code: code, template_id: it.template_id, done_at: na ? null : new Date().toISOString(), na, ...(by ? { done_by: by } : {}) })
    if (error) return toast(error.message, 'err')
    toast(na ? 'Op n.v.t. gezet' : 'Afgevinkt'); reload()
  }
  const taskDone = async (id: string) => {
    const { error } = await supabase.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast(error.message, 'err')
    toast('Afgevinkt'); load()
  }
  const addTask = async () => {
    const text = (newTask ?? '').trim()
    if (!text) return setNewTask(null)
    const { error } = await supabase.from('tasks').insert({ text, project_code: code, kind: 'buiten', source: 'project' })
    if (error) return toast(error.message, 'err')
    setNewTask(null); load()
  }

  const today = todayIso()
  const nowMs = Date.now()
  const cur = gates.find((g) => !g.passed)
  const next = cur ? gates.find((g) => g.sort > cur.sort && !g.passed) : undefined
  const flagKinds = new Set(flags.map((f) => f.kind))
  const partnerName = po?.partner ?? 'de partner'
  const tabBtn = (tab: string, label: string) => tab === 'datums'
    ? <button className="go" onClick={() => setDates(true)}>{label}</button>
    : <button className="go" onClick={() => onTab(tab)}>{label}</button>

  const v = useMemo(() => {
    const all = items ?? []
    const rule = (it: CheckItem) => rules[it.template_id] ?? null
    const covered = (it: CheckItem) => (STEP[rule(it) ?? '']?.flags ?? []).some((k) => flagKinds.has(k))

    // ---- Klaar
    const done: Line[] = []
    for (const it of all) if (it.done && it.done_at) done.push({ key: 'c' + it.template_id, date: it.done_at, text: it.label, sub: [rule(it) === 'measures_known' && it.done_by && it.done_by !== 'automatisch' && it.done_by !== 'met de hand' ? it.done_by : null], mark: 'done' })

    // ---- Nu, jij aan zet
    const now: Line[] = []
    for (const f of flags) {
      const isVon = f.kind === 'von_voorstel' && !!f.ref
      const k = keyOf(f), a = actionFor(f), due = dueText(f.due_date)
      now.push({
        key: 'f' + k, date: null,
        text: isVon ? <>VON stelt voor: {f.proposal_title ?? cleanTitle(f)}</> : cleanTitle(f),
        when: due ? <span className={'vd-due ' + due.cls}>{due.text}</span> : undefined,
        sub: [isVon ? (f.reason ?? f.proposal_summary ?? f.detail) : f.detail, f.due_reason],
        mark: f.prio === 1 ? 'red' : f.prio === 2 ? 'or' : 'grey',
        act: isVon
          ? <button className="go" onClick={() => setOpenProp(openProp === k ? null : k)}>{openProp === k ? 'Inklappen' : 'Bekijken'}</button>
          : <>{a.to.startsWith('http') ? <a className="go" href={a.to} target="_blank" rel="noreferrer">{a.label} ↗</a> : <Link className="go" to={a.to}>{a.label}</Link>}
              {f.kind === 'taak' && f.ref && <button className="go ghost" onClick={() => taskDone(f.ref!)}>Klaar</button>}</>,
        extra: isVon && openProp === k ? <InlineProposal id={f.ref!} onDone={() => { setOpenProp(null); load() }} /> : undefined,
      })
    }
    for (const tk of tasks) {
      const due = dueText(tk.due_date)
      now.push({ key: 't' + tk.id, date: null, text: tk.text, sub: ['taak'], when: due ? <span className={'vd-due ' + due.cls}>{due.text}</span> : undefined, mark: tk.due_date && tk.due_date <= today ? 'red' : 'grey', act: <button className="go ghost" onClick={() => taskDone(tk.id)}>Klaar</button> })
    }
    const curItems = all.filter((it) => cur && it.stage === cur.stage && !it.done && !it.na && !it.skipped)
    for (const it of curItems) {
      const r = rule(it), s = r ? STEP[r] : null
      if (r === 'measures_known') now.push({ key: 'm' + it.template_id, date: null, text: it.label, sub: ['vinkt vanzelf af na een afspraak "opmeting" of als de klant de vragenlijst indient; anders hier kiezen waar de maten vandaan komen'], mark: 'or',
        act: <select className="go" value="" aria-label="Waar komen de maten vandaan?" onChange={(e) => e.target.value && tick(it, false, e.target.value)}><option value="">✓ Gekend via…</option>{MEASURE_SRC.map((m) => <option key={m} value={m}>{m}</option>)}</select> })
      else if (!r || s?.tick) now.push({ key: 'm' + it.template_id, date: null, text: it.label, sub: [r === 'agenda' && words[it.template_id] ? `vinkt vanzelf af na een afspraak of opdracht "${words[it.template_id]!.split(',')[0].trim()}", of hier met de hand` : 'zelf afvinken als het gebeurd is'], mark: 'or', act: <><button className="go" onClick={() => tick(it)}>✓ Gedaan</button><button className="go ghost" onClick={() => tick(it, true)} title="Niet van toepassing">n.v.t.</button></> })
      else if (s?.now && !covered(it)) now.push({ key: 'a' + it.template_id, date: null, text: it.label, mark: 'or', act: s.tab ? tabBtn(s.tab, 'Openen') : undefined })
    }

    // ---- Komt eraan (met datum)
    const soon: Line[] = []
    let installJob = false
    const flagText = flags.map((f) => f.title).join(' | ')
    for (const j of plan.jobs ?? []) {
      if (j.status === 'geannuleerd' || new Date(j.end_at).getTime() < nowMs - 3600000) continue
      const who = j.for_me ? 'jij' : j.subcontractors?.name ?? j.partners?.name ?? ''
      const isInstall = !!t?.install_start && d10(j.start_at) === t.install_start
      if (isInstall) installJob = true
      const until = d10(j.end_at) !== d10(j.start_at) ? `tot ${dayLabel(d10(j.end_at))}` : null
      soon.push({ key: 'j' + j.id, date: j.start_at, text: <button className={'ov-link' + (isInstall ? ' b' : '')} onClick={() => plan.setOpen(j)}>{j.title}</button>, sub: [[until, who, j.status === 'gepland' ? 'nog niet bevestigd' : j.status === 'bevestigd' ? 'bevestigd' : j.status].filter(Boolean).join(' · ')], mark: isInstall ? 'ms' : j.status === 'gepland' ? 'grey' : 'open' })
    }
    const mirror = new Set((plan.jobs ?? []).map((j) => j.outlook_event_id).filter(Boolean))
    for (const e of plan.events ?? []) {
      if (e.outlook_id && mirror.has(e.outlook_id)) continue
      if (new Date(e.end).getTime() < nowMs - 3600000) continue
      soon.push({ key: 'e' + e.id, date: e.start, text: <Link className="ov-link" to={`/agenda?d=${d10(e.start)}&e=${encodeURIComponent(e.id)}`}>{e.title}</Link>, sub: ['afspraak' + (e.location ? ` · ${e.location}` : '')], mark: 'open' })
    }
    if (project.intro_at && new Date(project.intro_at).getTime() > nowMs && !(plan.events ?? []).some((e) => e.source === 'bookings'))
      soon.push({ key: 'intro', date: project.intro_at, text: 'Kennismaking', mark: 'open' })
    for (const o of orders) {
      if (o.delivered_at || !o.expected_at || d10(o.expected_at) < today) continue
      if (flagText.includes(o.supplier)) continue // staat al bij "Nu" (bv. levering te laat)
      soon.push({ key: 'o' + o.id, date: o.expected_at, text: `Levering ${o.supplier}`, sub: [(o.ordered_by && o.ordered_by !== 'Vonstruct' ? `bij ${o.ordered_by} · ` : '') + 'verwacht'], mark: 'open' })
    }
    if (po && po.pickup_date && !po.picked_up_at) {
      const ans = po.pickup_answer === 'ok' ? `${partnerName} bevestigt` : po.pickup_answer === 'probleem' ? `lukt niet: ${po.pickup_note ?? ''}` : `nog niet bevestigd door ${partnerName}`
      soon.push({ key: 'pu', date: po.pickup_date, text: `Ophalen bij ${partnerName}`, sub: [[po.pickup_slot === 'voormiddag' || po.pickup_slot === 'namiddag' ? po.pickup_slot : null, ans].filter(Boolean).join(' · ')], mark: po.pickup_answer === 'probleem' ? 'red' : 'open', act: tabBtn('productie', 'Openen') })
    }
    if (t?.final_measure_by && !t.final_measure_done && t.final_measure_by >= today) soon.push({ key: 'fm', date: t.final_measure_by, text: 'Eindopmeting', sub: ['ten laatste'], mark: 'open' })
    const ordersOpen = all.some((it) => rule(it) === 'orders_placed' && !it.done && !it.na && !it.skipped)
    if (t?.order_by && ordersOpen && t.order_by >= today) soon.push({ key: 'ob', date: t.order_by, text: 'Bestellen', sub: ['ten laatste' + (t.order_by_supplier ? ` · ${t.order_by_supplier}` : '')], mark: 'open', act: tabBtn('bestellingen', 'Openen') })
    if (t?.works_start && t.works_start !== t.install_start && t.works_start >= today) soon.push({ key: 'ws', date: t.works_start, text: 'Start van de werken', mark: 'ms' })
    const late = !!(t?.deadline && t.install_end && t.install_end > t.deadline)
    if (t?.install_start && (t.install_end ?? t.install_start) >= today && !installJob)
      soon.push({ key: 'in', date: t.install_start, text: <b>Plaatsing{t.install_days ? `, ${t.install_days} ${t.install_days === 1 ? 'dag' : 'dagen'}` : ''}</b>, sub: [t.install_end && t.install_end !== t.install_start ? `tot ${dayLabel(t.install_end)}` : null], mark: late ? 'ms-red' : 'ms' })
    else if (!t?.install_start && t?.target_install_week) soon.push({ key: 'iw', date: null, text: <b>Plaatsing in week {t.target_install_week.split('-W')[1]}</b>, sub: ['nog geen datum'], mark: 'ms', act: <button className="go" onClick={() => setDates(true)}>Datum kiezen</button> })
    if (t?.deadline && t.deadline >= today) soon.push({ key: 'dl', date: t.deadline, text: 'Deadline klant', sub: [t.deadline_reason, late ? 'in gevaar: de plaatsing is pas later klaar' : null], mark: late ? 'ms-red' : 'ms' })
    soon.sort((a, b) => (a.date ? d10(a.date) : '9999').localeCompare(b.date ? d10(b.date) : '9999') || (a.date ?? '').localeCompare(b.date ?? ''))

    // stappen van deze fase waarop je wacht (zonder datum), tenzij hierboven al een regel met datum ze toont
    const hasJobs = soon.some((l) => l.key.startsWith('j'))
    const waits: Line[] = []
    for (const it of curItems) {
      const r = rule(it), s = r ? STEP[r] : null
      if (!r || !s || s.now) continue
      if (r === 'pickup_done' && po?.pickup_date) continue
      if ((r === 'jobs_confirmed' || r === 'jobs_done') && hasJobs) continue
      if (r === 'orders_received' && (soon.some((l) => l.key.startsWith('o')) || covered(it))) continue
      if (covered(it)) continue
      waits.push({ key: 'w' + it.template_id, date: null, text: it.label, sub: [r === 'production_done' ? `wacht op ${partnerName}` : WAIT[s.who] ?? s.who], mark: 'grey' })
    }

    done.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

    // ---- Daarna: de volgende fase
    const after = next ? all.filter((it) => it.stage === next.stage && !it.done && !it.na && !it.skipped).map((it) => it.label) : []
    return { done, now, soon, waits, after }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rules, words, flags, tasks, orders, po, t, gates, plan.jobs, plan.events, openProp])

  const passed = gates.filter((g) => g.passed).map((g) => g.label)
  const doneSummary = passed.length ? `${passed.length > 1 ? passed.slice(0, -1).join(', ') + ' en ' + passed[passed.length - 1] : passed[0]} klaar` : 'Klaar'

  return (
    <div className="ov-grid">
      <section className="panel ov-flow">
        <div className="ov-h">
          <h2>Verloop</h2>
          <span className="toolbar small">
            <button className="link small" onClick={() => setDates(!dates)}>Kennismaking, deadline en plaatsing</button>
          </span>
        </div>
        {dates && t && <DatesForm t={t} save={saveDates} intro={project.intro_at ?? null} onClose={() => setDates(false)} />}
        {!items ? <p className="muted small">Laden…</p> : (
          <>
            {v.done.length > 0 && (
              <details className="ov-done">
                <summary><span className="ok-t">✓</span> {doneSummary} <span className="muted small">· {v.done.length} {v.done.length === 1 ? 'stap' : 'stappen'} · tonen</span></summary>
                <ol className="ov-list">{v.done.map((l) => <LineRow key={l.key} l={l} />)}</ol>
              </details>
            )}

            <div className="ov-now">
              <div className="ov-sec">Nu · jij aan zet <span>dezelfde punten als in Vandaag, enkel voor dit project</span></div>
              {v.now.length === 0 ? <p className="muted small ov-empty">Niets voor jou op dit moment.</p> : <ol className="ov-list">{v.now.map((l) => <LineRow key={l.key} l={l} dateText="" />)}</ol>}
              <div className="ov-add">
                {newTask === null
                  ? <button className="link small" onClick={() => setNewTask('')}>+ taak</button>
                  : <span className="toolbar small"><input autoFocus value={newTask} placeholder="Wat moet er gebeuren?" onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setNewTask(null) }} /><button onClick={addTask}>Bewaren</button><button className="link small" onClick={() => setNewTask(null)}>annuleren</button></span>}
              </div>
            </div>

            {(v.soon.length > 0 || v.waits.length > 0) && (
              <>
                <div className="ov-sec">Komt eraan</div>
                <ol className="ov-list">
                  {v.soon.map((l) => <LineRow key={l.key} l={l} />)}
                  {v.waits.map((l) => <LineRow key={l.key} l={l} dateText="deze fase" />)}
                </ol>
              </>
            )}
            {v.after.length > 0 && next && <p className="ov-after"><span className="muted">Daarna, {next.label}:</span> {v.after.join(' · ').toLowerCase()}</p>}
            {plan.evErr && <p className="muted small">{plan.evErr}</p>}
          </>
        )}
        {plan.modals}
      </section>

      <KeyFigures d={nums} t={t} onTab={onTab} onDates={() => setDates(true)} />
    </div>
  )
}

/** Vier kerncijfers; elk vakje opent de plek waar het vandaan komt. Cijfers: numbersOf (projectStatus.ts). */
function KeyFigures({ d, t, onTab, onDates }: { d: ProjectNumbers | null; t: Timeline | null; onTab: (tab: string) => void; onDates: () => void }) {
  const qs = d?.quote
  return (
    <section className="panel ov-figs">
      <div className="ov-h"><h2>Kerncijfers</h2></div>
      <div className="ov-tiles">
        <button className="ov-tile" onClick={() => onTab('offerte')}>
          <small>Offerte</small>
          <b>{qs?.total_incl != null ? fmtEur(qs.total_incl) : '—'}</b>
          <span>{qs ? [qs.number, qs.status, qs.margin_pct != null ? `marge ${Number(qs.margin_pct)} %` : null].filter(Boolean).join(' · ') : 'nog geen offerte'}</span>
        </button>
        <button className="ov-tile" onClick={() => onTab('kost')}>
          <small>Kostprijs</small>
          <b>{d && d.nCost ? fmtEur(d.cost) : '—'}</b>
          <span className={d?.noPrice ? 'bad-text' : ''}>{!d ? '' : !d.nCost ? 'nog niet berekend' : d.noPrice ? `${d.noPrice} ${d.noPrice === 1 ? 'artikel' : 'artikels'} zonder prijs` : 'alle prijzen ingevuld'}</span>
        </button>
        <button className="ov-tile" onClick={() => onTab('facturen')}>
          <small>Betaald</small>
          <b>{d && d.nInv ? fmtEur(d.paid) : '—'}</b>
          <span>{!d ? '' : d.nInv ? `van ${fmtEur(d.inv)} gefactureerd` : 'nog geen facturen'}</span>
        </button>
        <button className="ov-tile" onClick={onDates}>
          <small>Plaatsing</small>
          <b>{t?.install_start ? dayLabel(t.install_start) : t?.target_install_week ? `week ${t.target_install_week.split('-W')[1]}` : '—'}</b>
          <span>{[t?.install_days ? `${t.install_days} ${t.install_days === 1 ? 'dag' : 'dagen'}` : null, t?.deadline ? `deadline ${dayLabel(t.deadline)}` : 'deadline niet ingevuld'].filter(Boolean).join(' · ')}</span>
        </button>
      </div>
    </section>
  )
}

/** Dunne fasebalk boven de tabbladen (enkel tonen) + fase met de hand kiezen. */
export function PhaseBar({ project, gates, phases, onSaved, focus }: { project: ProjectRow; gates: Gate[]; phases: Phase[]; onSaved: () => void; focus: boolean }) {
  const cur = gates.find((g) => !g.passed)
  const closed = !['lead', 'design', 'quote', 'signed', 'production', 'installation'].includes(project.stage ?? '')
  return (
    <div className={'ov-bar-wrap' + (focus ? ' focus' : '')}>
      <ol className="ov-bar" aria-label="Fase van het project">
        {gates.map((g) => {
          const st = g.passed ? 'done' : g === cur && !closed ? 'now' : ''
          return (
            <li key={g.stage} className={st} title={g.passed && g.done_at ? `${g.gate_label} · klaar ${short(g.done_at)}` : g.gate_label}>
              <b>{g.label}</b>
              <small>{g.passed ? '✓ klaar' : st === 'now' ? `nu · ${g.n_done}/${g.n}${g.due ? ` · tegen ${short(g.due)}` : ''}` : g.due ? `tegen ${short(g.due)}` : ''}</small>
            </li>
          )
        })}
      </ol>
      <label className="ov-phase">{closed ? <b>{project.phase_label}</b> : <span className="muted small">fase</span>}<PhaseSelect p={project} phases={phases} onSaved={onSaved} /></label>
      {focus && <p className="notice">Kies hier de fase waarin het project nu zit.</p>}
    </div>
  )
}
