import { Tasks } from '../../core/Tasks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { relDays, useProjects, type ProjectProgress, type ProjectRow } from '../../core/projects'
import { ProposalCard } from '../von/VonPage'

/**
 * Vandaag (startpagina, sinds 3 nov 2026 v3): begroeting + één zin, één actielijst (Nu / Deze week / Ter info) met
 * één knop per punt, "Later" (ct_snooze) en ongedaan maken; VON-voorstellen openen in de lijst zelf.
 * Rechts: je dag, taken, lopende projecten, systemen in één regel. Bron: app_control_tower (+ mails, jobs, agenda).
 */
type Flag = { prio: 1 | 2 | 3; kind: string; project_code: string | null; last_version: number | null; ref: string | null; title: string; detail: string | null; since: string | null }
type DayItem = { id: string; start: string; end: string; title: string; sub?: string; to: string; kind: 'afspraak' | 'opdracht'; ok?: boolean; allDay?: boolean }
type InMail = { id: string; at: string; from_name: string | null; from_email: string | null; party_name: string | null; party_kind: string | null; subject: string | null; summary: string | null; snippet: string | null; project_code: string | null; category: string | null }

const SYSTEM_KINDS = ['mail', 'backup', 'sleutel', 'leverancier', 'partner_email', 'systeem']

/** Waar je het punt oplost, en wat er op de knop staat. Nieuwe soort = één case. */
const actionFor = (f: Flag): { to: string; label: string } => {
  const proj = f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}` : '/projecten'
  const ver = f.last_version ? `${proj}/v/${f.last_version}` : proj
  switch (f.kind) {
    case 'prijzen': return { to: `${ver}?tab=kosten&focus=prijzen`, label: 'Prijzen invullen' }
    case 'kosten': return { to: `${ver}?tab=kosten`, label: 'Kosten bekijken' }
    case 'optimalisatie': return { to: `${ver}?tab=platen`, label: 'Platen bekijken' }
    case 'stuklijst_fout': return { to: `${ver}?tab=controle`, label: 'Fouten bekijken' }
    case 'stuklijst_opm': return { to: `${ver}?tab=controle`, label: 'Nakijken' }
    case 'klant_email': return { to: `${proj}?focus=email`, label: 'E-mail invullen' }
    case 'partner_email': return { to: `/relaties?tab=partners&focus=${f.ref}:email`, label: 'E-mail invullen' }
    case 'stilstand': return { to: `${proj}?focus=fase`, label: 'Fase aanpassen' }
    case 'survey_nieuw': return { to: `${proj}?focus=survey`, label: 'Vragenlijst bekijken' }
    case 'survey_open': return { to: `${proj}?focus=survey`, label: 'Klant contacteren' }
    case 'leverancier': return { to: '/regels', label: 'Regels' }
    case 'aanvraag_nieuw': return { to: proj, label: 'Aanvraag openen' }
    case 'opdracht': return { to: `/opdrachten?focus=${f.ref}`, label: 'Opdracht openen' }
    case 'mail': return { to: '/mails?tab=app', label: 'Mails bekijken' }
    case 'mail_antwoord': return { to: `/inbox?focus=${f.ref}`, label: 'Antwoorden' }
    case 'von_voorstel': return { to: '/von', label: 'Bekijken' }
    case 'afspraak_hold': return { to: '/agenda', label: 'Annuleren of verzetten' }
    case 'oplevering': case 'werkpunt': case 'garantie': case 'review': return { to: f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}?tab=oplevering` : '/projecten', label: f.kind === 'werkpunt' ? 'Opvolgen' : f.kind === 'review' ? 'Review vragen' : 'Oplevering openen' }
    case 'nacalculatie': return { to: f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}?tab=nacalculatie` : '/projecten', label: 'Nacalculatie' }
    case 'capaciteit': return { to: '/capaciteit', label: 'Capaciteit bekijken' }
    case 'factuur': return { to: f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}?tab=facturen` : '/facturen', label: f.title.startsWith('Onbetaald') ? 'Opvolgen' : 'Factuur maken' }
    case 'aankoopfactuur': return { to: '/facturen?tab=aankoop', label: 'Bekijken' }
    case 'offerte': return { to: f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}?tab=offerte` : '/projecten', label: 'Offerte openen' }
    case 'bestelling': return { to: f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}?tab=bestellingen` : '/projecten', label: 'Bestelling bekijken' }
    case 'backup': return { to: 'https://github.com/vonstruct/platform/actions/workflows/backup-onedrive.yml', label: 'Back-up bekijken' }
    default: return { to: proj, label: 'Openen' }
  }
}

/** Kortere, leesbare titel zonder technische voorvoegsels. */
const cleanTitle = (f: Flag) => f.title.replace(/^VON stelt voor:\s*/, '').replace(/^Wacht op antwoord:\s*/, '')
const keyOf = (f: Flag) => `${f.kind}:${f.ref ?? f.project_code ?? f.title}`

const ICON: Record<string, string> = {
  von: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  mail: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3.5 6l8.5 7 8.5-7',
  euro: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  cal: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  draw: 'M4 20h16M6 16l9.5-9.5a2 2 0 0 1 3 3L9 19H6z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
}
const iconFor = (kind: string) =>
  kind === 'von_voorstel' ? 'von' : kind === 'mail_antwoord' ? 'mail' : ['prijzen', 'kosten'].includes(kind) ? 'euro'
  : ['aanvraag_nieuw', 'survey_nieuw', 'survey_open', 'klant_email', 'stilstand'].includes(kind) ? 'person'
  : kind === 'opdracht' || kind === 'afspraak_hold' ? 'cal' : ['optimalisatie', 'stuklijst_fout', 'stuklijst_opm'].includes(kind) ? 'draw' : 'gear'
const Ico = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[name]} /></svg>
)
const initials = (s: string | null) => (s ?? '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const hm = (iso: string) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })

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
  const flags = useQuery<Flag[]>(() => supabase.from('app_control_tower').select('*').order('prio').order('since', { ascending: false }), [])
  const projects = useProjects()
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const toast = useToast()

  const loadSnooze = useCallback(() => supabase.from('ct_snooze').select('key').gt('until', new Date().toISOString())
    .then(({ data }) => setSnoozed(new Set((data ?? []).map((r: { key: string }) => r.key)))), [])
  useEffect(() => { loadSnooze() }, [loadSnooze])

  const all = (flags.data ?? []).filter((f) => !snoozed.has(keyOf(f)) && !gone.has(keyOf(f)))
  const sys = all.filter((f) => SYSTEM_KINDS.includes(f.kind))
  const work = all.filter((f) => !SYSTEM_KINDS.includes(f.kind))
  const now = work.filter((f) => f.prio === 1), week = work.filter((f) => f.prio === 2), info = work.filter((f) => f.prio === 3)
  // eerste open VON-voorstel staat meteen open
  const firstVon = now.find((f) => f.kind === 'von_voorstel')
  const openKey = open ?? (firstVon ? keyOf(firstVon) : null)

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
  const dismissMail = async (f: Flag) => {
    const key = keyOf(f)
    await supabase.from('mail_messages').update({ dismissed_at: new Date().toISOString() }).eq('id', f.ref!)
    setGone((s) => new Set(s).add(key))
    toast.show('Geen antwoord nodig', async () => {
      await supabase.from('mail_messages').update({ dismissed_at: null }).eq('id', f.ref!)
      setGone((s) => { const n = new Set(s); n.delete(key); return n })
    })
  }
  const proposalDone = (f: Flag) => { setGone((s) => new Set(s).add(keyOf(f))); setOpen(null); toast.show('Voorstel afgehandeld'); flags.reload() }

  // één zin van VON
  const nVon = now.filter((f) => f.kind === 'von_voorstel').length + week.filter((f) => f.kind === 'von_voorstel').length
  const nMail = work.filter((f) => f.kind === 'mail_antwoord').length
  const parts: string[] = []
  if (nVon) parts.push(`er ${nVon === 1 ? 'wacht 1 voorstel' : `wachten ${nVon} voorstellen`} van VON op je goedkeuring`)
  if (nMail) parts.push(`${nMail} ${nMail === 1 ? 'mail wacht' : 'mails wachten'} op antwoord`)
  const rest = now.length + week.length - nVon - nMail
  if (rest) parts.push(`${rest} ${rest === 1 ? 'ander punt' : 'andere punten'} voor deze week`)
  const sentence = parts.length ? parts.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : 'Niets dringends. Een rustige dag.'

  const Row = ({ f }: { f: Flag }) => {
    const k = keyOf(f), act = actionFor(f), isVon = f.kind === 'von_voorstel' && !!f.ref, isOpen = isVon && openKey === k
    return (
      <div className={'vd-item' + (isOpen ? ' open' : '')}>
        <div className="vd-row">
          <span className={'vd-ico' + (isVon ? ' is-von' : '')}><Ico name={iconFor(f.kind)} /></span>
          <span className="vd-what">
            <span className="vd-t">{f.project_code && <Link to={`/projecten/${encodeURIComponent(f.project_code)}`} className="vd-code">{f.project_code}</Link>}{cleanTitle(f)}</span>
            {!isOpen && f.detail && <span className="vd-s">{f.detail}</span>}
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
          <span className="vd-pill now"><i /> <b>{now.length}</b> nu doen</span>
          <span className="vd-pill week"><i /> <b>{week.length}</b> deze week</span>
          <Link to="/projecten" className="vd-pill good"><i /> <b>{active.length}</b> lopend{active.length === 1 ? ' project' : 'e projecten'}</Link>
        </div>
      </header>
      <ErrorBox error={flags.error ?? projects.error} />
      {flags.loading || projects.loading ? <Loading /> : (
        <div className="vd-grid">
          <div className="vd-col">
            <section className="panel vd-panel">
              <div className="vd-h"><h2>Te doen</h2></div>
              {now.length + week.length === 0 ? (
                <div className="vd-empty"><b>Niets meer te doen</b>Alles is afgehandeld. Nieuwe punten verschijnen hier vanzelf.</div>
              ) : (
                <>
                  {now.length > 0 && <div className="vd-group"><div className="vd-glabel now"><i />Nu</div>{now.map((f) => <Row key={keyOf(f)} f={f} />)}</div>}
                  {week.length > 0 && <div className="vd-group"><div className="vd-glabel week"><i />Deze week</div>{week.map((f) => <Row key={keyOf(f)} f={f} />)}</div>}
                </>
              )}
              {info.length > 0 && (
                <details className="vd-info"><summary>Ter info · {info.length} {info.length === 1 ? 'punt' : 'punten'}</summary>{info.map((f) => <Row key={keyOf(f)} f={f} />)}</details>
              )}
            </section>
            <NewMail />
          </div>

          <aside className="vd-col">
            <YourDay projects={ps} />
            <div className="vd-tasks"><Tasks limit={6} /></div>
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

/** VON-voorstel in de lijst zelf: tekst lezen/aanpassen en goedkeuren. */
function InlineProposal({ id, onDone }: { id: string; onDone: () => void }) {
  const [p, setP] = useState<any>(null)
  useEffect(() => { supabase.from('von_proposals').select('*').eq('id', id).maybeSingle().then(({ data }) => setP(data)) }, [id])
  if (!p) return <div className="vd-draft muted small">Laden…</div>
  return <div className="vd-draft"><ProposalCard p={p} onDone={() => { supabase.from('von_proposals').select('status').eq('id', id).single().then(({ data }) => { if (data?.status !== 'voorstel') onDone() }) }} /></div>
}

/** Nieuwe mails van mensen (geen nieuwsbrieven), laatste 3 dagen. */
function NewMail() {
  const nav = useNavigate()
  const q = useQuery<InMail[]>(() => supabase.from('app_mail_messages').select('id,at,from_name,from_email,party_name,party_kind,subject,summary,snippet,project_code,category')
    .eq('direction', 'in').eq('is_bulk', false).gt('at', new Date(Date.now() - 3 * 864e5).toISOString()).order('at', { ascending: false }).limit(5), [])
  const list = q.data ?? []
  return (
    <section className="panel vd-panel">
      <div className="vd-h"><h2>Nieuw in je mailbox</h2><Link to="/inbox" className="vd-more">Inbox</Link></div>
      {q.loading ? <p className="muted small vd-pad">Laden…</p> : list.length === 0 ? <p className="muted small vd-pad">Geen nieuwe mails van de laatste dagen.</p> : list.map((m) => (
        <button key={m.id} className="vd-mail" onClick={() => nav(`/inbox?focus=${m.id}`)}>
          <span className="vd-av">{initials(m.party_name ?? m.from_name ?? m.from_email)}</span>
          <span className="vd-what">
            <span className="vd-t">{m.from_name ?? m.from_email}{m.party_name && m.party_name !== m.from_name && <span className="vd-sub"> · {m.party_name}</span>}</span>
            <span className="vd-s">{m.summary ?? m.subject ?? m.snippet}</span>
          </span>
          <span className="vd-side">
            {m.project_code ? <span className="vd-badge k">{m.project_code}</span> : m.category ? <span className="vd-badge">{m.category}</span> : null}
            <span className="vd-age">{relDays(m.at)}</span>
          </span>
        </button>
      ))}
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
