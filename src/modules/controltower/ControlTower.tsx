import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { HoursQuickAdd } from '../../core/Hours'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { ProposalCard } from '../von/VonPage'
import { useProjects, type ProjectProgress, type ProjectRow } from '../../core/projects'

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
  taken: 'M9 11l3 3 8-8M20 12v6.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H15',
  agenda: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
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

type OpenTask = { id: string; text: string; project_code: string | null; due_date: string | null }
const LATER = 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'
const CHECK = 'M5 12.5l4.5 4.5L19 7.5'
const SmallIco = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
/** korte datum voor de tweede regel: "te laat", "vandaag", "morgen", "vr 13/11" */
const dueShort = (d: string | null) => {
  const x = dueText(d)
  if (!x) return null
  return { text: x.text.startsWith('te laat') ? 'te laat' : x.text.replace(/^tegen /, ''), cls: x.cls }
}

/**
 * Vandaag v5 (7 nov 2026, keuze van Olivier: "C · tegels per onderwerp"). Weinig tekst: één tegel per onderwerp met enkel een getal
 * (rood = er moet vandaag iets), klik op een tegel = de korte lijst van dat onderwerp, één regel per punt met één knop.
 * VON-voorstellen: één gouden regel bovenaan. Systemen enkel als er iets mis is. Rechts de agenda en de lopende projecten (op de gsm eronder).
 * "Wat de agents deden" en "Mag … voortaan zelf?" staan sinds v5 op de VON-pagina; lopende projecten onder Projecten.
 * Bron: RPC today_items (app_today), today_categories, ct_snooze, tasks (taken buiten de app).
 */
export function ControlTower() {
  const flags = useQuery<Flag[]>(async () => { const { data, error } = await supabase.rpc('today_items'); return { data: (data ?? []) as Flag[], error } }, [])
  const cats = useQuery<Cat[]>(() => supabase.from('today_categories').select('*').order('sort'), [])
  const projects = useProjects()
  const active = (projects.data ?? []).filter((p) => p.phase_active !== false)
  const tasks = useQuery<OpenTask[]>(() => supabase.from('tasks').select('id,text,project_code,due_date').is('done_at', null).eq('kind', 'buiten')
    .order('due_date', { ascending: true, nullsFirst: false }).limit(50), [])
  const [params, setParams] = useSearchParams()
  const [hours, setHours] = useState<{ job: string | null } | null>(null)
  useEffect(() => { const j = params.get('uren'); if (j) { setHours({ job: j }); setParams((p) => { p.delete('uren'); return p }, { replace: true }) } }, [params, setParams])
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
  const von = work.filter((f) => f.kind === 'von_voorstel' && !!f.ref)
  const openTasks = (tasks.data ?? []).filter((t) => !gone.has('taak-buiten:' + t.id))
  const today = isoToday()

  // tegels: één per onderwerp (+ Taken, + Agenda enkel op de gsm); getal = te doen (prio 1 en 2), rood = vandaag of te laat
  type Tile = { key: string; label: string; icon: string; n: number; urgent: number }
  const tiles: Tile[] = useMemo(() => [
    ...(cats.data ?? []).filter((c) => c.key !== 'systeem').map((c) => {
      const mine = work.filter((f) => f.category === c.key && f.prio < 3)
      return { key: c.key, label: c.label.split(' ')[0], icon: c.key, n: mine.length, urgent: mine.filter((f) => f.prio === 1).length }
    }),
    { key: 'taken', label: 'Taken', icon: 'taken', n: openTasks.length, urgent: openTasks.filter((t) => t.due_date && t.due_date <= today).length },
  ], [cats.data, work, openTasks, today])
  const firstBusy = tiles.find((t) => t.urgent > 0) ?? tiles.find((t) => t.n > 0) ?? tiles[0]
  const sel = params.get('v') ?? firstBusy?.key ?? 'klanten'
  const pick = (key: string) => { setOpen(null); setParams((p) => { p.set('v', key); return p }, { replace: true }) }
  const selLabel = sel === 'von' ? 'Voorstellen van VON' : tiles.find((t) => t.key === sel)?.label ?? ''

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
  const hide = (key: string, text: string, undo?: () => PromiseLike<unknown>) => {
    setGone((s) => new Set(s).add(key))
    toast.show(text, undo ? async () => { await undo(); setGone((s) => { const n = new Set(s); n.delete(key); return n }) } : undefined)
  }
  const dismissMail = async (f: Flag) => {
    await supabase.from('mail_messages').update({ dismissed_at: new Date().toISOString() }).eq('id', f.ref!)
    hide(keyOf(f), 'Geen antwoord nodig', () => supabase.from('mail_messages').update({ dismissed_at: null }).eq('id', f.ref!))
  }
  const taskDone = async (f: Flag) => {
    await supabase.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', f.ref!)
    hide(keyOf(f), 'Afgevinkt', () => supabase.from('tasks').update({ done_at: null }).eq('id', f.ref!))
  }
  const ownTaskDone = async (t: OpenTask) => {
    await supabase.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', t.id)
    hide('taak-buiten:' + t.id, 'Afgevinkt', () => supabase.from('tasks').update({ done_at: null }).eq('id', t.id))
  }
  // "Geleverd? <leverancier>": verwachte datum voorbij, nog niet aangeduid → met één klik geleverd (met ongedaan maken)
  const markDelivered = async (f: Flag) => {
    const { data: before } = await supabase.from('orders').select('status,delivered_at').eq('id', f.ref!).single()
    const { error } = await supabase.from('orders').update({ status: 'geleverd', delivered_at: today }).eq('id', f.ref!)
    if (error) { toast.show('Niet bewaard: ' + error.message); return }
    hide(keyOf(f), 'Aangeduid als geleverd', () => supabase.from('orders').update({ status: before?.status ?? 'bevestigd', delivered_at: before?.delivered_at ?? null }).eq('id', f.ref!))
  }
  const proposalDone = (f: Flag) => { setGone((s) => new Set(s).add(keyOf(f))); setOpen(null); toast.show('Voorstel afgehandeld'); flags.reload() }

  const list = sel === 'von' ? von : work.filter((f) => f.category === sel).sort((a, b) => a.prio - b.prio)

  /** Eén regel in kolommen: Wat · Voor wie · Waarom (bron, datum) · knop. Lange taken: tekst vóór ":" = wat, erna = waarom. */
  const Row = ({ f }: { f: Flag }) => {
    const k = keyOf(f), act = actionFor(f), isVon = f.kind === 'von_voorstel' && !!f.ref, isOpen = isVon && open === k
    const due = dueShort(f.due_date)
    let what = isVon ? (f.proposal_title ?? cleanTitle(f)) : cleanTitle(f)
    let why = isVon ? (f.reason ?? f.proposal_summary ?? f.detail ?? '') : (f.detail ?? f.due_reason ?? '')
    if (!why && f.kind === 'taak' && what.includes(': ')) { const i = what.indexOf(': '); why = what.slice(i + 2); what = what.slice(0, i) }
    const delivered = f.kind === 'bestelling' && !!f.ref && f.title.startsWith('Geleverd?')
    return (
      <div className={'vd5-item' + (f.prio === 3 ? ' info' : '')}>
        <div className="vd5-row">
          <span className={'vd5-dot' + (f.prio === 1 ? ' now' : isVon ? ' von' : '')} aria-hidden="true" />
          {isVon || act.to.startsWith('http')
            ? <span className="vd5-what" title={what}>{what}</span>
            : <Link to={act.to} className="vd5-what" title={what}>{what}</Link>}
          <span className="vd5-who">{f.client_name ?? f.project_code ?? ''}{isVon && <span className="vd5-tag">VON</span>}</span>
          <span className="vd5-why" title={why}>{due && <b className={due.cls}>{due.text}</b>}{due && why ? ' · ' : ''}{why}</span>
          <span className="vd5-acts">
            {isVon ? (
              <button className={'vd5-btn' + (f.prio === 1 ? ' gold' : '')} onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>{isOpen ? 'Sluiten' : 'Bekijken'}</button>
            ) : delivered ? (
              <button className="vd5-btn" onClick={() => markDelivered(f)}>Geleverd</button>
            ) : act.to.startsWith('http') ? (
              <a href={act.to} target="_blank" rel="noreferrer" className="vd5-btn nav" aria-label={act.label}><span className="t">{act.label}</span></a>
            ) : (
              <Link to={act.to} className={'vd5-btn nav' + (f.prio === 1 ? ' gold' : '')} aria-label={act.label}><span className="t">{act.label}</span></Link>
            )}
            {f.kind === 'mail_antwoord' && f.ref && <button className="vd5-ico-btn" onClick={() => dismissMail(f)} aria-label="Geen antwoord nodig" title="Geen antwoord nodig"><SmallIco d={CHECK} /></button>}
            {f.kind === 'taak' && f.ref && <button className="vd5-ico-btn" onClick={() => taskDone(f)} aria-label="Klaar" title="Klaar"><SmallIco d={CHECK} /></button>}
            {!isVon && <button className="vd5-ico-btn" onClick={() => later(f)} aria-label="Morgen weer tonen" title="Morgen weer tonen"><SmallIco d={LATER} /></button>}
          </span>
        </div>
        {isOpen && <InlineProposal id={f.ref!} onDone={() => proposalDone(f)} />}
      </div>
    )
  }
  const Cols = () => <div className="vd5-cols" aria-hidden="true"><span /><span>Wat</span><span>Voor wie</span><span>Waarom</span><span /></div>

  const loading = !flags.data || !cats.data
  return (
    <section className="vd5">
      <header className="vd5-head">
        <h1>Vandaag</h1>
      </header>
      {hours && <HoursQuickAdd jobId={hours.job} onClose={() => setHours(null)} onSaved={() => flags.reload()} />}
      <ErrorBox error={flags.error ?? cats.error} />
      {sys.length > 0 && (
        <div className="vd5-sys" role="alert">
          <span className="vd5-dot now" aria-hidden="true" />
          <span>{sys.map((f) => { const a = actionFor(f); return a.to.startsWith('http')
            ? <a key={keyOf(f)} href={a.to} target="_blank" rel="noreferrer">{f.title}</a>
            : <Link key={keyOf(f)} to={a.to}>{f.title}</Link> })}</span>
        </div>
      )}
      {loading ? (flags.error || cats.error ? null : <Loading />) : (
        <div className="vd5-grid">
          <div className="vd5-main">
            {von.length > 0 && (
              <button className={'vd5-von' + (sel === 'von' ? ' on' : '')} onClick={() => pick('von')}>
                <span className="vd-vdot" aria-hidden="true">V</span>
                <span><b>{von.length} {von.length === 1 ? 'voorstel' : 'voorstellen'} van VON</b> {von.length === 1 ? 'wacht' : 'wachten'} op jou</span>
                <span className="vd5-von-go">Bekijken ›</span>
              </button>
            )}
            <div className="vd5-tiles" role="group" aria-label="Onderwerpen">
              {tiles.map((t) => (
                <button key={t.key} className={'vd5-tile' + (sel === t.key ? ' on' : '') + (t.n ? '' : ' empty')}
                  aria-pressed={sel === t.key} onClick={() => pick(t.key)}>
                  <span className="vd5-tile-top">
                    <span className={'vd5-tico c-' + t.icon}><Ico name={t.icon} /></span>
                    {t.urgent > 0 && <span className="vd5-urgent">{t.urgent} nu</span>}
                  </span>
                  <span className="vd5-n">{t.n}</span>
                  <span className="vd5-l">{t.label}</span>
                </button>
              ))}
            </div>
            <section className="vd5-list" aria-label={selLabel}>
              <h2>{selLabel}</h2>
              {sel === 'taken' ? (
                <>
                  {openTasks.length === 0 ? <p className="vd5-empty">Geen open taken.</p> : <Cols />}
                  {openTasks.map((t) => {
                    const due = dueShort(t.due_date)
                    return (
                      <div key={t.id} className="vd5-item"><div className="vd5-row">
                        <span className={'vd5-dot' + (t.due_date && t.due_date <= today ? ' now' : '')} aria-hidden="true" />
                        <span className="vd5-what" title={t.text}>{t.text}</span>
                        <span className="vd5-who">{t.project_code ?? ''}</span>
                        <span className="vd5-why">{due && <b className={due.cls}>{due.text}</b>}</span>
                        <span className="vd5-acts"><button className="vd5-ico-btn" onClick={() => ownTaskDone(t)} aria-label="Klaar" title="Klaar"><SmallIco d={CHECK} /></button></span>
                      </div></div>
                    )
                  })}
                  <Link to="/taken" className="vd5-more">Alle taken · nieuwe taak ›</Link>
                </>
              ) : list.length === 0 ? <p className="vd5-empty">Niets te doen bij {selLabel.toLowerCase()}.</p> : <><Cols />{list.map((f) => <Row key={keyOf(f)} f={f} />)}</>}
            </section>
          </div>
          <aside className="vd5-side"><YourDay /><ActiveProjects projects={active} /></aside>
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

/** Je dag: afspraken (Outlook/Bookings) en opdrachten, vandaag en morgen, als tijdlijn. */
function YourDay() {
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
  const groups = [0, 1].map((n) => {
    const d = new Date(today.getTime() + n * 86400000)
    return { label: n === 0 ? 'Vandaag' : 'Morgen', list: (items ?? []).filter((i) => new Date(i.start) < new Date(d.getTime() + 86400000) && new Date(i.end) > d) }
  })
  return (
    <section className="panel vd-panel">
      <div className="vd-h"><h2>Agenda</h2><Link to="/agenda" className="vd-more">Week</Link></div>
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
      </div>
    </section>
  )
}

/** Lopende projecten (rechts onder de agenda, op vraag van Olivier 7/11): naam, fase en voortgang in de fase. */
function ActiveProjects({ projects }: { projects: ProjectRow[] }) {
  const [prog, setProg] = useState<Record<string, ProjectProgress>>({})
  useEffect(() => { supabase.from('app_project_progress').select('*').then(({ data }) => setProg(Object.fromEntries(((data ?? []) as ProjectProgress[]).map((r) => [r.project_code, r])))) }, [])
  const list = useMemo(() => [...projects].sort((a, b) => (b.last_activity ?? '').localeCompare(a.last_activity ?? '')).slice(0, 6), [projects])
  return (
    <section className="panel vd-panel vd5-projects">
      <div className="vd-h"><h2>Lopende projecten</h2><Link to="/projecten" className="vd-more">Alle</Link></div>
      {list.length === 0 ? <p className="muted small vd-pad">Geen lopende projecten.</p> : list.map((p) => {
        const g = prog[p.project_code] as (ProjectProgress & { stage_done?: number; stage_total?: number }) | undefined
        const pct = g?.stage_total ? Math.round(((g.stage_done ?? 0) / g.stage_total) * 100) : null
        return (
          <Link key={p.project_id} to={`/projecten/${encodeURIComponent(p.project_code)}`} className="vd5-proj">
            <span className="vd5-proj-top"><b>{p.client_name ?? p.title ?? p.project_code}</b><span className="vd-phase">{p.phase_label}</span></span>
            {pct != null && <span className="vd-prog" role="img" aria-label={`${g?.stage_done} van ${g?.stage_total} stappen in deze fase`}><i style={{ width: `${pct}%` }} /></span>}
          </Link>
        )
      })}
    </section>
  )
}
