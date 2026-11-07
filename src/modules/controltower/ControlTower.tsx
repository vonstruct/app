import { Tasks } from '../../core/Tasks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { HoursQuickAdd } from '../../core/Hours'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { relDays, useProjects, type ProjectProgress, type ProjectRow } from '../../core/projects'
import { ProposalCard, TeachBox } from '../von/VonPage'
import { toast } from '../../core/toast'

/**
 * Vandaag v4 (5 nov 2026): enkel wat jou nodig heeft. Bovenaan "Vandaag" (alles met een deadline vandaag/morgen of te laat, over de
 * categorieën heen), daaronder per categorie (Bestellingen & leveringen, Planning & opdrachten, Klanten & mails, Facturen & betalingen,
 * Kwaliteit). Elk punt zegt waarom het er staat en gaat met één klik naar de plek waar je het oplost. Voorstellen van de agents tonen
 * aanleiding / voorstel / waarom en kunnen aangeleerd worden. Onderaan: één regel per agent met wat die zelf deed (uitklappen = nakijken).
 * Bron: app_today (= app_control_tower + mailboxdocumenten + levertijd onbekend + in-app te doen), app_agent_activity, app_autonomy_offers.
 */
export type Flag = {
  prio: 1 | 2 | 3; kind: string; project_code: string | null; last_version: number | null; ref: string | null; title: string; detail: string | null; since: string | null
  category: string; kind_label: string; due_date: string | null; due_reason: string | null; context: string | null; reason: string | null; agent: string | null
  proposal_kind: string | null; proposal_title: string | null; proposal_summary: string | null; plan: string | null; link: string | null; client_name: string | null
}
type Cat = { key: string; label: string; hint: string | null; sort: number }
type DayItem = { id: string; start: string; end: string; title: string; sub?: string; to: string; kind: 'afspraak' | 'opdracht'; ok?: boolean; allDay?: boolean }
type Act = { agent: string; agent_name: string; source: string; ref: string; at: string; project_code: string | null; title: string; detail: string | null; link: string | null; can_undo: boolean; what: string | null; verdict: string | null; review_note: string | null }
type Offer = { agent_id: string; agent_name: string; kind: string; kind_label: string; n: number }

const AGENT_NAME: Record<string, string> = { inbox: 'Inbox', planning: 'Planning', nakijker: 'Nakijker', von_watch: 'VON', von: 'VON', inkoop: 'Inkoop', intake: 'Intake', controle: 'Controle' }

/** Waar je het punt oplost, en wat er op de knop staat. Nieuwe soort = één case. */
export const actionFor = (f: Flag): { to: string; label: string } => {
  const proj = f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}` : '/projecten'
  const ver = f.last_version ? `${proj}/v/${f.last_version}` : proj
  switch (f.kind) {
    case 'taak': return { to: f.link ?? proj, label: 'Openen' }
    case 'inkoop_docs': return { to: '/bestellingen?tab=mailbox', label: 'Nakijken' }
    case 'levertijd': return { to: `${proj}?tab=bestellingen`, label: 'Levertijd invullen' }
    case 'prijzen': return { to: `${proj}?tab=kost&focus=prijzen`, label: 'Prijzen invullen' }
    case 'kosten': return { to: `${proj}?tab=kost`, label: 'Kosten bekijken' }
    case 'optimalisatie': return { to: `${ver}?tab=platen`, label: 'Platen bekijken' }
    case 'stuklijst_fout': return { to: `${ver}?tab=controle`, label: 'Fouten bekijken' }
    case 'stuklijst_opm': return { to: `${ver}?tab=controle`, label: 'Nakijken' }
    case 'klant_email': return { to: `${proj}?focus=email`, label: 'E-mail invullen' }
    case 'gegevens': return { to: `${proj}?focus=gegevens`, label: 'Invullen' }
    case 'datums': return { to: `${proj}?focus=datums`, label: 'Datum invullen' }
    // harde stap overgeslagen (offerte getekend / voorschot betaald), 7 nov 2026
    case 'uren': return { to: `/overzicht?uren=${f.ref}`, label: 'Uren invullen' }
    case 'regel': return { to: '/regels?sectie=Facturen', label: 'Regel aanpassen' }
    case 'poort': return /offerte/i.test(f.title) ? { to: `${proj}?tab=offerte`, label: 'Offerte bekijken' } : { to: `${proj}?tab=facturen`, label: 'Facturen bekijken' }
    case 'partner_email': return { to: `/relaties?tab=partners&focus=${f.ref}:email`, label: 'E-mail invullen' }
    case 'stilstand': return { to: `${proj}?focus=fase`, label: 'Fase aanpassen' }
    case 'survey_nieuw': return { to: `${proj}?focus=survey`, label: 'Vragenlijst bekijken' }
    case 'survey_open': return { to: `${proj}?focus=survey`, label: 'Klant contacteren' }
    case 'leverancier': return { to: '/regels?sectie=Prijzen', label: 'Regels' }
    case 'aanvraag_nieuw': return { to: proj, label: 'Aanvraag openen' }
    case 'opdracht': return { to: `/opdrachten?focus=${f.ref}`, label: 'Opdracht openen' }
    case 'mail': return { to: '/mails?tab=app', label: 'Mails bekijken' }
    case 'mail_antwoord': return { to: `/inbox?focus=${f.ref}`, label: 'Antwoorden' }
    case 'von_voorstel': return { to: '/von', label: 'Bekijken' }
    case 'afspraak_hold': return { to: '/agenda', label: 'Annuleren of verzetten' }
    case 'oplevering': case 'werkpunt': case 'garantie': case 'review': return { to: `${proj}?tab=oplevering`, label: f.kind === 'werkpunt' ? 'Opvolgen' : f.kind === 'review' ? 'Review vragen' : 'Oplevering openen' }
    case 'nacalculatie': return { to: `${proj}?tab=nacalculatie`, label: 'Nacalculatie' }
    case 'capaciteit': return { to: '/capaciteit', label: 'Capaciteit bekijken' }
    case 'factuur': return { to: f.project_code ? `${proj}?tab=facturen` : '/facturen', label: f.title.startsWith('Onbetaald') ? 'Opvolgen' : 'Factuur maken' }
    case 'controle': {
      const pc = f.project_code ? proj : null
      if (f.title.startsWith('Aankoop')) return { to: '/facturen?tab=aankoop', label: 'Bekijken' }
      if (f.title.startsWith('Offerte')) return { to: pc ? pc + '?tab=offerte' : '/projecten', label: 'Offerte openen' }
      if (f.title.startsWith('Bestelling')) return { to: pc ? pc + '?tab=bestellingen' : '/bestellingen', label: 'Bestelling bekijken' }
      if (f.title.startsWith('Klant')) return { to: pc ?? '/relaties', label: 'Klant aanvullen' }
      return { to: pc ? pc + '?tab=facturen' : '/facturen', label: 'Bekijken' }
    }
    case 'planning': return { to: proj, label: 'Planning bekijken' }
    case 'aankoopfactuur': return { to: '/facturen?tab=aankoop', label: 'Bekijken' }
    case 'offerte': return { to: `${proj}?tab=offerte`, label: 'Offerte openen' }
    case 'partner': return { to: `${proj}?tab=productie`, label: 'Naar Productie' }
    case 'bestelling': return { to: `${proj}?tab=bestellingen`, label: 'Bestelling bekijken' }
    case 'backup': return { to: 'https://github.com/vonstruct/platform/actions/workflows/backup-onedrive.yml', label: 'Back-up bekijken' }
    default: return { to: proj, label: 'Openen' }
  }
}

export const cleanTitle = (f: Flag) => f.title.replace(/^VON stelt voor:\s*/, '').replace(/^Wacht op antwoord:\s*/, '')
export const keyOf = (f: { kind: string; ref: string | null; project_code: string | null; title: string }) => `${f.kind}:${f.ref ?? f.project_code ?? f.title}`

const ICON: Record<string, string> = {
  von: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  bestellingen: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  planning: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  klanten: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  facturen: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9',
  kwaliteit: 'M9 12.5l2 2 4-4.5M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  systeem: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
}
export const Ico = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[name] ?? ICON.kwaliteit} /></svg>
)
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const hm = (iso: string) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
const isoToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
/** "tegen vr 13/11" of "te laat sinds 4/11", enkel bij een gekende datum. */
export const dueText = (d: string | null) => {
  if (!d) return null
  const t = isoToday(), tm = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
  const f = new Date(d + 'T12:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'numeric' })
  if (d < t) return { text: `te laat (was ${f})`, cls: 'bad' }
  if (d === t) return { text: 'vandaag', cls: 'bad' }
  if (d === tm) return { text: 'morgen', cls: 'warn' }
  return { text: `tegen ${f}`, cls: '' }
}

/** Korte melding onderaan met "Ongedaan maken". */
function useToast() {
  const [t, setT] = useState<{ text: string; undo?: () => void } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string, undo?: () => void) => {
    setT({ text, undo }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setT(null), 5000)
  }, [])
  const el = t && (
    <div className="vd-toast" role="status"><span>{t.text}</span>{t.undo && <button onClick={() => { t.undo!(); setT(null) }}>Ongedaan maken</button>}</div>
  )
  return { show, el }
}

export function ControlTower() {
  // RPC today_items = app_today met een bewaard plan (snelheid, 6 nov 2026)
  const flags = useQuery<Flag[]>(async () => { const { data, error } = await supabase.rpc('today_items'); return { data: (data ?? []) as Flag[], error } }, [])
  const cats = useQuery<Cat[]>(() => supabase.from('today_categories').select('*').order('sort'), [])
  const projects = useProjects()
  // uren invullen: knop "+ Uren" of punt "Uren invullen" (/overzicht?uren=<opdracht>), 7 nov 2026
  const [params, setParams] = useSearchParams()
  const [hours, setHours] = useState<{ job: string | null } | null>(null)
  useEffect(() => { const j = params.get('uren'); if (j) { setHours({ job: j }); setParams({}, { replace: true }) } }, [params, setParams])
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const toast = useToast()

  const loadSnooze = useCallback(() => supabase.from('ct_snooze').select('key').gt('until', new Date().toISOString())
    .then(({ data }) => setSnoozed(new Set((data ?? []).map((r: { key: string }) => r.key)))), [])
  useEffect(() => { loadSnooze() }, [loadSnooze])

  const all = (flags.data ?? []).filter((f) => !snoozed.has(keyOf(f)) && !gone.has(keyOf(f)))
  const sys = all.filter((f) => f.category === 'systeem')
  const work = all.filter((f) => f.category !== 'systeem')
  const today = work.filter((f) => f.prio === 1)
  const catList = (cats.data ?? []).filter((c) => c.key !== 'systeem')
  const catLabel = (k: string) => cats.data?.find((c) => c.key === k)?.label ?? k

  const ps = projects.data ?? []
  const active = ps.filter((p) => p.phase_active !== false)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  const later = async (f: Flag) => {
    const until = new Date(); until.setDate(until.getDate() + 1); until.setHours(6, 0, 0, 0)
    const key = keyOf(f)
    await supabase.from('ct_snooze').upsert({ key, until: until.toISOString() })
    setSnoozed((s) => new Set(s).add(key))
    toast.show('Verborgen tot morgen', async () => {
      await supabase.from('ct_snooze').delete().eq('key', key)
      setSnoozed((s) => { const n = new Set(s); n.delete(key); return n })
    })
  }
  const hide = (f: Flag, text: string, undo?: () => PromiseLike<unknown>) => {
    const key = keyOf(f)
    setGone((s) => new Set(s).add(key))
    toast.show(text, undo ? async () => { await undo(); setGone((s) => { const n = new Set(s); n.delete(key); return n }) } : undefined)
  }
  const dismissMail = async (f: Flag) => {
    await supabase.from('mail_messages').update({ dismissed_at: new Date().toISOString() }).eq('id', f.ref!)
    hide(f, 'Geen antwoord nodig', () => supabase.from('mail_messages').update({ dismissed_at: null }).eq('id', f.ref!))
  }
  const taskDone = async (f: Flag) => {
    await supabase.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', f.ref!)
    hide(f, 'Afgevinkt', () => supabase.from('tasks').update({ done_at: null }).eq('id', f.ref!))
  }
  const proposalDone = (f: Flag) => { setGone((s) => new Set(s).add(keyOf(f))); setOpen(null); toast.show('Voorstel afgehandeld'); flags.reload() }

  // één zin: wat er vandaag is, en waar de rest zit
  const byCat = (list: Flag[]) => catList.map((c) => ({ c, n: list.filter((f) => f.category === c.key).length })).filter((x) => x.n)
  const weekCount = work.filter((f) => f.prio === 2).length
  const sentence = today.length
    ? `Vandaag ${today.length === 1 ? 'is er 1 punt' : `zijn er ${today.length} punten`}: ${byCat(today).map((x) => `${x.n} bij ${x.c.label.split(' ')[0].toLowerCase()}`).join(', ')}.` + (weekCount ? ` Daarna ${weekCount} voor deze week.` : '')
    : weekCount ? `Niets voor vandaag. ${weekCount} ${weekCount === 1 ? 'punt' : 'punten'} voor deze week.` : 'Niets dringends. Een rustige dag.'

  const Row = ({ f, showCat = false }: { f: Flag; showCat?: boolean }) => {
    const k = keyOf(f), act = actionFor(f), isVon = f.kind === 'von_voorstel' && !!f.ref, isOpen = isVon && open === k
    const due = dueText(f.due_date)
    return (
      <div className={'vd-item' + (isOpen ? ' open' : '')}>
        <div className="vd-row">
          <span className={'vd-ico' + (isVon ? ' is-von' : '')}><Ico name={isVon ? 'von' : f.category} /></span>
          <span className="vd-what">
            <span className="vd-t">
              {f.project_code && <Link to={`/projecten/${encodeURIComponent(f.project_code)}`} className="vd-code">{f.project_code}</Link>}
              {isVon ? (f.proposal_title ?? cleanTitle(f)) : cleanTitle(f)}
            </span>
            <span className="vd-meta">
              {showCat && <span className="vd-cat">{catLabel(f.category)}</span>}
              {isVon && f.agent && <span className="vd-cat agent">{AGENT_NAME[f.agent] ?? f.agent} stelt voor</span>}
              {f.kind === 'taak' && <span className="vd-cat">te doen in de app</span>}
              {f.client_name && <span>{f.client_name}</span>}
              {due && <span className={'vd-due ' + due.cls}>{due.text}{f.due_reason ? ` · ${f.due_reason}` : ''}</span>}
            </span>
            {isVon && !isOpen ? (
              <span className="vd-why">
                {f.context && <span><b>Aanleiding</b> {f.context}</span>}
                <span><b>Waarom</b> {f.reason ?? f.proposal_summary ?? f.detail ?? '—'}</span>
              </span>
            ) : !isOpen && f.detail && <span className="vd-s">{f.detail}</span>}
          </span>
          <span className="vd-acts">
            {isVon ? (
              <button className={isOpen ? 'vd-btn ghost' : 'vd-btn gold'} onClick={() => setOpen(isOpen ? '' : k)}>{isOpen ? 'Inklappen' : 'Bekijken'}</button>
            ) : act.to.startsWith('http') ? (
              <a href={act.to} target="_blank" rel="noreferrer" className="vd-btn">{act.label} ↗</a>
            ) : (
              <Link to={act.to} className={'vd-btn' + (f.prio === 1 ? ' gold' : '')}>{act.label}</Link>
            )}
            {f.kind === 'mail_antwoord' && f.ref && <button className="vd-btn ghost" onClick={() => dismissMail(f)} title="Geen antwoord nodig">Klaar</button>}
            {f.kind === 'taak' && f.ref && <button className="vd-btn ghost" onClick={() => taskDone(f)} title="Afvinken">Klaar</button>}
            {!isVon && <button className="vd-btn ghost" onClick={() => later(f)} title="Verbergen tot morgen">Later</button>}
            <span className="vd-age">{relDays(f.since)}</span>
          </span>
        </div>
        {isOpen && <InlineProposal id={f.ref!} onDone={() => proposalDone(f)} />}
      </div>
    )
  }

  return (
    <section className="vd">
      <header className="vd-hello">
        <div>
          <div className="vd-date">{new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greet}, Olivier</h1>
          <p className="vd-von"><span className="vd-vdot">V</span><span>{sentence}</span></p>
        </div>
        <div className="vd-pills">
          <span className="vd-pill now"><i /> <b>{today.length}</b> vandaag</span>
          <span className="vd-pill week"><i /> <b>{weekCount}</b> deze week</span>
          <Link to="/projecten" className="vd-pill good"><i /> <b>{active.length}</b> lopend{active.length === 1 ? ' project' : 'e projecten'}</Link>
          <button className="vd-pill hours-btn" onClick={() => setHours({ job: null })}>+ Uren</button>
        </div>
      </header>
      {hours && <HoursQuickAdd jobId={hours.job} onClose={() => setHours(null)} onSaved={() => flags.reload()} />}
      <ErrorBox error={flags.error ?? projects.error ?? cats.error} />
      {!flags.data || !projects.data || !cats.data ? (flags.error || projects.error || cats.error ? null : <Loading />) : (
        <div className="vd-grid">
          <div className="vd-col">
            <AutonomyOffers />
            <section className="panel vd-panel">
              <div className="vd-h"><h2>Vandaag</h2><span className="vd-more">te laat, vandaag of morgen</span></div>
              {today.length === 0
                ? <div className="vd-empty"><b>Niets voor vandaag</b>Wat later moet, staat hieronder per categorie.</div>
                : <div className="vd-group">{today.map((f) => <Row key={keyOf(f)} f={f} showCat />)}</div>}
            </section>
            {catList.map((c) => {
              const list = work.filter((f) => f.category === c.key && f.prio === 2)
              const info = work.filter((f) => f.category === c.key && f.prio === 3)
              const nToday = today.filter((f) => f.category === c.key).length
              if (!list.length && !info.length) return null
              return (
                <section key={c.key} className="panel vd-panel vd-catp">
                  <div className="vd-h"><span className="vd-hico"><Ico name={c.key} /></span><h2>{c.label}</h2><span className="vd-more">{list.length ? `${list.length} deze week` : ''}{nToday ? ` · ${nToday} bij vandaag` : ''}</span></div>
                  {list.length > 0 && <div className="vd-group">{list.map((f) => <Row key={keyOf(f)} f={f} />)}</div>}
                  {info.length > 0 && <details className="vd-info"><summary>Ter info · {info.length} {info.length === 1 ? 'punt' : 'punten'}</summary>{info.map((f) => <Row key={keyOf(f)} f={f} />)}</details>}
                </section>
              )
            })}
            <AgentActivity />
          </div>

          <aside className="vd-col">
            <YourDay projects={ps} />
            <div className="vd-tasks"><Tasks limit={6} title="Taken buiten de app" kind="buiten" /></div>
            <ActiveProjects projects={active} />
            {sys.length === 0 ? (
              <div className="panel vd-sys"><i className="ok" />Alle systemen in orde</div>
            ) : (
              <div className="panel vd-sys bad">
                <i className="bad" />
                <span>{sys.map((f) => { const a = actionFor(f); return a.to.startsWith('http')
                  ? <a key={keyOf(f)} href={a.to} target="_blank" rel="noreferrer">{f.title}</a>
                  : <Link key={keyOf(f)} to={a.to}>{f.title}</Link> })}</span>
              </div>
            )}
          </aside>
        </div>
      )}
      {toast.el}
    </section>
  )
}

/** VON-voorstel in de lijst zelf: tekst lezen/aanpassen, goedkeuren of aanleren. */
export function InlineProposal({ id, onDone }: { id: string; onDone: () => void }) {
  const [p, setP] = useState<any>(null)
  useEffect(() => { supabase.from('von_proposals').select('*').eq('id', id).maybeSingle().then(({ data }) => setP(data)) }, [id])
  if (!p) return <div className="vd-draft muted small">Laden…</div>
  return <div className="vd-draft"><ProposalCard p={p} onDone={() => { supabase.from('von_proposals').select('status').eq('id', id).single().then(({ data }) => { if (data?.status !== 'voorstel') onDone() }) }} /></div>
}

/** "Mag Inkoop dit voortaan zelf doen?" na 5× goedkeuren zonder wijzigen (app_autonomy_offers). */
function AutonomyOffers() {
  const q = useQuery<Offer[]>(() => supabase.from('app_autonomy_offers').select('*'), [])
  const decide = async (o: Offer, mode: 'zelf' | 'vragen') => {
    const { error } = await supabase.from('agent_autonomy').insert({ agent_id: o.agent_id, kind: o.kind, mode, decided_by: 'Vandaag' })
    toast(error ? 'Niet bewaard: ' + error.message : mode === 'zelf' ? `${o.agent_name} doet dit voortaan zelf` : 'Blijft vragen', error ? 'err' : 'ok')
    q.reload()
  }
  if (!q.data?.length) return null
  return (
    <>{q.data.map((o) => (
      <section key={o.agent_id + o.kind} className="panel vd-offer">
        <span className="vd-vdot">V</span>
        <div>
          <b>Mag {o.agent_name} “{o.kind_label}” voortaan zelf doen?</b>
          <p className="small muted">Je keurde de laatste 5 voorstellen van deze soort goed zonder iets te wijzigen. Voortaan doet {o.agent_name} het zelf (enkel binnen de app, nooit iets naar buiten) en zie je het onderaan bij “Wat de agents deden”, met ongedaan maken. Terugdraaien kan in VON → Team.</p>
          <span className="toolbar"><button className="primary" onClick={() => decide(o, 'zelf')}>Ja, voortaan zelf</button><button onClick={() => decide(o, 'vragen')}>Nee, blijf het vragen</button></span>
        </div>
      </section>
    ))}</>
  )
}

/** Wat de agents zelf deden: één regel per agent, uitklappen = elke handeling nakijken (klopt / fout / aanleren / ongedaan maken). */
function AgentActivity() {
  const q = useQuery<Act[]>(() => supabase.from('app_agent_activity').select('*').order('at', { ascending: false }).limit(400), [])
  const [open, setOpen] = useState<string | null>(null)
  const [teach, setTeach] = useState<string | null>(null)
  const [showChecked, setShowChecked] = useState(false)
  const list = q.data ?? []
  const groups = useMemo(() => {
    const m = new Map<string, Act[]>()
    for (const a of list) m.set(a.agent, [...(m.get(a.agent) ?? []), a])
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [list])
  const review = async (a: Act, verdict: 'ok' | 'fout' | 'geleerd', note?: string) => {
    const { error } = await supabase.from('agent_reviews').upsert({ source: a.source, ref: a.ref, verdict, note: note ?? null, at: new Date().toISOString(), by: 'Vandaag' })
    if (error) toast('Niet bewaard: ' + error.message, 'err')
    q.reload()
  }
  const allOk = async (items: Act[]) => {
    const rows = items.filter((a) => !a.verdict).map((a) => ({ source: a.source, ref: a.ref, verdict: 'ok', at: new Date().toISOString(), by: 'Vandaag' }))
    if (!rows.length) return
    const { error } = await supabase.from('agent_reviews').upsert(rows)
    toast(error ? 'Niet bewaard: ' + error.message : `${rows.length} nagekeken`, error ? 'err' : 'ok'); q.reload()
  }
  const undo = async (a: Act) => {
    const { data, error } = await supabase.functions.invoke('von-action', { body: { action: 'undo', id: a.ref } })
    const d = data as { ok?: boolean; error?: string } | null
    toast(error ? 'Mislukt' : d?.error ?? 'Ongedaan gemaakt', error || d?.error ? 'err' : 'ok'); review(a, 'fout')
  }
  const summary = (items: Act[]) => {
    const c = (re: RegExp) => items.filter((a) => re.test(a.title)).length
    const parts = [
      [c(/^Gekoppeld aan/), 'gekoppeld'], [c(/^Geen project/), 'zonder project gelaten'], [c(/^Aankoopfactuur gekoppeld/), 'aankoopfactuur gekoppeld'],
      [c(/^Taak gemaakt/), 'taak|taken'], [c(/^Te doen gezet/), 'te doen in de app'], [c(/^Zelf gedaan/), 'zelf gedaan'], [c(/^Intake/), 'intake|intakes'],
      [c(/^Automatisch naar/), 'project naar de volgende fase|projecten naar de volgende fase'],
    ].filter(([n]) => n).map(([n, t]) => [n, String(t).includes('|') ? String(t).split('|')[Number(n) === 1 ? 0 : 1] : t]) as [number, string][]
    const rest = items.length - parts.reduce((x, [n]) => x + n, 0)
    return [...parts.map(([n, t]) => `${n} ${t}`), ...(rest > 0 ? [`${rest} andere`] : [])].join(' · ')
  }
  return (
    <section className="panel vd-panel">
      <div className="vd-h"><span className="vd-hico"><Ico name="von" /></span><h2>Wat de agents deden</h2><span className="vd-more">laatste 7 dagen</span></div>
      {!q.data ? <p className="muted small vd-pad">Laden…</p> : groups.length === 0 ? <p className="muted small vd-pad">De agents deden deze week niets zelf.</p> : groups.map(([agent, items]) => {
        const todo = items.filter((a) => !a.verdict)
        const shown = (showChecked ? items : todo).slice(0, 60)
        const isOpen = open === agent
        return (
          <div key={agent} className={'vd-agent' + (isOpen ? ' open' : '')}>
            <button className="vd-agent-line" onClick={() => setOpen(isOpen ? null : agent)} aria-expanded={isOpen}>
              <b>{items[0].agent_name}</b>
              <span className="vd-s">{summary(items)}</span>
              <span className={'vd-badge' + (todo.length ? ' k' : '')}>{todo.length ? `${todo.length} na te kijken` : '✓ nagekeken'}</span>
              <span className="vd-chev">{isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && (
              <div className="vd-agent-body">
                <div className="toolbar small">
                  {todo.length > 0 && <button onClick={() => allOk(todo)}>✓ Alles klopt ({todo.length})</button>}
                  <label className="check"><input type="checkbox" checked={showChecked} onChange={(e) => setShowChecked(e.target.checked)} /> ook nagekeken tonen</label>
                </div>
                {shown.length === 0 && <p className="muted small">Alles nagekeken.</p>}
                {shown.map((a) => (
                  <div key={a.source + a.ref} className={'vd-act' + (a.verdict ? ' done ' + a.verdict : '')}>
                    <div className="vd-act-row">
                      <span className="vd-what">
                        <span className="vd-t">{a.project_code && <span className="vd-code">{a.project_code}</span>}{a.title}</span>
                        {a.detail && <span className="vd-s">{a.detail}</span>}
                        {a.review_note && <span className="vd-s">Geleerd: {a.review_note}</span>}
                      </span>
                      <span className="vd-acts">
                        {a.link && <Link className="vd-btn ghost" to={a.link}>Openen</Link>}
                        {!a.verdict && <button className="vd-btn" onClick={() => review(a, 'ok')}>✓ Klopt</button>}
                        {!a.verdict && <button className="vd-btn ghost" onClick={() => setTeach(teach === a.source + a.ref ? null : a.source + a.ref)}>Fout / aanleren</button>}
                        {a.verdict && <span className="vd-age">{a.verdict === 'ok' ? '✓ klopt' : a.verdict === 'geleerd' ? 'aangeleerd' : 'fout'}</span>}
                      </span>
                    </div>
                    {teach === a.source + a.ref && (
                      <TeachBox agentId={a.agent} kind={a.what} source={a.source} refId={a.ref} example={a.title}
                        extra={a.can_undo ? { label: 'Ongedaan maken', run: () => undo(a) } : undefined}
                        onSaved={(lesson) => { setTeach(null); review(a, 'geleerd', lesson) }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Je dag: afspraken (Outlook/Bookings) en opdrachten, vandaag en morgen, als tijdlijn. */
function YourDay({ projects }: { projects: ProjectRow[] }) {
  const [items, setItems] = useState<DayItem[] | null>(null)
  useEffect(() => {
    const from = startOfDay(new Date()), to = new Date(from.getTime() + 2 * 86400000)
    Promise.all([
      supabase.functions.invoke('agenda', { body: { action: 'list', from: from.toISOString(), to: to.toISOString() } }),
      supabase.from('jobs').select('id,title,start_at,end_at,slot,status,outlook_event_id,for_me,subcontractors(name),partners(name)').neq('status', 'geannuleerd').lt('start_at', to.toISOString()).gt('end_at', from.toISOString()),
    ]).then(([ag, jb]) => {
      type J = { id: string; title: string; start_at: string; end_at: string; slot: string | null; status: string; outlook_event_id: string | null; for_me: boolean; subcontractors: { name: string } | null; partners: { name: string } | null }
      const jobs = (jb.data ?? []) as unknown as J[]
      const mirror = new Set(jobs.map((j) => j.outlook_event_id).filter(Boolean))
      type E = { id: string; title: string; start: string; end: string; all_day: boolean; outlook_id?: string; location?: string | null; customer?: { name?: string } | null }
      const evs = ((ag.data as { events?: E[] })?.events ?? []).filter((e) => !(e.outlook_id && mirror.has(e.outlook_id)))
      setItems([
        ...evs.map((e) => ({ id: e.id, start: e.start, end: e.end, title: e.title, sub: e.location ?? e.customer?.name ?? undefined, kind: 'afspraak' as const, allDay: e.all_day, to: `/agenda?d=${e.start.slice(0, 10)}&e=${encodeURIComponent(e.id)}` })),
        ...jobs.map((j) => ({ id: 'j' + j.id, start: j.start_at, end: j.end_at, title: j.title, sub: (j.for_me ? 'Vonstruct' : j.subcontractors?.name ?? j.partners?.name ?? '') + (j.status === 'gepland' ? ' · nog niet bevestigd' : ' · ✓ bevestigd'), kind: 'opdracht' as const, ok: j.status !== 'gepland', allDay: j.slot === 'dag', to: `/opdrachten?focus=${j.id}` })),
      ].sort((a, b) => a.start.localeCompare(b.start)))
    })
  }, [])
  const today = startOfDay(new Date())
  const intros = projects.filter((p) => p.intro_at && new Date(p.intro_at) >= today && new Date(p.intro_at) < new Date(today.getTime() + 2 * 86400000))
  const groups = [0, 1].map((n) => {
    const d = new Date(today.getTime() + n * 86400000)
    return { label: n === 0 ? 'Vandaag' : 'Morgen', list: (items ?? []).filter((i) => new Date(i.start) < new Date(d.getTime() + 86400000) && new Date(i.end) > d) }
  })
  return (
    <section className="panel vd-panel">
      <div className="vd-h"><h2>Je dag</h2><Link to="/agenda" className="vd-more">Agenda</Link></div>
      <div className="vd-tl">
        {items === null ? <p className="muted small">Laden…</p> : groups.map((g) => (
          <div key={g.label}>
            <div className="vd-day">{g.label}</div>
            {g.list.length === 0 ? <p className="muted small vd-none">Niets gepland.</p> : g.list.map((i) => (
              <Link key={i.id + g.label} to={i.to} className="vd-ev">
                <span className="vd-hm">{i.allDay ? 'dag' : hm(i.start)}</span>
                <span className={'vd-bar ' + (i.kind === 'opdracht' ? (i.ok ? 'job' : 'q') : '')} />
                <span className="vd-what"><span className="vd-t">{i.title}</span>{i.sub && <span className="vd-s">{i.sub}</span>}</span>
              </Link>
            ))}
          </div>
        ))}
        {intros.length > 0 && items !== null && !items.some((i) => i.title.toLowerCase().includes('kennismak')) && (
          <p className="muted small">Kennismaking: {intros.map((p) => p.client_name).join(', ')}</p>
        )}
      </div>
    </section>
  )
}

/** Lopende projecten: fase, voortgang in de fase, volgende stap. */
function ActiveProjects({ projects }: { projects: ProjectRow[] }) {
  const [prog, setProg] = useState<Record<string, ProjectProgress>>({})
  useEffect(() => { supabase.from('app_project_progress').select('*').then(({ data }) => setProg(Object.fromEntries(((data ?? []) as ProjectProgress[]).map((r) => [r.project_code, r])))) }, [])
  const list = useMemo(() => [...projects].sort((a, b) => (b.last_activity ?? '').localeCompare(a.last_activity ?? '')).slice(0, 5), [projects])
  return (
    <section className="panel vd-panel">
      <div className="vd-h"><h2>Lopende projecten</h2><Link to="/projecten" className="vd-more">Alle</Link></div>
      {list.length === 0 ? <p className="muted small vd-pad">Geen lopende projecten.</p> : list.map((p) => {
        const g = prog[p.project_code] as (ProjectProgress & { stage_done?: number; stage_total?: number; next_item?: string }) | undefined
        const pct = g?.stage_total ? Math.round(((g.stage_done ?? 0) / g.stage_total) * 100) : null
        return (
          <Link key={p.project_id} to={`/projecten/${encodeURIComponent(p.project_code)}`} className="vd-proj">
            <span className="vd-ptop"><span className="vd-code">{p.project_code}</span><b>{p.client_name ?? p.title}</b><span className="vd-phase">{p.phase_label}</span></span>
            <span className="vd-s">{[p.title, p.site_city, p.cost_total != null ? `raming ${fmtEur(p.cost_total)}` : null].filter(Boolean).join(' · ')}</span>
            {pct != null && <span className="vd-prog" role="img" aria-label={`${g?.stage_done} van ${g?.stage_total} punten in deze fase`}><i style={{ width: `${pct}%` }} /></span>}
            {g?.next_item && <span className="vd-s">Volgende stap: {g.next_item}</span>}
          </Link>
        )
      })}
    </section>
  )
}
