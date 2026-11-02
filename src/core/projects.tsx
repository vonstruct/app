import { Link } from 'react-router'
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
}

export type Phase = { phase: string; sort: number; label: string; active: boolean; idle_days: number | null }

export const useProjects = () =>
  useQuery<ProjectRow[]>(() => supabase.from('app_projects').select('*').order('last_activity', { ascending: false }), [])
export const usePhases = () => useQuery<Phase[]>(() => supabase.from('project_phases').select('*').order('sort'), [])

/** Hoofdstappen die we als voortgangsbalk tonen. */
const STEPS = ['measuring', 'design', 'quote', 'signed', 'ordering', 'production', 'installation', 'handover']

export function PhaseSteps({ phase, phases }: { phase: string; phases: Phase[] }) {
  const cur = phases.find((p) => p.phase === phase)
  const steps = STEPS.map((s) => phases.find((p) => p.phase === s)).filter(Boolean) as Phase[]
  // huidige stap = de laatste hoofdstap die niet later ligt dan de huidige fase
  const nowStep = cur?.active ? [...steps].reverse().find((s) => s.sort <= cur.sort) : undefined
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s.phase} className={!nowStep ? '' : s.sort < nowStep.sort ? 'done' : s.phase === nowStep.phase ? 'now' : ''} title={s.label}>
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

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
        if (error) alert('Fase niet bewaard: ' + error.message)
        onSaved()
      }}
    >
      {phases.map((ph) => (
        <option key={ph.phase} value={ph.phase}>
          {ph.label}
        </option>
      ))}
    </select>
  )
}

export function ProjectCard({ p, phases, onSaved }: { p: ProjectRow; phases: Phase[]; onSaved: () => void }) {
  const href = `/projecten/${encodeURIComponent(p.project_code)}`
  return (
    <article className={'pcard' + (p.phase_active === false ? ' inactive' : '')}>
      <header className="pcard-head">
        <div>
          <Link to={href} className="pcard-code">
            {p.project_code}
          </Link>
          <h3>
            <Link to={href}>{p.title || p.scene_title || 'Zonder titel'}</Link>
          </h3>
          <p className="muted">
            {p.client_name}
            {p.site_city ? ` · ${p.site_city}` : ''}
          </p>
        </div>
        <PhaseSelect p={p} phases={phases} onSaved={onSaved} />
      </header>
      <PhaseSteps phase={p.phase} phases={phases} />
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
        {p.target_install_week && (
          <div>
            <dt>Plaatsing</dt>
            <dd>week {p.target_install_week}</dd>
          </div>
        )}
      </dl>
      <StatusChips p={p} />
    </article>
  )
}
