import { BrochurePanel } from '../brochure/BrochurePanel'
import { DocumentsPanel } from '../documenten/DocumentsPanel'
import { NacalcPanel } from '../nacalculatie/NacalcPanel'
import { HandoverPanel } from '../oplevering/HandoverPanel'
import { Invoices } from '../facturen/Invoices'
import { QuotePanel } from '../offerte/QuotePanel'
import { Orders } from '../bestellingen/Orders'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtDate, fmtInt } from '../../core/format'
import { Compare } from './Compare'
import { ProjectCard, usePhases, type ProjectRow } from '../../core/projects'
import { ClientPanel } from './ClientPanel'
import { SurveyPanel } from './SurveyPanel'
import { MailList } from '../../core/MailList'
import { LeadActions } from './LeadActions'
import { PlanningPanel } from './PlanningPanel'
import { ChecklistPanel } from './ChecklistPanel'
import { EventFeed } from '../../core/EventFeed'
import { Tasks } from '../../core/Tasks'
import { ProposalList } from '../von/VonPage'

export type Version = {
  id: string
  version: number
  received_at: string
  exported_at: string | null
  scene_title: string | null
  n_cabinets: number
  n_parts: number
  n_errors: number
  n_warnings: number
}

export function ProjectDetail() {
  const { code = '' } = useParams()
  const q = useQuery<Version[]>(
    () =>
      supabase
        .from('design_versions')
        .select('id, version, received_at, exported_at, scene_title, n_cabinets, n_parts, n_errors, n_warnings')
        .eq('project_code', code)
        .order('version', { ascending: false }),
    [code],
  )
  const pq = useQuery<ProjectRow[]>(() => supabase.from('app_projects').select('*').eq('project_code', code), [code])
  const ph = usePhases()
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  const tab = params.get('tab') ?? (focus === 'survey' ? 'vragenlijst' : focus === 'mails' ? 'mails' : 'overzicht')
  const setTab = (t: string) => setParams(t === 'overzicht' ? {} : { tab: t }, { replace: true })
  const project = pq.data?.[0]
  const versions = q.data ?? []
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const va = versions.find((v) => v.version === (a ?? versions[1]?.version))
  const vb = versions.find((v) => v.version === (b ?? versions[0]?.version))

  const wa = (project?.client_phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '32')
  const TABS: [string, string][] = [['overzicht', 'Overzicht'], ['planning', 'Planning'], ['mails', 'Mails'], ['ontwerp', `Ontwerp & kosten${versions.length ? ` (${versions.length})` : ''}`], ['documenten', 'Documenten'], ['brochure', 'Brochure'], ['vragenlijst', 'Vragenlijst'], ['offerte', 'Offerte'], ['bestellingen', 'Bestellingen'], ['facturen', 'Facturen'], ['oplevering', 'Oplevering'], ['nacalculatie', 'Nacalculatie'], ['tijdlijn', 'Tijdlijn']]
  let body: ReactNode = null
  if (project && ph.data) {
    if (tab === 'planning') body = <PlanningPanel project={project} />
    else if (tab === 'mails') body = <MailList project={code} title="Mails" limit={60} />
    else if (tab === 'brochure') body = <BrochurePanel project={code} />
    else if (tab === 'documenten') body = <DocumentsPanel project={code} />
    else if (tab === 'nacalculatie') body = <NacalcPanel project={code} />
    else if (tab === 'oplevering') body = <HandoverPanel project={code} />
    else if (tab === 'facturen') body = <Invoices project={code} />
    else if (tab === 'offerte') body = <QuotePanel project={code} />
    else if (tab === 'bestellingen') body = <Orders project={code} />
    else if (tab === 'vragenlijst') body = <SurveyPanel code={code} focus={focus === 'survey'} />
    else if (tab === 'tijdlijn') body = <EventFeed project={code} title="Tijdlijn" limit={40} />
    else if (tab === 'ontwerp') body = q.loading ? <Loading /> : (
      <>
        {versions.length === 0 ? <p className="muted">Nog geen ontwerp uit PaletteCAD. Gebruik projectcode <b>{code}</b> in het veld "Project" en klik op de knop Supabase.</p> : (
          <DataTable
            rows={versions}
            filter={false}
            rowKey={(r) => r.id}
            columns={[
              { key: 'version', label: 'Versie', render: (r) => <Link to={`/projecten/${encodeURIComponent(code)}/v/${r.version}`}>v{r.version}</Link> },
              { key: 'received_at', label: 'Ontvangen', render: (r) => fmtDate(r.received_at) },
              { key: 'scene_title', label: 'Tekening' },
              { key: 'n_parts', label: 'Onderdelen', align: 'right', render: (r) => fmtInt(r.n_parts) },
              { key: 'n_errors', label: 'Fouten', align: 'right' },
              { key: 'n_warnings', label: 'Aandachtspunten', align: 'right' },
            ]}
          />
        )}
        {versions.length > 1 && va && vb && (
          <>
            <h2>Vergelijken</h2>
            <div className="toolbar">
              <select value={va.version} onChange={(e) => setA(Number(e.target.value))}>{versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}</select>
              <span>met</span>
              <select value={vb.version} onChange={(e) => setB(Number(e.target.value))}>{versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}</select>
            </div>
            <Compare from={va} to={vb} />
          </>
        )}
      </>
    )
    else body = (
      <>
        <div className="pdetail-top">
          <div className={'pcard-wide' + (focus === 'fase' ? ' focus' : '')}>
            {focus === 'fase' && <p className="notice">Kies rechtsboven in de kaart de fase waarin het project nu zit.</p>}
            <ProjectCard p={project} phases={ph.data} onSaved={pq.reload} />
          </div>
          <ClientPanel project={project} focus={focus === 'fase' || focus === 'survey' ? null : focus} onSaved={pq.reload} />
        </div>
        <ProjectProposals code={code} />
        <IntakeCard code={code} />
        <LeadActions p={project} onDone={pq.reload} />
        <ChecklistPanel code={code} currentStage={project.stage} />
        <Tasks project={code} title="Taken" />
      </>
    )
  }

  return (
    <section className="pd">
      <p className="crumbs"><Link to="/projecten">Projecten</Link> / {code}</p>
      <header className="pd-head">
        <div className="pd-title">
          <h1><span className="pd-code">{code}</span>{project?.client_name ?? ''}</h1>
          {project && <p className="muted">{[project.title, project.site_city, project.phase_label].filter(Boolean).join(' · ')}</p>}
        </div>
        {project && (
          <div className="pd-quick">
            {project.client_email && <a className="pd-q" href={`mailto:${project.client_email}?subject=${encodeURIComponent(`Je project bij Vonstruct (${code})`)}`}>Mail</a>}
            {project.client_phone && <a className="pd-q" href={`tel:${project.client_phone}`}>Bel</a>}
            {project.client_phone && wa && <a className="pd-q" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            <button className="pd-q gold" onClick={() => setTab('planning')}>+ Opdracht of afspraak</button>
          </div>
        )}
      </header>
      <nav className="pd-tabs" aria-label="Onderdelen van het project">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <ErrorBox error={q.error ?? pq.error} />
      {pq.loading ? <Loading /> : !project ? <p className="muted">Project {code} niet gevonden.</p> : <div className="pd-body">{body}</div>}
    </section>
  )
}

/** Open VON-voorstellen voor dit project (enkel getoond als er zijn). */
function ProjectProposals({ code }: { code: string }) {
  return (
    <div className="pd-von">
      <ProposalList project={code} compact />
    </div>
  )
}

/** Samenvatting van de Intake-agent (nieuwe aanvraag of vragenlijst): wat de klant wil, wat ontbreekt, volgende stap. */
function IntakeCard({ code }: { code: string }) {
  const [x, setX] = useState<{ intake_summary: string | null; intake_missing: string | null; intake_next: string | null; intake_at: string | null } | null>(null)
  useEffect(() => { supabase.from('projects').select('intake_summary,intake_missing,intake_next,intake_at').eq('project_code', code).maybeSingle().then(({ data }) => setX(data as never)) }, [code])
  if (!x?.intake_summary) return null
  return (
    <section className="panel intake-card">
      <div className="intake-head"><b>Intake</b><span className="muted small">samengevat door VON · {x.intake_at ? new Date(x.intake_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : ''}</span></div>
      <p className="intake-sum">{x.intake_summary}</p>
      {x.intake_missing && <p className="small"><b>Ontbreekt:</b> {x.intake_missing}</p>}
      {x.intake_next && <p className="small"><b>Volgende stap:</b> {x.intake_next}</p>}
    </section>
  )
}
