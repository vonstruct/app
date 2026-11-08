import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'
import { fmtEur } from '../../core/format'
import type { ProjectRow } from '../../core/projects'
import { actionFor, cleanTitle, dueText, InlineProposal, keyOf, type Flag } from '../controltower/ControlTower'
import { DatesForm, dayLabel, type Gate, type Timeline } from './KeyDates'
import { useProjectPlanning } from './PlanningPanel'
import { keyOf as agendaKey } from '../agenda/Agenda'
import type { CheckItem, ProjectNumbers, ProjectPage } from './projectStatus'

/**
 * Overzicht van een project (voorstel 6 nov 2026, stap 1): één Verloop + Kerncijfers.
 * Het Verloop (8/11/2026):
 *  - Te doen: dezelfde punten als in Vandaag (app_today, enkel dit project) en eigen taken; één reden en één knop.
 *  - Stappen · <fase>: de stappen van de huidige fase als afvinklijst (✓ gedaan met datum, ○ open met korte hint en hoogstens één knop).
 *    De vragenlijst staat er altijd bij als optionele stap met de stand (niet gevraagd / gevraagd op … / ingevuld op …).
 *    Een andere fase bekijken: aantikken in de fasebalk (?fase=), enkel lezen; de fase van het project verandert niet.
 *  - Komt eraan: afspraken, opdrachten, leveringen, ophaling bij de partner, plaatsing, deadline, met datum.
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
/** "Te doen": melding of taak, met één reden en één knop (8/11/2026, Olivier: "slordig en niet duidelijk") */
type Todo = { key: string; dot: 'red' | 'or' | 'grey'; text: ReactNode; why?: ReactNode; due?: { text: string; cls: string } | null; act?: ReactNode; extra?: ReactNode }
/** Stap van de huidige fase: afgevinkt, open of n.v.t., met een korte hint en hoogstens één knop */
type Step = { key: string; state: 'done' | 'open' | 'na' | 'opt'; text: string; hint?: string | null; act?: ReactNode; side?: string | null }

function TodoRow({ r }: { r: Todo }) {
  return (
    <li className="ovn-row">
      <i className={'ovn-dot ' + r.dot} aria-hidden="true" />
      <span className="ovn-t"><b>{r.text}</b>{(r.why || r.due) && <small>{r.due && <em className={'ovn-due ' + r.due.cls}>{r.due.text}</em>}{r.due && r.why ? ' · ' : ''}{r.why}</small>}</span>
      <span className="ovn-act">{r.act}</span>
      {r.extra && <div className="ovn-extra">{r.extra}</div>}
    </li>
  )
}

function StepRow({ s }: { s: Step }) {
  return (
    <li className={'ovn-step ' + s.state}>
      <i className="ovn-box" aria-hidden="true">{s.state === 'done' ? '✓' : ''}</i>
      <span className="ovn-t"><b>{s.text}</b>{s.hint && <small>{s.hint}</small>}</span>
      <span className="ovn-act">{s.side && <span className="ovn-side">{s.side}</span>}{s.act}</span>
    </li>
  )
}

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
  const nowGate = gates.find((g) => !g.passed)
  const partnerName = po?.partner ?? 'de partner'
  const tabBtn = (tab: string, label: string) => tab === 'datums'
    ? <button className="go" onClick={() => setDates(true)}>{label}</button>
    : <button className="go" onClick={() => onTab(tab)}>{label}</button>

  const v = useMemo(() => {
    const all = items ?? []
    const rule = (it: CheckItem) => rules[it.template_id] ?? null

    // ---- Te doen: meldingen van Vandaag (enkel dit project) en eigen taken; één reden, één knop van vaste breedte
    const todo: Todo[] = []
    for (const f of flags) {
      const isVon = f.kind === 'von_voorstel' && !!f.ref
      const k = keyOf(f), a = actionFor(f)
      todo.push({
        key: 'f' + k, dot: f.prio === 1 ? 'red' : f.prio === 2 ? 'or' : 'grey',
        text: isVon ? <>VON stelt voor: {f.proposal_title ?? cleanTitle(f)}</> : cleanTitle(f),
        why: isVon ? null : f.detail, due: dueText(f.due_date),
        act: isVon
          ? <button className="ovn-btn" onClick={() => setOpenProp(openProp === k ? null : k)}>{openProp === k ? 'Sluiten' : 'Bekijken'}</button>
          : a.to.startsWith('http') ? <a className="ovn-btn" href={a.to} target="_blank" rel="noreferrer">Openen ↗</a> : <Link className="ovn-btn" to={a.to}>{f.kind === 'gegevens' ? 'Invullen' : 'Openen'}</Link>,
        extra: isVon && openProp === k ? <InlineProposal id={f.ref!} onDone={() => { setOpenProp(null); load() }} /> : undefined,
      })
    }
    for (const tk of tasks) todo.push({ key: 't' + tk.id, dot: tk.due_date && tk.due_date <= today ? 'red' : 'grey', text: tk.text, why: 'taak', due: dueText(tk.due_date), act: <button className="ovn-btn" onClick={() => taskDone(tk.id)}>Klaar</button> })

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


    return { todo, soon }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rules, words, flags, tasks, orders, po, t, gates, plan.jobs, plan.events, openProp])


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

            {v.todo.length > 0 && (
              <div className="ovn">
                <div className="ovn-h">Te doen</div>
                <ol className="ovn-list">{v.todo.map((r) => <TodoRow key={r.key} r={r} />)}</ol>
              </div>
            )}
            {nowGate && <PhaseSteps project={project} page={page} gates={gates} stage={nowGate.stage} onTab={onTab} onSaved={onSaved} onDates={() => setDates(true)} />}
            <div className="ovn-add">
              {newTask === null
                ? <button className="link small" onClick={() => setNewTask('')}>+ taak</button>
                : <span className="toolbar small"><input autoFocus value={newTask} placeholder="Wat moet er gebeuren?" onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setNewTask(null) }} /><button onClick={addTask}>Bewaren</button><button className="link small" onClick={() => setNewTask(null)}>annuleren</button></span>}
            </div>

            {v.soon.length > 0 && (
              <>
                <div className="ov-sec">Komt eraan</div>
                <ol className="ov-list">
                  {v.soon.map((l) => <LineRow key={l.key} l={l} />)}
                </ol>
              </>
            )}
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
/**
 * Stappen van één fase als afvinklijst (8/11/2026): in het Overzicht de huidige fase, bovenaan elk fase-tabblad de stappen van die fase.
 * Huidige fase: met knoppen (Gedaan / n.v.t., "Gekend ▾", Openen). Een andere fase: enkel lezen (✓ met datum, overgeslagen, later).
 * De vragenlijst staat er altijd bij als optionele stap met de stand.
 */
export function PhaseSteps({ project, page, gates, stage, onTab, onSaved, onDates }: {
  project: ProjectRow; page: ProjectPage; gates: Gate[]; stage: string; onTab: (tab: string) => void; onSaved: () => void; onDates?: () => void
}) {
  const code = project.project_code
  const items: CheckItem[] = page.checklist
  const rules = useMemo(() => Object.fromEntries(page.templates.map((x) => [x.id, x.auto_rule])) as Record<number, string | null>, [page.templates])
  const words = useMemo(() => Object.fromEntries(page.templates.map((x) => [x.id, x.agenda_words])) as Record<number, string | null>, [page.templates])
  const flagKinds = new Set(page.today.map((f) => f.kind))
  const partnerName = page.partner?.partner ?? 'de partner'
  const nowGate = gates.find((g) => !g.passed)
  const viewed = gates.find((g) => g.stage === stage)
  const cur = viewed
  const looking = !!viewed && viewed !== nowGate
  const rule = (it: CheckItem) => rules[it.template_id] ?? null
  const covered = (it: CheckItem) => (STEP[rule(it) ?? '']?.flags ?? []).some((k) => flagKinds.has(k))
  const tick = async (it: CheckItem, na = false, by?: string) => {
    const { error } = await supabase.from('project_checklist').upsert({ project_code: code, template_id: it.template_id, done_at: na ? null : new Date().toISOString(), na, ...(by ? { done_by: by } : {}) })
    if (error) return toast(error.message, 'err')
    toast(na ? 'Op n.v.t. gezet' : 'Afgevinkt'); onSaved()
  }
  const tabBtnN = (tab: string) => tab === 'datums'
    ? <button className="ovn-btn" onClick={() => onDates ? onDates() : onTab('overzicht')}>Invullen</button>
    : <button className="ovn-btn" onClick={() => onTab(tab)}>Openen</button>
  const all = items ?? []
  const steps: Step[] = []
  // elke fase is aan te passen (8/11/2026, Olivier: "ik kan hier ook niets wijzigen"): met de hand afgevinkt = ongedaan te maken,
  // automatisch = toont waar het vandaan komt (kennismaking: datum wijzigen; Go: via Fase wijzigen)
  const later = !!(cur && nowGate && cur.sort > nowGate.sort)
  const untick = async (it: CheckItem) => {
    const { error } = await supabase.from('project_checklist').upsert({ project_code: code, template_id: it.template_id, done_at: null, na: false, done_by: null })
    if (error) return toast(error.message, 'err')
    toast('Ongedaan gemaakt'); onSaved()
  }
  const goSurvey = () => { const el = document.querySelector('.lead-actions'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); else onTab('vragenlijst') }
  const undoBtn = (it: CheckItem) => <button className="ovn-na" onClick={() => untick(it)} title="Afvinken ongedaan maken">ongedaan</button>
  for (const it of all.filter((x) => cur && x.stage === cur.stage).sort((a, b) => a.sort - b.sort)) {
    const r = rule(it), s = r ? STEP[r] : null
    const w = r === 'agenda' && words[it.template_id] ? words[it.template_id]!.split(',')[0].trim() : null
    const k = 's' + it.template_id
    const auto = it.done_by === 'automatisch'
    if (r === 'survey_submitted') { // vragenlijst: optioneel, altijd zichtbaar met de stand
      const req = project.survey_requested_at
      steps.push(it.done
        ? { key: k, state: 'done', text: 'Vragenlijst', hint: 'optioneel · ingevuld door de klant', side: it.done_at ? short(it.done_at) : null }
        : { key: k, state: 'opt', text: 'Vragenlijst', hint: 'optioneel · ' + (project.survey_status === 'open' ? 'begonnen, nog niet ingediend' : req ? `gevraagd ${short(req)}` : 'niet gevraagd'),
            act: <button className="ovn-btn" onClick={goSurvey}>{req || project.survey_status === 'open' ? 'Opvolgen' : 'Sturen'}</button> })
      continue
    }
    if (it.done) {
      const src = r === 'measures_known' && it.done_by && !auto && it.done_by !== 'met de hand' ? it.done_by : null
      steps.push({ key: k, state: 'done', text: it.label, side: it.done_at ? short(it.done_at) : null,
        hint: src ?? (auto && r === 'go_given' ? 'terugzetten: Fase wijzigen' : auto && r === 'intro_done' ? 'datum van de kennismaking' : auto ? 'vanzelf' : null),
        act: !auto ? undoBtn(it) : r === 'intro_done' ? <button className="ovn-na" onClick={() => onDates ? onDates() : onTab('overzicht')}>datum wijzigen</button> : undefined })
      continue
    }
    if (it.na) { steps.push({ key: k, state: 'na', text: it.label, side: 'n.v.t.', act: undoBtn(it) }); continue }
    const skippedHint = it.skipped ? 'overgeslagen' : null
    if (r === 'measures_known') {
      steps.push({ key: k, state: 'open', text: it.label, hint: skippedHint ?? 'vanzelf na opmeting of vragenlijst',
        act: <select className="ovn-btn" value="" aria-label="Waar komen de maten vandaan?" onChange={(e) => e.target.value && tick(it, false, e.target.value)}><option value="">Gekend ▾</option>{MEASURE_SRC.map((m) => <option key={m} value={m}>{m}</option>)}</select> })
    } else if (!r || s?.tick) {
      steps.push({ key: k, state: 'open', text: it.label, hint: skippedHint ?? (w ? `vanzelf na afspraak "${w}"` : null),
        act: <><button className="ovn-btn" onClick={() => tick(it)}>Gedaan</button><button className="ovn-na" onClick={() => tick(it, true)} title="Niet van toepassing">n.v.t.</button></> })
    } else if (r === 'intro_done') {
      steps.push({ key: k, state: 'open', text: it.label, hint: project.intro_at ? `gepland ${short(project.intro_at)}` : 'datum van de kennismaking nog niet ingevuld',
        act: <button className="ovn-btn" onClick={() => onDates ? onDates() : onTab('overzicht')}>{project.intro_at ? 'Wijzigen' : 'Invullen'}</button> })
    } else {
      const hint = r === 'design_version' ? 'vanzelf na upload uit PaletteCAD' : r === 'go_given' ? 'knop Go bij Aanvraag' : r === 'production_done' ? `wacht op ${partnerName}` : s && !s.now ? WAIT[s.who] ?? null : null
      steps.push({ key: k, state: it.skipped ? 'na' : 'open', text: it.label, hint: skippedHint ?? (covered(it) ? 'zie Te doen' : hint),
        act: s?.now && s.tab && !covered(it) && r !== 'design_version' ? tabBtnN(s.tab) : undefined, side: later ? 'later' : s && !s.now ? 'vanzelf' : null })
    }
  }

  if (!cur) return null
  return (
    <div className={'ovn' + (looking ? ' ovn-look' : '')}>
      <div className="ovn-h">Stappen · {cur.label}<span>{looking ? (cur.passed ? (cur.done_at ? `klaar op ${short(cur.done_at)}` : 'klaar') : 'nog niet aan de beurt') : cur.gate_label ? `daarna: ${cur.gate_label.toLowerCase()}` : ''}</span></div>
      {steps.length > 0 ? <ol className="ovn-list">{steps.map((x) => <StepRow key={x.key} s={x} />)}</ol> : <p className="muted small">Geen stappen in deze fase.</p>}
    </div>
  )
}
