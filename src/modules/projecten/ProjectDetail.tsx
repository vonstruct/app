import { ErrorBoundary } from '../../core/ErrorBoundary'
import { YukiHistory } from '../../core/YukiHistory'
import type { Timeline } from './KeyDates'
import { toast } from '../../core/toast'
import { Overview, PhaseBar } from './Overview'
import { PlanningPanel } from './PlanningPanel'
import { numbersOf, useProjectPage } from './projectStatus'
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
import { DataTable } from '../../core/DataTable'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtDate, fmtEur, fmtInt } from '../../core/format'
import { Compare } from './Compare'
import { usePhases } from '../../core/projects'
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

/** De 5 tabbladen en welk onderdeel bij welk tabblad hoort. */
const MAIN: [string, string][] = [['overzicht', 'Overzicht'], ['ontwerp', 'Ontwerp'], ['geld', 'Geld'], ['uitvoering', 'Uitvoering'], ['dossier', 'Dossier']]
const MAIN_OF: Record<string, string> = {
  vragenlijst: 'ontwerp', versies: 'ontwerp', brochure: 'ontwerp',
  kost: 'geld', offerte: 'geld', facturen: 'geld', nacalculatie: 'geld',
  bestellingen: 'uitvoering', productie: 'uitvoering', opdrachten: 'uitvoering', oplevering: 'uitvoering',
  mails: 'dossier', documenten: 'dossier', tijdlijn: 'dossier',
}
/** Welk onderdeel open staat als je een tabblad kiest: de stap waar het project nu zit. */
function defaultSub(tab: string, stage: string | null) {
  const s = stage ?? ''
  if (tab === 'ontwerp') return s === 'lead' ? 'vragenlijst' : 'versies'
  if (tab === 'geld') return ['lead', 'design'].includes(s) ? 'kost' : s === 'quote' ? 'offerte' : s === 'closed' ? 'nacalculatie' : 'facturen'
  if (tab === 'uitvoering') return s === 'production' ? 'productie' : s === 'installation' ? 'opdrachten' : s === 'closed' ? 'oplevering' : 'bestellingen'
  if (tab === 'dossier') return 'mails'
  return ''
}

type Step = { id: string; label: string; status?: string; bad?: boolean }
/** Rij met de onderdelen van een tabblad, in de volgorde waarin je werkt; elk met een korte status. */
function Steps({ items, active, onPick, plain }: { items: Step[]; active: string; onPick: (id: string) => void; plain?: boolean }) {
  return (
    <nav className={'pd-steps' + (plain ? ' plain' : '')} aria-label="Onderdelen">
      {items.map((s, i) => (
        <button key={s.id} className={s.id === active ? 'on' : ''} onClick={() => onPick(s.id)} aria-current={s.id === active ? 'page' : undefined}>
          <b>{plain ? '' : `${i + 1} · `}{s.label}</b>
          {s.status && <small className={s.bad ? 'bad-text' : ''}>{s.status}</small>}
        </button>
      ))}
    </nav>
  )
}

export function ProjectDetail() {
  const { code = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  // alles van deze pagina in één verzoek (RPC project_page); opnieuw laden bij een ander tabblad (cijfers en status vers)
  const page = useProjectPage(code, params.get('tab'))
  const pd = page.data
  const pq = { reload: page.reload, error: page.error }
  const ph = usePhases()
  const project = pd?.project ?? undefined
  // 5 tabbladen (6 nov 2026; waren er 14). ?tab= mag een tabblad of een onderdeel zijn (oude links zoals ?tab=offerte blijven werken).
  // tab Planning is opgegaan in het Overzicht (5 nov): ?tab=planning toont het Overzicht.
  const raw = ((t) => (t === 'planning' ? 'overzicht' : t))(params.get('tab') ?? (focus === 'survey' ? 'vragenlijst' : focus === 'mails' ? 'mails' : 'overzicht'))
  const tab = MAIN_OF[raw] ?? (MAIN.some(([id]) => id === raw) ? raw : 'overzicht')
  const sub = MAIN_OF[raw] ? raw : defaultSub(tab, project?.stage ?? null)
  const setTab = (t: string) => setParams(t === 'overzicht' ? {} : { tab: t }, { replace: true })
  const nums = { data: pd ? numbersOf(pd) : null }
  // gsm: het gekozen tabblad in beeld schuiven (enkel de rij tabbladen, niet de pagina)
  const tabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const n = tabsRef.current, el = n?.querySelector<HTMLElement>('button.on')
    if (n && el) n.scrollLeft += el.getBoundingClientRect().left - n.getBoundingClientRect().left - (n.clientWidth - el.clientWidth) / 2
  }, [tab])
  // datums (deadline, start werken, plaatsing) bewaren op het project, daarna de pagina opnieuw laden
  const saveDates = async (patch: Partial<Timeline>) => {
    const { error } = await supabase.from('projects').update(patch).eq('project_code', code)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); page.reload() }
  }
  const tl = { t: pd?.timeline ?? null, gates: pd?.gates ?? [], save: saveDates, load: page.reload }
  // klantgegevens: klein blok onder de kop; opent vanzelf als je komt om een ontbrekend veld in te vullen (?focus=email …)
  const clientFocus = focus && !['fase', 'survey', 'mails', 'datums', 'prijzen'].includes(focus) ? focus : null
  const [showClient, setShowClient] = useState(false)
  const versions = pd?.versions ?? []
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const va = versions.find((v) => v.version === (a ?? versions[1]?.version))
  const vb = versions.find((v) => v.version === (b ?? versions[0]?.version))

  const wa = (project?.client_phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '32')
  const n = nums.data
  const t = tl.t
  const stage = project?.stage ?? ''
  const after = (s: string) => ['installation', 'closed'].includes(stage) || (s === 'production' && stage === 'production')
  const day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  // korte status bij elk onderdeel; de stap waar het project nu zit, staat open
  const STEPS: Record<string, Step[]> = {
    ontwerp: [
      { id: 'vragenlijst', label: 'Wensen van de klant', status: project?.survey_status === 'submitted' ? 'vragenlijst ingediend' : project?.survey_status === 'open' ? 'vragenlijst bezig' : 'vragenlijst en intake' },
      { id: 'versies', label: 'Ontwerpen', status: versions.length ? `${versions.length} ${versions.length === 1 ? 'versie' : 'versies'} · nieuwste v${versions[0].version}` : 'nog geen ontwerp' },
      { id: 'brochure', label: 'Brochure', status: 'voor de klant, zonder prijzen' },
    ],
    geld: [
      { id: 'kost', label: 'Kostprijs', status: !n ? '' : n.nCost ? `${fmtEur(n.cost)}${n.noPrice ? ` · ${n.noPrice} zonder prijs` : ''}` : 'nog niet berekend', bad: !!n?.noPrice },
      { id: 'offerte', label: 'Offerte', status: !n ? '' : n.quote ? [n.quote.number, n.quote.status, n.quote.total_incl != null ? fmtEur(n.quote.total_incl) : null].filter(Boolean).join(' · ') : 'nog geen offerte' },
      { id: 'facturen', label: 'Facturen', status: !n ? '' : n.nInv ? `${fmtEur(n.paid)} van ${fmtEur(n.inv)} betaald` : 'na de offerte' },
      { id: 'nacalculatie', label: 'Nacalculatie', status: stage === 'closed' ? 'klaar om na te kijken' : 'na de plaatsing' },
    ],
    uitvoering: [
      { id: 'bestellingen', label: 'Bestellingen', status: !n ? '' : !n.orders.n ? 'nog geen bestellingen' : [n.orders.toOrder ? `${n.orders.toOrder} te bestellen` : null, n.orders.late ? `${n.orders.late} te laat` : null, `${n.orders.inside} van ${n.orders.n} binnen`].filter(Boolean).join(' · '), bad: !!n?.orders.late },
      { id: 'productie', label: 'Productie', status: !n?.partner ? (after('production') ? 'productiepakket' : 'productiepakket en partner') : n.partner.picked_up_at ? 'opgehaald' : n.partner.ready_at ? 'klaar bij de partner' : n.partner.status === 'doorgegeven' ? (n.partner.pickup_date ? `ophalen ${day(n.partner.pickup_date)}` : 'ophaaldatum ontbreekt') : 'nog niet doorgegeven', bad: n?.partner?.status === 'doorgegeven' && !n.partner.pickup_date && !n.partner.ready_at },
      { id: 'opdrachten', label: 'Plaatsing en opdrachten', status: [t?.install_start ? `plaatsing ${day(t.install_start)}` : t?.target_install_week ? `plaatsing week ${t.target_install_week.split('-W')[1]}` : 'nog geen plaatsingsdatum', n?.jobsAhead ? `${n.jobsAhead} ${n.jobsAhead === 1 ? 'opdracht' : 'opdrachten'}` : null].filter(Boolean).join(' · ') },
      { id: 'oplevering', label: 'Oplevering', status: stage === 'closed' ? 'opgeleverd' : stage === 'installation' ? 'PV en werkpunten' : 'na de plaatsing' },
    ],
    dossier: [
      { id: 'mails', label: 'Mails' },
      { id: 'documenten', label: 'Documenten' },
      { id: 'tijdlijn', label: 'Activiteit' },
    ],
  }
  let body: ReactNode = null
  if (project && ph.data) {
    if (tab === 'overzicht') body = null
    else if (sub === 'mails') body = <MailList project={code} title="Mails" limit={60} />
    else if (sub === 'brochure') body = <BrochurePanel project={code} />
    else if (sub === 'documenten') body = <DocumentsPanel project={code} />
    else if (sub === 'nacalculatie') body = <NacalcPanel project={code} />
    else if (sub === 'oplevering') body = <HandoverPanel project={code} />
    else if (sub === 'facturen') body = <><Invoices project={code} /><div className="panel"><h2>In Yuki</h2><p className="muted small">Facturen en betalingen uit de boekhouding die bij dit project horen: het offertenummer staat in de omschrijving (bv. "Voorschotfactuur" + offertenummer) of het is een factuur van de app. Andere facturen van deze klant tellen niet mee.</p><YukiHistory clientId={project.client_id} project={code} /></div></>
    else if (sub === 'offerte') body = <QuotePanel project={code} />
    else if (sub === 'kost') body = <ProjectCost project={code} onQuote={() => setTab('offerte')} />
    else if (sub === 'productie') body = <ProductionPanel project={code} />
    else if (sub === 'bestellingen') body = <><Orders project={code} /><div className="panel"><h2>Uit de mailbox</h2><p className="muted small">Orderbevestigingen, facturen en leveringsbons van leveranciers die aan dit project gekoppeld zijn (bijlage gelezen). Na te kijken: Inkoop → Uit je mailbox.</p><MailDocs project={code} /></div></>
    else if (sub === 'vragenlijst') body = <>{!['lead', 'intake', 'survey'].includes(project.phase) && <LeadActions p={project} onDone={pq.reload} />}<IntakeCard code={code} /><SurveyPanel code={code} focus={focus === 'survey'} /></>
    else if (sub === 'opdrachten') body = <PlanningPanel project={project} />
    else if (sub === 'tijdlijn') body = <EventFeed project={code} title="Tijdlijn" limit={40} />
    else if (sub === 'versies') body = (
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
    if (tab === 'overzicht') body = (
      <>
        {['lead', 'intake', 'survey'].includes(project.phase) && <LeadActions p={project} onDone={pq.reload} />}
        {project.stage === 'lead' && <IntakeCard code={code} />}
        <Overview project={project} page={pd!} t={tl.t} gates={tl.gates} nums={nums.data} saveDates={tl.save} onTab={(t) => setTab(t)} onSaved={page.reload} />
      </>
    )
    else body = <><Steps items={STEPS[tab]} active={sub} onPick={setTab} plain={tab === 'dossier'} />{body}</>
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
      {project && ph.data && <PhaseBar project={project} gates={tl.gates} phases={ph.data} onSaved={page.reload} focus={focus === 'fase'} />}
      <nav className="pd-tabs" aria-label="Onderdelen van het project" ref={tabsRef}>
        {MAIN.map(([id, label]) => {
          const o = n?.open[id]
          return <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}{o && tab !== id && <span className={'pd-badge' + (o.urgent ? ' red' : '')} title={`${o.n} open ${o.n === 1 ? 'punt' : 'punten'}`}>{o.n}</span>}</button>
        })}
      </nav>
      <ErrorBox error={page.error} />
      {!pd ? (page.loading ? <Loading /> : null) : !project ? <p className="muted">Project {code} niet gevonden.</p> : <div className="pd-body"><ErrorBoundary key={tab + '/' + sub} title="Dit onderdeel kon niet getoond worden">{body}</ErrorBoundary></div>}
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
