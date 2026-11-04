import { Link } from 'react-router'
import { toast } from './toast'
import { supabase } from './supabase'
import { useQuery } from './useQuery'
import { fmtEur } from './format'

/** Rij uit de view app_projects (alles wordt in Supabase berekend). */
export type ProjectRow = {
  project_id: string
  project_code: string
  title: string | null
  phase: string
  phase_label: string | null
  phase_sort: number | null
  phase_active: boolean | null
  target_install_week: string | null
  install_start?: string | null
  install_end?: string | null
  site_street: string | null
  site_postal_code: string | null
  site_city: string | null
  client_id: string
  client_number: number | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  n_versions: number
  last_version: number | null
  last_received: string | null
  scene_title: string | null
  n_cabinets: number | null
  n_parts: number | null
  n_errors: number | null
  n_warnings: number | null
  optimizer_status: string | null
  cost_status: string | null
  optimizer_ok: boolean | null
  cost_ok: boolean | null
  cost_total: number | null
  n_missing_prices: number
  last_activity: string | null
  days_idle: number | null
  stage: string | null
  stage_label: string | null
  stage_sort: number | null
  stage_gate: string | null
  intro_at: string | null
  lead_source: string | null
  survey_status: string | null
}

export type Phase = { phase: string; sort: number; label: string; active: boolean; idle_days: number | null; stage: string | null; selectable: boolean; gate: string | null }

/** De stage gates van de pijplijn (actieve, kiesbare fases). */
export const gatesOf = (phases: Phase[]) => phases.filter((p) => p.selectable && p.active)

export const useProjects = () =>
  useQuery<ProjectRow[]>(() => supabase.from('app_projects').select('*').order('last_activity', { ascending: false }), [])
export const usePhases = () => useQuery<Phase[]>(() => supabase.from('project_phases').select('*').order('sort'), [])

export function PhaseSteps({ phase, phases }: { phase: string; phases: Phase[] }) {
  const cur = phases.find((p) => p.phase === phase)
  const stage = phases.find((p) => p.phase === (cur?.stage ?? phase))
  const gates = gatesOf(phases)
  return (
    <ol className="steps" style={{ gridTemplateColumns: `repeat(${gates.length}, 1fr)` }}>
      {gates.map((g) => (
        <li key={g.phase} className={!stage?.active ? '' : g.sort < stage.sort ? 'done' : g.phase === stage.phase ? 'now' : ''} title={g.gate ?? g.label}>
          <span>{g.label}</span>
        </li>
      ))}
    </ol>
  )
}

export const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export const relDays = (iso: string | null) => {
  if (!iso) return ''
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`
}

export function StatusChips({ p }: { p: ProjectRow }) {
  const chips: { cls: string; text: string; title?: string }[] = []
  if (p.last_version == null) chips.push({ cls: 'chip', text: 'Nog geen tekening' })
  else {
    if (p.optimizer_status == null) chips.push({ cls: 'chip warn', text: 'Optimalisatie bezig' })
    else if (!p.optimizer_ok) chips.push({ cls: 'chip bad', text: 'Optimalisatie mislukt', title: p.optimizer_status })
    if (p.cost_status == null) chips.push({ cls: 'chip warn', text: 'Kosten bezig' })
    else if (!p.cost_ok) chips.push({ cls: 'chip bad', text: 'Kosten mislukt', title: p.cost_status })
    if (p.n_errors) chips.push({ cls: 'chip bad', text: `${p.n_errors} fout${p.n_errors === 1 ? '' : 'en'}` })
    if (p.n_missing_prices) chips.push({ cls: 'chip warn', text: `${p.n_missing_prices} zonder prijs` })
    if (p.n_warnings) chips.push({ cls: 'chip', text: `${p.n_warnings} opmerking${p.n_warnings === 1 ? '' : 'en'}` })
    if (p.optimizer_ok && p.cost_ok && !p.n_errors && !p.n_missing_prices) chips.push({ cls: 'chip ok', text: 'Raming compleet' })
  }
  if (!p.client_email) chips.push({ cls: 'chip', text: 'Klant zonder e-mail', title: 'Nodig voor toegang tot het klantenportaal' })
  return (
    <div className="chips">
      {chips.map((c) => (
        <span key={c.text} className={c.cls} title={c.title}>
          {c.text}
        </span>
      ))}
    </div>
  )
}

/** Fase kiezen; bewaart meteen in Supabase. */
export function PhaseSelect({ p, phases, onSaved }: { p: ProjectRow; phases: Phase[]; onSaved: () => void }) {
  return (
    <select
      className="phase-select"
      value={p.phase}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const { error } = await supabase.from('projects').update({ phase: e.target.value }).eq('id', p.project_id)
        toast(error ? 'Fase niet bewaard: ' + error.message : 'Fase gewijzigd', error ? 'err' : 'ok')
        onSaved()
      }}
    >
      {phases.filter((ph) => ph.selectable || ph.phase === p.phase).map((ph) => (
        <option key={ph.phase} value={ph.phase}>
          {ph.label}
        </option>
      ))}
    </select>
  )
}

export type ProjectPlanning = { project_code: string; jobs_open: number; jobs_unconfirmed: number; jobs_changed: number; next_at: string | null; next_title: string | null }

export type ProjectProgress = { project_code: string; stage_total: number; stage_done: number; total: number; done: number; next_item: string | null }
export function ProjectCard({ p, phases, onSaved, planning, progress }: { p: ProjectRow; phases: Phase[]; onSaved: () => void; planning?: ProjectPlanning; progress?: ProjectProgress }) {
  const href = `/projecten/${encodeURIComponent(p.project_code)}`
  return (
    <article className={'pcard' + (p.phase_active === false ? ' inactive' : '')}>
      <header className="pcard-head">
        <div className="pcard-who">
          <span className="pcard-av" aria-hidden="true">{(p.client_name ?? p.title ?? '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'}</span>
          <div>
            <h3><Link to={href}>{p.client_name || p.title || p.scene_title || 'Zonder titel'}</Link></h3>
            <p className="muted">
              <Link to={href} className="pcard-code">{p.project_code}</Link>
              {[p.client_name ? p.title || p.scene_title : null, p.site_city].filter(Boolean).join(' · ')}
              {p.phase === 'lead' && <span className="pcard-new">Nieuwe aanvraag</span>}
            </p>
          </div>
        </div>
        <PhaseSelect p={p} phases={phases} onSaved={onSaved} />
      </header>
      <PhaseSteps phase={p.phase} phases={phases} />
      {progress && progress.stage_total > 0 && (
        <Link to={href} className="pcard-next">
          <span className="pcard-bar"><i style={{ width: `${Math.round((100 * progress.stage_done) / progress.stage_total)}%` }} /></span>
          <span className="small">{progress.stage_done}/{progress.stage_total}{progress.next_item ? <> · volgende: <b>{progress.next_item}</b></> : ' · fase rond ✓'}</span>
        </Link>
      )}
      {planning && planning.next_at && (
        <Link to={href} className={'pcard-plan' + (planning.jobs_unconfirmed ? ' warn' : '')}>
          <span><svg className="pcard-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3v4M15.5 3v4" /></svg>{new Date(planning.next_at).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })} · {planning.next_title}</span>
          {planning.jobs_unconfirmed > 0 && <span className="small">{planning.jobs_unconfirmed} te bevestigen{planning.jobs_changed ? ` · ${planning.jobs_changed} gewijzigd` : ''}</span>}
        </Link>
      )}
      <dl className="pcard-facts">
        <div>
          <dt>Raming materiaal</dt>
          <dd>{p.cost_total != null ? fmtEur(p.cost_total) : '—'}</dd>
        </div>
        <div>
          <dt>Laatste versie</dt>
          <dd>{p.last_version != null ? <Link to={`${href}/v/${p.last_version}`}>v{p.last_version}</Link> : '—'}</dd>
        </div>
        <div>
          <dt>Kasten</dt>
          <dd>{p.n_cabinets ?? '—'}</dd>
        </div>
        <div>
          <dt>Laatste activiteit</dt>
          <dd>{relDays(p.last_activity)}</dd>
        </div>
        {p.intro_at && p.stage === 'lead' && (
          <div>
            <dt>Kennismaking</dt>
            <dd>{fmtWhen(p.intro_at)}</dd>
          </div>
        )}
        {p.stage === 'lead' && (
          <div>
            <dt>Vragenlijst</dt>
            <dd>{p.survey_status === 'submitted' ? 'ingediend' : p.survey_status === 'open' ? 'bezig' : 'nog niet'}</dd>
          </div>
        )}
        {p.target_install_week && (
          <div>
            <dt>Plaatsing</dt>
            <dd>{installLabel(p)}</dd>
          </div>
        )}
      </dl>
      <StatusChips p={p} />
    </article>
  )
}

/** Plaatsing leesbaar: "vr 13 nov → ma 16 nov" (met datum) of "wk 46 · 9–15 nov" (enkel week). */
const shortD = (d: Date) => d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
export function installLabel(p: { target_install_week: string | null; install_start?: string | null; install_end?: string | null }) {
  if (p.install_start) {
    const a = new Date(p.install_start + 'T12:00'), b = p.install_end ? new Date(p.install_end + 'T12:00') : null
    return shortD(a) + (b && p.install_end !== p.install_start ? ' → ' + shortD(b) : '')
  }
  const m = p.target_install_week?.match(/^(\d{4})-W(\d{1,2})$/)
  if (!m) return p.target_install_week ? 'week ' + p.target_install_week : '—'
  const y = Number(m[1]), w = Number(m[2])
  const jan4 = new Date(y, 0, 4, 12); const mon = new Date(jan4); mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
  return `wk ${w} · ${mon.getMonth() === sun.getMonth() ? mon.getDate() : f(mon)}–${f(sun)}`
}
