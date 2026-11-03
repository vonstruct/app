import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur, fmtInt } from '../../core/format'
import { gatesOf, relDays, usePhases, useProjects, type Phase, type ProjectRow } from '../../core/projects'

type Flag = { prio: 1 | 2 | 3; kind: string; project_code: string | null; last_version: number | null; ref: string | null; title: string; detail: string | null; since: string | null }
type Supplier = { supplier_name: string; n_articles: number; last_update: string; days_old: number }
type Mail = { email_id: string; status: string; updated_at: string }
type DayItem = { id: string; start: string; end: string; title: string; sub?: string; to: string; kind: 'afspraak' | 'opdracht'; ok?: boolean; allDay?: boolean }

/** Thema's: elk aandachtspunt (kind) hoort bij één thema. Nieuw kind = één regel hier. */
const THEMES = [
  { id: 'klant', label: 'Aanvragen & klanten', icon: '👤', kinds: ['aanvraag_nieuw', 'survey_nieuw', 'survey_open', 'klant_email', 'stilstand'] },
  { id: 'planning', label: 'Planning', icon: '📅', kinds: ['opdracht'] },
  { id: 'ontwerp', label: 'Ontwerp & kosten', icon: '📐', kinds: ['prijzen', 'kosten', 'optimalisatie', 'stuklijst_fout', 'stuklijst_opm'] },
  { id: 'systeem', label: 'Mails & systeem', icon: '⚙️', kinds: ['mail', 'backup', 'sleutel', 'leverancier', 'partner_email'] },
] as const
type ThemeId = (typeof THEMES)[number]['id']
const themeOf = (kind: string): ThemeId => (THEMES.find((t) => (t.kinds as readonly string[]).includes(kind))?.id ?? 'systeem')
const PRIO = { 1: 'Nu doen', 2: 'Binnenkort', 3: 'Ter info' } as const

/** Waar je het punt oplost, en wat er op de knop staat. */
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
    case 'mail': return { to: '/mails', label: 'Mails bekijken' }
    case 'backup': return { to: 'https://github.com/vonstruct/platform/actions/workflows/backup-onedrive.yml', label: 'Back-up bekijken' }
    default: return { to: proj, label: 'Openen' }
  }
}

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const hm = (iso: string) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })

export function ControlTower() {
  const flags = useQuery<Flag[]>(() => supabase.from('app_control_tower').select('*').order('prio').order('since', { ascending: false }), [])
  const projects = useProjects()
  const phases = usePhases()
  const sup = useQuery<Supplier[]>(() => supabase.from('app_supplier_freshness').select('*').order('supplier_name'), [])
  const mails = useQuery<Mail[]>(() => supabase.from('mail_events').select('email_id,status,updated_at').gt('updated_at', new Date(Date.now() - 7 * 86400000).toISOString()), [])
  const [theme, setTheme] = useState<ThemeId | 'alles'>('alles')
  const [prioOnly, setPrioOnly] = useState<1 | 2 | null>(null)
  const loading = flags.loading || projects.loading || phases.loading
  const ps = projects.data ?? []
  const active = ps.filter((p) => p.phase_active !== false)
  const fl = flags.data ?? []
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'
  const n1 = fl.filter((f) => f.prio === 1).length, n2 = fl.filter((f) => f.prio === 2).length
  const leads = fl.filter((f) => f.kind === 'aanvraag_nieuw').length
  const toConfirm = fl.filter((f) => f.kind === 'opdracht').length
  const shown = fl.filter((f) => (theme === 'alles' || themeOf(f.kind) === theme) && (!prioOnly || f.prio === prioOnly))
  const mailProblems = (mails.data ?? []).filter((m) => ['bounced', 'complained', 'failed'].includes(m.status)).length

  return (
    <section className="ct ct2">
      <div className="page-head">
        <div>
          <h1>{greet}, Olivier</h1>
          <p className="muted">
            {new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{n1 === 0 ? 'niets dringends' : `${n1} ${n1 === 1 ? 'punt' : 'punten'} om nu te doen`}
          </p>
        </div>
      </div>
      <ErrorBox error={flags.error ?? projects.error ?? phases.error ?? sup.error} />
      {loading ? <Loading /> : (
        <>
          <div className="ct-tiles">
            <Tile label="Nu doen" value={n1} tone={n1 ? 'bad' : 'ok'} on={prioOnly === 1} onClick={() => { setPrioOnly(prioOnly === 1 ? null : 1); setTheme('alles') }} />
            <Tile label="Binnenkort" value={n2} tone={n2 ? 'warn' : 'ok'} on={prioOnly === 2} onClick={() => { setPrioOnly(prioOnly === 2 ? null : 2); setTheme('alles') }} />
            <Tile label="Nieuwe aanvragen" value={leads} tone={leads ? 'new' : undefined} on={theme === 'klant' && !prioOnly} onClick={() => { setTheme(theme === 'klant' ? 'alles' : 'klant'); setPrioOnly(null) }} />
            <Tile label="Opdrachten te bevestigen" value={toConfirm} tone={toConfirm ? 'warn' : undefined} on={theme === 'planning' && !prioOnly} onClick={() => { setTheme(theme === 'planning' ? 'alles' : 'planning'); setPrioOnly(null) }} />
            <Tile label="Lopende projecten" value={active.length} to="/projecten" />
          </div>

          <div className="ct-grid">
            <div className="panel ct-todo">
              <div className="ct-todo-head">
                <h2>Wat moet ik doen?</h2>
                <div className="ct-chips">
                  <button className={theme === 'alles' ? 'on' : ''} onClick={() => setTheme('alles')}>Alles <span>{fl.length}</span></button>
                  {THEMES.map((t) => {
                    const n = fl.filter((f) => themeOf(f.kind) === t.id).length
                    return <button key={t.id} className={theme === t.id ? 'on' : ''} onClick={() => setTheme(t.id)} disabled={!n}>{t.icon} {t.label} {n ? <span>{n}</span> : null}</button>
                  })}
                </div>
                {prioOnly && <p className="muted small">Enkel "{PRIO[prioOnly]}" · <button className="link" onClick={() => setPrioOnly(null)}>alles tonen</button></p>}
              </div>
              {shown.length === 0 ? (
                <div className="ct-empty">✓ Niets te doen{theme !== 'alles' ? ' in dit thema' : ''}. Goed bezig!</div>
              ) : (
                ([1, 2, 3] as const).map((prio) => {
                  const list = shown.filter((f) => f.prio === prio)
                  if (!list.length) return null
                  const body = (
                    <ul className="ct-list">
                      {list.map((f, i) => {
                        const act = actionFor(f)
                        const th = THEMES.find((t) => t.id === themeOf(f.kind))!
                        return (
                          <li key={i} className={'ct-item p' + f.prio}>
                            <span className="ct-ico" title={th.label}>{th.icon}</span>
                            <span className="ct-main">
                              <strong>{f.title}</strong>
                              <span className="muted small">
                                {f.project_code && <Link to={`/projecten/${encodeURIComponent(f.project_code)}`} className="ct-proj">{f.project_code}</Link>}
                                {f.detail}
                              </span>
                            </span>
                            <span className="ct-side">
                              {act.to.startsWith('http') ? <a href={act.to} target="_blank" rel="noreferrer" className="ct-btn">{act.label} ↗</a> : <Link to={act.to} className="ct-btn">{act.label} →</Link>}
                              <span className="muted small">{relDays(f.since)}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )
                  return prio === 3 ? (
                    <details key={prio} className="ct-group">
                      <summary><span className={'ct-prio p3'}>{PRIO[prio]}</span> <span className="muted small">{list.length} · klik om te tonen</span></summary>
                      {body}
                    </details>
                  ) : (
                    <div key={prio} className="ct-group">
                      <h3><span className={'ct-prio p' + prio}>{PRIO[prio]}</span> <span className="muted small">{list.length}</span></h3>
                      {body}
                    </div>
                  )
                })
              )}
            </div>

            <div className="ct-aside">
              <Today projects={ps} />
              <div className="panel">
                <div className="ct-panel-head"><h2>Mails (7 dagen)</h2><Link to="/mails" className="small">Alles →</Link></div>
                {(mails.data ?? []).length === 0 ? (
                  <p className="muted small">Nog geen gegevens van Resend. Zodra de koppeling actief is, zie je hier of je mails aankomen.</p>
                ) : (
                  <div className="ct-mailstats">
                    <span><b>{(mails.data ?? []).length}</b> verstuurd</span>
                    <span className="ok-t"><b>{(mails.data ?? []).filter((m) => m.status === 'delivered').length}</b> aangekomen</span>
                    <span className={(mails.data ?? []).some((m) => m.status === 'delayed') ? 'wait-t' : 'muted'}><b>{(mails.data ?? []).filter((m) => m.status === 'delayed').length}</b> vertraagd</span>
                    <span className={mailProblems ? 'bad-t' : 'muted'}><b>{mailProblems}</b> probleem</span>
                  </div>
                )}
              </div>
              <RecentUploads projects={ps} />
              <details className="panel ct-sup">
                <summary><h2>Leveranciersprijzen</h2><span className="muted small">{(sup.data ?? []).some((s) => s.days_old > 35) ? '⚠ verouderd' : 'actueel'}</span></summary>
                <ul className="mini">
                  {(sup.data ?? []).map((s) => (
                    <li key={s.supplier_name}>
                      <span>{s.supplier_name}</span>
                      <span className="muted">{fmtInt(s.n_articles)} art.</span>
                      <span className={'right ' + (s.days_old > 35 ? 'warn-text' : 'muted')}>{relDays(s.last_update)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          <h2 className="ct-h">Pijplijn</h2>
          <Pipeline projects={active} gates={gatesOf(phases.data ?? [])} />
        </>
      )}
    </section>
  )
}

function Tile({ label, value, tone, on, onClick, to }: { label: string; value: number; tone?: 'ok' | 'warn' | 'bad' | 'new'; on?: boolean; onClick?: () => void; to?: string }) {
  const inner = (<><div className="kpi-value">{fmtInt(value)}</div><div className="kpi-label">{label}</div></>)
  const cls = 'kpi ct-tile' + (tone ? ' ' + tone : '') + (on ? ' on' : '')
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button className={cls} onClick={onClick}>{inner}</button>
}

/** Vandaag en morgen: afspraken (Outlook/Bookings) en opdrachten. */
function Today({ projects }: { projects: ProjectRow[] }) {
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
      const out: DayItem[] = [
        ...evs.map((e) => ({ id: e.id, start: e.start, end: e.end, title: e.title, sub: e.location ?? e.customer?.name ?? undefined, kind: 'afspraak' as const, allDay: e.all_day, to: `/agenda?d=${e.start.slice(0, 10)}&e=${encodeURIComponent(e.id)}` })),
        ...jobs.map((j) => ({ id: 'j' + j.id, start: j.start_at, end: j.end_at, title: j.title, sub: j.for_me ? 'Vonstruct' : j.subcontractors?.name ?? j.partners?.name, kind: 'opdracht' as const, ok: j.status !== 'gepland', allDay: j.slot === 'dag', to: `/opdrachten?focus=${j.id}` })),
      ]
      setItems(out.sort((a, b) => a.start.localeCompare(b.start)))
    })
  }, [])
  const today = startOfDay(new Date())
  const intros = projects.filter((p) => p.intro_at && new Date(p.intro_at) >= today && new Date(p.intro_at) < new Date(today.getTime() + 2 * 86400000))
  const groups = [0, 1].map((n) => {
    const d = new Date(today.getTime() + n * 86400000)
    return { label: n === 0 ? 'Vandaag' : 'Morgen', list: (items ?? []).filter((i) => new Date(i.start) < new Date(d.getTime() + 86400000) && new Date(i.end) > d) }
  })
  return (
    <div className="panel ct-today">
      <div className="ct-panel-head"><h2>Vandaag & morgen</h2><Link to="/agenda" className="small">Agenda →</Link></div>
      {items === null ? <p className="muted small">Laden…</p> : groups.map((g) => (
        <div key={g.label} className="ct-day">
          <h3>{g.label}</h3>
          {g.list.length === 0 ? <p className="muted small">Niets gepland.</p> : (
            <ul>
              {g.list.map((i) => (
                <li key={i.id + g.label}>
                  <Link to={i.to}>
                    <span className="ct-time">{i.allDay ? 'dag' : hm(i.start)}</span>
                    <span className="ct-what"><b>{i.title}</b>{i.sub && <span className="muted small"> · {i.sub}</span>}</span>
                    {i.kind === 'opdracht' && <span className={i.ok ? 'ok-t' : 'wait-t'}>{i.ok ? '✓' : '?'}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {intros.length > 0 && items !== null && !items.some((i) => i.title.toLowerCase().includes('kennismak')) && (
        <p className="muted small">Kennismaking: {intros.map((p) => p.client_name).join(', ')}</p>
      )}
    </div>
  )
}

function RecentUploads({ projects }: { projects: ProjectRow[] }) {
  const recent = useMemo(() => [...projects].filter((p) => p.last_received).sort((a, b) => (b.last_received ?? '').localeCompare(a.last_received ?? '')).slice(0, 4), [projects])
  return (
    <div className="panel">
      <h2>Laatste uploads</h2>
      {recent.length === 0 ? <p className="muted small">Nog geen uploads.</p> : (
        <ul className="mini">
          {recent.map((p) => (
            <li key={p.project_id}>
              <Link to={`/projecten/${encodeURIComponent(p.project_code)}/v/${p.last_version}`}>{p.project_code} v{p.last_version}</Link>
              <span className="muted">{p.client_name}</span>
              <span className="muted right">{relDays(p.last_received)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Pipeline({ projects, gates }: { projects: ProjectRow[]; gates: Phase[] }) {
  return (
    <div className="pipeline" style={{ gridTemplateColumns: `repeat(${gates.length}, minmax(170px, 1fr))` }}>
      {gates.map((g, i) => {
        const list = projects.filter((p) => (p.stage ?? p.phase) === g.phase)
        return (
          <div key={g.phase} className={'lane' + (list.length ? '' : ' empty')}>
            <div className="lane-head">
              <span><em>{i + 1}</em> {g.label}</span>
              <span className="lane-n">{list.length}</span>
            </div>
            {list.map((p) => (
              <Link key={p.project_id} to={`/projecten/${encodeURIComponent(p.project_code)}`} className="lane-card">
                <strong>{p.project_code}{p.phase === 'lead' && <span className="pcard-new">nieuw</span>}</strong>
                <span>{p.client_name}</span>
                {p.cost_total != null && <span className="muted">{fmtEur(p.cost_total)}</span>}
              </Link>
            ))}
            {g.gate && <p className="lane-gate">{g.gate}</p>}
          </div>
        )
      })}
    </div>
  )
}
