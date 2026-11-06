import { YukiHistory } from '../../core/YukiHistory'
import { useTimeline } from './KeyDates'
import { Overview, PhaseBar } from './Overview'
import { BrochurePanel } from '../brochure/BrochurePanel'
import { DocumentsPanel } from '../documenten/DocumentsPanel'
import { NacalcPanel } from '../nacalculatie/NacalcPanel'
import { HandoverPanel } from '../oplevering/HandoverPanel'
import { Invoices } from '../facturen/Invoices'
import { QuotePanel } from '../offerte/QuotePanel'
import { ProjectCost } from './ProjectCost'
import { ProductionPanel } from './ProductionPanel'
import { Orders } from '../bestellingen/Orders'
import { MailDocs } from '../bestellingen/MailDocs'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtDate, fmtInt } from '../../core/format'
import { Compare } from './Compare'
import { usePhases, type ProjectRow } from '../../core/projects'
import { ClientPanel } from './ClientPanel'
import { SurveyPanel } from './SurveyPanel'
import { MailList } from '../../core/MailList'
import { LeadActions } from './LeadActions'
import { EventFeed } from '../../core/EventFeed'

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
  // tab Planning is opgegaan in het Overzicht (Olivier, 5 nov): oude links ?tab=planning tonen het Overzicht
  const tab = ((t) => (t === 'planning' ? 'overzicht' : t))(params.get('tab') ?? (focus === 'survey' ? 'vragenlijst' : focus === 'mails' ? 'mails' : 'overzicht'))
  const setTab = (t: string) => setParams(t === 'overzicht' ? {} : { tab: t }, { replace: true })
  // gsm: het gekozen tabblad in beeld schuiven (enkel de rij tabbladen, niet de pagina)
  const tabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const n = tabsRef.current, el = n?.querySelector<HTMLElement>('button.on')
    if (n && el) n.scrollLeft += el.getBoundingClientRect().left - n.getBoundingClientRect().left - (n.clientWidth - el.clientWidth) / 2
  }, [tab])
  const project = pq.data?.[0]
  const tl = useTimeline(code, pq.reload)
  // klantgegevens: klein blok onder de kop; opent vanzelf als je komt om een ontbrekend veld in te vullen (?focus=email …)
  const clientFocus = focus && !['fase', 'survey', 'mails'].includes(focus) ? focus : null
  const [showClient, setShowClient] = useState(false)
  const versions = q.data ?? []
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const va = versions.find((v) => v.version === (a ?? versions[1]?.version))
  const vb = versions.find((v) => v.version === (b ?? versions[0]?.version))

  const wa = (project?.client_phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '32')
  const TABS: [string, string][] = [['overzicht', 'Overzicht'], ['mails', 'Mails'], ['ontwerp', `Ontwerp & kosten${versions.length ? ` (${versions.length})` : ''}`], ['kost', 'Projectkost'], ['documenten', 'Documenten'], ['brochure', 'Brochure'], ['vragenlijst', 'Vragenlijst'], ['offerte', 'Offerte'], ['bestellingen', 'Bestellingen'], ['productie', 'Productie'], ['facturen', 'Facturen'], ['oplevering', 'Oplevering'], ['nacalculatie', 'Nacalculatie'], ['tijdlijn', 'Tijdlijn']]
  let body: ReactNode = null
  if (project && ph.data) {
    if (tab === 'mails') body = <MailList project={code} title="Mails" limit={60} />
    else if (tab === 'brochure') body = <BrochurePanel project={code} />
    else if (tab === 'documenten') body = <DocumentsPanel project={code} />
    else if (tab === 'nacalculatie') body = <NacalcPanel project={code} />
    else if (tab === 'oplevering') body = <HandoverPanel project={code} />
    else if (tab === 'facturen') body = <><Invoices project={code} /><div className="panel"><h2>In Yuki</h2><p className="muted small">Alle facturen en betalingen van deze klant in de boekhouding (ook van vóór de app), met de pdf.</p><YukiHistory clientId={project.client_id} /></div></>
    else if (tab === 'offerte') body = <QuotePanel project={code} />
    else if (tab === 'kost') body = <ProjectCost project={code} onQuote={() => setTab('offerte')} />
    else if (tab === 'productie') body = <ProductionPanel project={code} />
    else if (tab === 'bestellingen') body = <><Orders project={code} /><div className="panel"><h2>Uit de mailbox</h2><p className="muted small">Orderbevestigingen, facturen en leveringsbons van leveranciers die aan dit project gekoppeld zijn (bijlage gelezen). Na te kijken: Planning → Bestellingen → Uit je mailbox.</p><MailDocs project={code} /></div></>
    else if (tab === 'vragenlijst') body = <>{!['lead', 'intake', 'survey'].includes(project.phase) && <LeadActions p={project} onDone={pq.reload} />}<SurveyPanel code={code} focus={focus === 'survey'} /></>
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
        {['lead', 'intake', 'survey'].includes(project.phase) && <LeadActions p={project} onDone={pq.reload} />}
        {project.stage === 'lead' && <IntakeCard code={code} />}
        <Overview project={project} t={tl.t} gates={tl.gates} saveDates={tl.save} onTab={(t) => setTab(t)} onSaved={() => { pq.reload(); tl.load() }} />
      </>
    )
  }

  return (
    <section className="pd">
      <p className="crumbs"><Link to="/projecten">Projecten</Link> / {code}</p>
      <header className="pd-head">
        <div className="pd-title">
          <h1><span className="pd-code">{code}</span>{project?.client_name ?? ''}</h1>
          {project && <p className="muted">{[project.title, project.site_city].filter(Boolean).join(' · ')}</p>}
        </div>
        {project && (
          <div className="pd-quick">
            {project.client_email && <a className="pd-q" href={`mailto:${project.client_email}?subject=${encodeURIComponent(`Je project bij Vonstruct (${code})`)}`}>Mail</a>}
            {project.client_phone && <a className="pd-q" href={`tel:${project.client_phone}`}>Bel</a>}
            {project.client_phone && wa && <a className="pd-q" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            <button className={'pd-q' + (showClient || clientFocus ? ' on' : '')} onClick={() => setShowClient(!showClient)}>Klantgegevens</button>
            <button className="pd-q gold" onClick={() => setParams({ tab: 'overzicht', nieuw: 'opdracht' }, { replace: true })}>+ Opdracht</button>
            <button className="pd-q" onClick={() => setParams({ tab: 'overzicht', nieuw: 'afspraak' }, { replace: true })}>+ Afspraak</button>
          </div>
        )}
      </header>
      {project && (showClient || clientFocus) && <div className="pd-client"><ClientPanel project={project} focus={clientFocus} onSaved={pq.reload} /></div>}
      {project && ph.data && <PhaseBar project={project} gates={tl.gates} phases={ph.data} onSaved={() => { pq.reload(); tl.load() }} focus={focus === 'fase'} />}
      <nav className="pd-tabs" aria-label="Onderdelen van het project" ref={tabsRef}>
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <ErrorBox error={q.error ?? pq.error} />
      {pq.loading ? <Loading /> : !project ? <p className="muted">Project {code} niet gevonden.</p> : <div className="pd-body">{body}</div>}
    </section>
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
