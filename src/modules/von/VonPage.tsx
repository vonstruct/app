import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { Von } from '../../core/Von'
import { toast } from '../../core/toast'

/**
 * VON (fase 4): het commandocentrum. Wacht op jou (voorstellen, per plan), Gesprek, Wat VON deed (met ongedaan maken),
 * In het oog (wat VON opvolgt), Taken. Voorstellen kunnen over alles gaan (soorten in tabel von_action_types).
 * Uitvoeren / weigeren / ongedaan maken via Edge Function von-action. Niets gebeurt zonder goedkeuring.
 */
export type Proposal = { id: string; created_at: string; kind: string; project_code: string | null; title: string; summary: string | null; payload: any; before: any; plan: string | null; status: string; result: string | null; decided_at: string | null; source: string | null; undone_at: string | null; agent?: string | null; review?: { ok: boolean; issues: string[]; warnings?: string[]; by?: string } | null }
type ActionType = { kind: string; area: string; label: string; outward: boolean; undoable: boolean }

let typesCache: Record<string, ActionType> | null = null
function useActionTypes() {
  const [t, setT] = useState<Record<string, ActionType>>(typesCache ?? {})
  useEffect(() => {
    if (typesCache) return
    supabase.from('von_action_types').select('kind,area,label,outward,undoable').then(({ data }) => { typesCache = Object.fromEntries(((data ?? []) as ActionType[]).map((x) => [x.kind, x])); setT(typesCache) })
  }, [])
  return t
}

const FIELD: Record<string, string> = {
  title: 'Titel', phase: 'Fase', target_install_week: 'Plaatsingsweek', deadline: 'Deadline klant', deadline_reason: 'Reden deadline', works_start: 'Start van de werken', install_start: 'Plaatsing vanaf', install_days: 'Dagen plaatsing', site_street: 'Straat', site_postal_code: 'Postcode', site_city: 'Gemeente', intro_at: 'Kennismaking', lead_source: 'Bron',
  first_name: 'Voornaam', last_name: 'Naam', company: 'Bedrijf', email: 'E-mail', phone: 'Telefoon', street: 'Straat', postal_code: 'Postcode', city: 'Gemeente', country: 'Land', language: 'Taal', notes: 'Notitie',
  name: 'Naam', trade: 'Vak', services: 'Diensten', contact_person: 'Contactpersoon', active: 'Actief',
  note: 'Omschrijving', supplier: 'Leverancier', reference: 'Bestelnummer', status: 'Status', expected_at: 'Verwacht op', ordered_at: 'Besteld op', delivered_at: 'Geleverd op',
  needed_by: 'Nodig op', lead_days: 'Levertermijn (werkdagen)', amount: 'Bedrag', actual_amount: 'Werkelijk bedrag', due_date: 'Tegen', description: 'Uitleg', hours: 'Uren',
  activity: 'Soort werk', work_date: 'Datum', unit_price: 'Prijs', qty: 'Aantal', discount_pct: 'Korting %', vat_rate: 'Btw %', invoice_number: 'Factuurnummer', invoice_date: 'Factuurdatum',
  paid_at: 'Betaald op', paid_amount: 'Betaald bedrag', text: 'Tekst', label: 'Omschrijving', value: 'Waarde', category: 'Rubriek', price: 'Prijs', origin: 'Herkomst',
}
/** Velden die het systeem zelf invult: niet tonen in een voorstel. */
const HIDE = new Set(['manual', 'ordered_by', 'project_code', 'quote_id', 'quote_line_id', 'design_version_id', 'id', 'created_at', 'updated_at', 'needed_by_manual', 'auto_vervallen'])
const AGENT_NAME: Record<string, string> = { inbox: 'Inbox', planning: 'Planning', nakijker: 'Nakijker', von_watch: 'Meedenken', inkoop: 'Inkoop' }
const show = (v: unknown) => v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
const when = (iso?: string) => iso ? new Date(iso).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export function ProposalCard({ p, onDone }: { p: Proposal; onDone: () => void }) {
  const types = useActionTypes()
  const t = types[p.kind]
  const [subject, setSubject] = useState<string>(p.payload?.subject ?? '')
  const [body, setBody] = useState<string>(p.payload?.body ?? p.payload?.text ?? p.payload?.note ?? '')
  const [changes, setChanges] = useState<Record<string, any>>(p.payload?.changes ?? {})
  const [jobTitle, setJobTitle] = useState<string>(p.payload?.row?.title ?? p.payload?.title ?? '')
  const [jobInfo, setJobInfo] = useState<string>(p.payload?.row?.instructions ?? p.payload?.notes ?? '')
  const [att, setAtt] = useState<string>((p.payload?.attendees ?? []).join(', '))
  const [online, setOnline] = useState<boolean>(p.payload?.online !== false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const open = p.status === 'voorstel'
  const isMail = p.kind === 'mail' || p.kind === 'mail_reply'
  const hasDiff = p.kind === 'project_update' || p.kind === 'relation_update' || (p.kind === 'record' && p.payload?.action !== 'delete')
  const textKinds = ['mail', 'mail_reply', 'project_note', 'job_reminder', 'job_move', 'whatsapp']

  const edits = () => {
    switch (p.kind) {
      case 'mail': return { subject, body }
      case 'mail_reply': return { body }
      case 'project_note': return { text: body }
      case 'job_reminder': return { note: body || null }
      case 'job_move': return { note: body }
      case 'whatsapp': return { text: body }
      case 'project_update': case 'relation_update': case 'record': return { changes }
      case 'job_create': return { row: { ...p.payload.row, title: jobTitle, instructions: jobInfo || null } }
      case 'event_create': return { title: jobTitle, notes: jobInfo || null, attendees: att.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => x.includes('@')), online }
      case 'event_move': return { title: jobTitle, notes: jobInfo || null }
      default: return {}
    }
  }
  const act = async (action: 'approve' | 'reject' | 'undo', mode?: 'draft' | 'send') => {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('von-action', { body: { action, id: p.id, payload: action === 'approve' ? edits() : undefined, mode } })
    setBusy(false)
    const d = data as { ok?: boolean; result?: string; error?: string; status?: string } | null
    const text = error ? 'Mislukt.' : d?.error ?? d?.result ?? (action === 'reject' ? 'Geweigerd' : action === 'undo' ? 'Ongedaan gemaakt' : 'Uitgevoerd')
    setMsg(text)
    toast(text, error || d?.error || d?.ok === false ? 'err' : 'ok')
    onDone()
  }

  return (
    <div className={'panel prop prop-' + p.status + (p.undone_at ? ' prop-undone' : '')}>
      <div className="prop-head">
        <span className="prop-kind">{t?.label ?? p.kind}</span>
        {p.agent && p.agent !== 'von' && <span className="prop-agent">{AGENT_NAME[p.agent] ?? p.agent}</span>}
        {t?.outward && open && <span className="prop-out" title="Gaat naar buiten (mail, uitnodiging, opdracht of agenda)">naar buiten</span>}
        <strong>{p.title}</strong>
        {p.project_code && <Link className="small" to={`/projecten/${encodeURIComponent(p.project_code)}`}>{p.project_code}</Link>}
        <span className="muted small">{new Date(p.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{p.source ? ` · via ${p.source}` : ''}</span>
      </div>
      {open && p.review && (p.review.issues.length > 0 || (p.review.warnings ?? []).length > 0) && (
        <div className={'prop-review' + (p.review.ok ? ' warn' : ' bad')}>
          <b>{p.review.ok ? 'Nakijker: let op' : 'Nakijker: niet in orde'}</b>
          <ul>{[...p.review.issues, ...(p.review.warnings ?? [])].map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {open && p.review?.ok && !p.review.issues.length && !(p.review.warnings ?? []).length && <p className="prop-review-ok small">✓ Nagekeken</p>}
      {isMail && <p className="small muted">Aan: {p.payload?.to_name} &lt;{p.payload?.to}&gt;{p.kind === 'mail_reply' ? ` · antwoord op “${p.payload?.subject ?? ''}” (vanuit ${p.payload?.mailbox})` : ''}</p>}
      {p.kind === 'whatsapp' && <p className="small muted">Aan: {p.payload?.to_name} · {p.payload?.phone}</p>}
      {!isMail && !hasDiff && !['job_create', 'event_create', 'event_move'].includes(p.kind) && p.summary && <p className="small">{p.summary}</p>}

      {hasDiff && (
        <table className="prop-diff">
          <thead><tr><th>Veld</th>{p.payload?.action !== 'insert' && <th>Nu</th>}<th>{p.payload?.action === 'insert' ? 'Waarde' : 'Wordt'}</th></tr></thead>
          <tbody>
            {Object.keys(p.payload?.changes ?? {}).filter((k) => !HIDE.has(k)).map((k) => (
              <tr key={k}>
                <td>{FIELD[k] ?? k.replace(/_/g, ' ')}</td>
                {p.payload?.action !== 'insert' && <td className={'muted prop-was' + (show(p.before?.[k]) === '—' ? ' none' : '')}>{show(p.before?.[k])}</td>}
                <td>{open ? <input value={show(changes[k]) === '—' ? '' : String(changes[k])} onChange={(e) => setChanges({ ...changes, [k]: e.target.value })} /> : <b>{show(p.payload.changes[k])}</b>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {['job_create', 'event_create', 'event_move'].includes(p.kind) && (
        <div className="prop-fields">
          <label>Titel{open ? <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /> : <b>{jobTitle}</b>}</label>
          <span className="small"><b>Wanneer:</b> {when(p.payload?.row?.start_at ?? p.payload?.start)} → {when(p.payload?.row?.end_at ?? p.payload?.end)}{p.payload?.row?.slot ? ` (${p.payload.row.slot})` : ''}</span>
          {p.payload?.who && <span className="small"><b>Wie:</b> {p.payload.who}</span>}
          {p.kind === 'event_create' && (open ? (
            <>
              <label>Uitnodiging naar (e-mailadressen, leeg = enkel in je eigen agenda)<input value={att} onChange={(e) => setAtt(e.target.value)} placeholder="bv. klant@voorbeeld.be" /></label>
              <label className="check small"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Teams-link toevoegen</label>
              {!att.includes('@') && <span className="small warn-text">Er gaat geen uitnodiging naar iemand: enkel een afspraak in je eigen agenda.</span>}
            </>
          ) : (
            <span className="small"><b>Uitnodiging:</b> {(p.payload?.attendees ?? []).length ? (p.payload.attendees as string[]).join(', ') : 'geen (enkel eigen agenda)'}{p.payload?.online ? ' · met Teams-link' : ''}</span>
          ))}
          {(p.payload?.row?.address || p.payload?.location) && <span className="small"><b>Waar:</b> {p.payload?.row?.address ?? p.payload?.location}</span>}
          <label>{p.kind === 'job_create' ? 'Wat moet er gebeuren' : 'Notitie'}{open ? <textarea rows={3} value={jobInfo} onChange={(e) => setJobInfo(e.target.value)} /> : <span className="small">{jobInfo || '—'}</span>}</label>
        </div>
      )}

      {open ? (
        <>
          {p.kind === 'mail' && <input className="prop-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          {textKinds.includes(p.kind) && (
            <textarea className="prop-body" rows={isMail || p.kind === 'whatsapp' ? 8 : 3} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={p.kind === 'job_reminder' ? 'Optioneel extra zinnetje' : p.kind === 'job_move' ? 'Reden (wordt meegestuurd)' : ''} />
          )}
          <div className="prop-actions">
            {isMail ? (
              <>
                <button className="primary" disabled={busy} onClick={() => act('approve', 'send')}>{p.review?.ok === false ? 'Toch versturen' : '✓ Versturen'}</button>
                <button disabled={busy} onClick={() => act('approve', 'draft')}>Als concept in Outlook</button>
              </>
            ) : <button className="primary" disabled={busy} onClick={() => act('approve')}>{p.review?.ok === false ? 'Toch goedkeuren' : '✓ Goedkeuren'}</button>}
            <button disabled={busy} onClick={() => act('reject')}>Weigeren</button>
          </div>
        </>
      ) : (
        <div className="prop-done">
          <p className={'small ' + (p.undone_at ? 'muted' : p.status === 'uitgevoerd' ? 'ok-t' : p.status === 'mislukt' ? 'bad-t' : 'muted')}>
            {p.undone_at ? '↶ Ongedaan gemaakt' : p.status === 'uitgevoerd' ? '✓ Uitgevoerd' : p.status === 'mislukt' ? '⚠ Mislukt' : 'Geweigerd'}{p.result ? `: ${p.result}` : ''}
          </p>
          {p.kind === 'whatsapp' && p.status === 'uitgevoerd' && p.payload?.link && <a className="rc-btn wa" href={p.payload.link} target="_blank" rel="noreferrer">Openen in WhatsApp</a>}
          {p.status === 'uitgevoerd' && !p.undone_at && t?.undoable && !(p.kind === 'relation_update' && !p.before) && <button className="link small" disabled={busy} onClick={() => act('undo')}>Ongedaan maken</button>}
        </div>
      )}
      {msg && <p className="small">{msg}</p>}
    </div>
  )
}

/** Open voorstellen, gegroepeerd per plan; een plan in één keer goedkeuren. */
export function ProposalList({ project, compact = false }: { project?: string; compact?: boolean }) {
  const [list, setList] = useState<Proposal[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    let q = supabase.from('von_proposals').select('*').eq('status', 'voorstel').order('created_at', { ascending: true }).limit(80)
    if (project) q = q.eq('project_code', project)
    const { data } = await q
    setList((data as Proposal[]) ?? [])
  }, [project])
  useEffect(() => { load() }, [load])
  const groups = useMemo(() => {
    const m = new Map<string, Proposal[]>()
    for (const p of list ?? []) { const k = p.plan ?? `__${p.id}`; m.set(k, [...(m.get(k) ?? []), p]) }
    return [...m.entries()]
  }, [list])
  const approvePlan = async (plan: string, items: Proposal[]) => {
    setBusy(plan)
    let ok = 0
    for (const p of items) {
      if (p.kind === 'mail' || p.kind === 'mail_reply') continue // mails apart: versturen of concept kiezen
      const { data } = await supabase.functions.invoke('von-action', { body: { action: 'approve', id: p.id } })
      if ((data as { ok?: boolean })?.ok) ok++
    }
    setBusy(null)
    toast(`${ok} van ${items.length} uitgevoerd${items.some((p) => p.kind.startsWith('mail')) ? ' (mails apart bekijken)' : ''}`)
    load()
  }
  if (list === null) return <p className="muted">Laden…</p>
  if (list.length === 0) return compact ? null : <div className="vd-empty"><b>Niets wacht op je</b>Vraag VON iets, of wacht tot hij zelf iets voorstelt.</div>
  return (
    <div className="prop-list">
      {groups.map(([k, items]) => k.startsWith('__') ? <ProposalCard key={k} p={items[0]} onDone={load} /> : (
        <section key={k} className="panel vd-panel prop-plan">
          <div className="vd-h"><h2>Plan: {k}</h2><span className="vd-more">{items.length} acties</span></div>
          <div className="prop-plan-body">
            {items.map((p) => <ProposalCard key={p.id} p={p} onDone={load} />)}
            <div className="prop-actions"><button className="primary" disabled={busy === k} onClick={() => approvePlan(k, items)}>{busy === k ? 'Bezig…' : '✓ Heel het plan goedkeuren'}</button></div>
          </div>
        </section>
      ))}
    </div>
  )
}

function Done() {
  const [list, setList] = useState<Proposal[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('von_proposals').select('*').neq('status', 'voorstel').order('decided_at', { ascending: false, nullsFirst: false }).limit(60)
    setList((data as Proposal[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  if (list === null) return <p className="muted">Laden…</p>
  if (!list.length) return <div className="vd-empty"><b>Nog niets afgehandeld</b>Wat je goedkeurt of weigert, komt hier.</div>
  return <div className="prop-list">{list.map((p) => <ProposalCard key={p.id} p={p} onDone={load} />)}</div>
}

/** Wat VON vanzelf opvolgt: aandachtspunten van de control tower + wat het meedenken deed. */
function Watching() {
  const [flags, setFlags] = useState<{ kind: string; n: number }[]>([])
  const [runs, setRuns] = useState<{ created_at: string; question: string; answer: string | null }[]>([])
  useEffect(() => {
    supabase.from('app_control_tower').select('kind').then(({ data }) => {
      const m = new Map<string, number>(); for (const r of (data ?? []) as { kind: string }[]) m.set(r.kind, (m.get(r.kind) ?? 0) + 1)
      setFlags([...m.entries()].map(([kind, n]) => ({ kind, n })))
    })
    supabase.from('agent_runs').select('created_at,question,answer').eq('agent', 'von_watch').order('created_at', { ascending: false }).limit(15).then(({ data }) => setRuns((data as any[]) ?? []))
  }, [])
  const W: [string, string, string[]][] = [
    ['Mails', 'Nieuwe mails van klanten, onderaannemers en leveranciers: VON leest mee en stelt een antwoord, afspraak of opdracht voor.', ['mail_antwoord']],
    ['Opdrachten', 'Niet bevestigd, verzet of een ander moment voorgesteld: VON stelt een herinnering of nieuw moment voor.', ['opdracht']],
    ['Aanvragen & klanten', 'Nieuwe aanvragen, vragenlijsten, ontbrekende e-mailadressen, projecten die stilliggen.', ['aanvraag_nieuw', 'survey_nieuw', 'survey_open', 'klant_email', 'stilstand']],
    ['Ontwerp & kosten', 'Artikels zonder prijs, fouten in de stuklijst, mislukte berekeningen.', ['prijzen', 'kosten', 'optimalisatie', 'stuklijst_fout', 'stuklijst_opm']],
    ['Systemen', 'Back-up, sleutels die vervallen, mailproblemen, verouderde leveranciersprijzen.', ['backup', 'sleutel', 'mail', 'leverancier', 'partner_email']],
  ]
  return (
    <div className="von-watch">
      <div className="rc-grid">
        {W.map(([title, text, kinds]) => {
          const n = flags.filter((f) => kinds.includes(f.kind)).reduce((a, f) => a + f.n, 0)
          return <div key={title} className="panel vd-panel"><div className="vd-h"><h2>{title}</h2><span className="vd-more">{n ? `${n} open` : '✓'}</span></div><p className="vd-pad small">{text}</p></div>
        })}
      </div>
      <section className="panel vd-panel">
        <div className="vd-h"><h2>Laatst meegedacht</h2></div>
        {runs.length === 0 ? <p className="vd-pad muted small">Nog niets. Zodra er een mail van een bekend contact binnenkomt of er iets gebeurt bij een opdracht, kijkt VON mee.</p> : (
          <ul className="von-runs">{runs.map((r) => <li key={r.created_at}><span className="muted small">{when(r.created_at)}</span> {r.answer ?? '—'}</li>)}</ul>
        )}
      </section>
      <p className="muted small">Briefing om 7u15 en 18u. Alles wat VON wil doen, komt eerst bij "Wacht op jou".</p>
    </div>
  )
}

// VON-instellingen (niet in het menu, sinds 4 nov 2026): beslissen gebeurt in Vandaag; hier controle, logboek en ongedaan maken.
const TABS: [string, string][] = [['wacht', 'Wacht op jou'], ['gedaan', 'Wat VON deed'], ['oog', 'In het oog'], ['team', 'Team'], ['gesprek', 'Gesprek']]

export function VonPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab')! : 'wacht'
  const [n, setN] = useState<number | null>(null)
  useEffect(() => { supabase.from('von_proposals').select('id', { count: 'exact', head: true }).eq('status', 'voorstel').then(({ count }) => setN(count ?? 0)) }, [tab])
  return (
    <section className="vonp">
      <header className="vonp-head">
        <span className="vonp-mark">V</span>
        <div>
          <div className="vd-date">{new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>VON: team en logboek</h1>
          <p className="muted">Beslissen doe je in <Link to="/overzicht">Vandaag</Link>. Hier zie je wat VON en de agents deden (en maak je iets ongedaan), wat ze opvolgen, en stel je het team in.</p>
        </div>
      </header>
      <nav className="pd-tabs">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setParams(id === 'wacht' ? {} : { tab: id })}>{label}{id === 'wacht' && n ? <span className="nav-badge">{n}</span> : null}</button>)}
      </nav>
      {tab === 'wacht' && <ProposalList />}
      {tab === 'gesprek' && <Von embedded />}
      {tab === 'gedaan' && <Done />}
      {tab === 'oog' && <Watching />}
      {tab === 'team' && <Team />}
    </section>
  )
}

/** Team: de agents (VON en de specialisten) met model, budget, regels en kosten; en welke gebeurtenis naar wie gaat. */
type AgentUse = { id: string; name: string; role: string | null; model: string; enabled: boolean; max_runs_per_day: number; daily_budget_usd: number; sort: number; tools: string[] | null; cost_today: number; runs_today: number; cost_30d: number; runs_30d: number }
const MODELS: [string, string][] = [['claude-haiku-5-5', 'Snel en goedkoop (Haiku)'], ['claude-sonnet-5-5', 'Middel (Sonnet)'], ['claude-opus-5-5', 'Sterkst en duurst (Opus)']]
function Team() {
  const [list, setList] = useState<AgentUse[] | null>(null)
  const [routes, setRoutes] = useState<{ event_kind: string; agent_id: string; enabled: boolean; note: string | null }[]>([])
  const [edit, setEdit] = useState<string | null>(null)
  const [instr, setInstr] = useState('')
  const load = useCallback(async () => {
    const [a, r] = await Promise.all([supabase.from('app_agent_usage').select('*').order('sort'), supabase.from('agent_routes').select('*').order('event_kind')])
    setList((a.data as AgentUse[]) ?? []); setRoutes((r.data as any[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  const save = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('agents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    toast(error ? 'Niet bewaard: ' + error.message : 'Bewaard', error ? 'err' : 'ok'); load()
  }
  const openEdit = async (id: string) => { const { data } = await supabase.from('agents').select('instructions').eq('id', id).single(); setInstr((data as { instructions: string } | null)?.instructions ?? ''); setEdit(id) }
  if (list === null) return <p className="muted">Laden…</p>
  const usd = (n: number) => '$ ' + Number(n ?? 0).toFixed(2)
  const total30 = list.reduce((a, x) => a + Number(x.cost_30d ?? 0), 0)
  return (
    <div className="team">
      <p className="muted">VON is je aanspreekpunt; de specialisten doen elk één vak. Kosten laatste 30 dagen samen: <b>{usd(total30)}</b>.</p>
      <div className="team-grid">
        {list.filter((a) => a.id !== 'mail').map((a) => (
          <section key={a.id} className={'panel vd-panel team-card' + (a.enabled ? '' : ' off')}>
            <div className="vd-h"><h2>{a.name}</h2><label className="team-on"><input type="checkbox" checked={a.enabled} onChange={(e) => save(a.id, { enabled: e.target.checked })} /> {a.enabled ? 'aan' : 'uit'}</label></div>
            <div className="team-body">
              <p className="small">{a.role}</p>
              <label className="small">Model
                <select value={a.model} onChange={(e) => save(a.id, { model: e.target.value })}>{MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <div className="team-nums">
                <label className="small">Budget per dag ($)<input type="number" step="0.5" min="0" defaultValue={a.daily_budget_usd} onBlur={(e) => Number(e.target.value) !== a.daily_budget_usd && save(a.id, { daily_budget_usd: Number(e.target.value) })} /></label>
                <label className="small">Max. keer per dag<input type="number" min="0" defaultValue={a.max_runs_per_day} onBlur={(e) => Number(e.target.value) !== a.max_runs_per_day && save(a.id, { max_runs_per_day: Number(e.target.value) })} /></label>
              </div>
              <p className="small muted">Vandaag: {a.runs_today}× · {usd(a.cost_today)} · 30 dagen: {a.runs_30d}× · {usd(a.cost_30d)}</p>
              {a.tools?.length ? <p className="small muted">Hulpmiddelen: {a.tools.length}</p> : <p className="small muted">Hulpmiddelen: alle</p>}
              {edit === a.id ? (
                <>
                  <textarea className="prop-body" rows={10} value={instr} onChange={(e) => setInstr(e.target.value)} />
                  <span className="toolbar"><button className="primary" onClick={async () => { await save(a.id, { instructions: instr }); setEdit(null) }}>Regels bewaren</button><button onClick={() => setEdit(null)}>Annuleren</button></span>
                </>
              ) : <button className="link small" onClick={() => openEdit(a.id)}>Regels bekijken of aanpassen</button>}
            </div>
          </section>
        ))}
      </div>
      <section className="panel vd-panel">
        <div className="vd-h"><h2>Wie doet wat bij een gebeurtenis</h2></div>
        <div className="team-body">
          {routes.map((r) => (
            <div key={r.event_kind} className="team-route">
              <span>{r.note ?? r.event_kind}</span>
              <select value={r.agent_id} onChange={async (e) => { await supabase.from('agent_routes').update({ agent_id: e.target.value }).eq('event_kind', r.event_kind); toast('Bewaard'); load() }}>
                {list.filter((a) => !['mail', 'nakijker'].includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <label className="check small"><input type="checkbox" checked={r.enabled} onChange={async (e) => { await supabase.from('agent_routes').update({ enabled: e.target.checked }).eq('event_kind', r.event_kind); load() }} /> aan</label>
            </div>
          ))}
          <p className="small muted">De Nakijker controleert elk voorstel. Bij een fout kan het pas uitgevoerd worden als jij het toch wilt.</p>
        </div>
      </section>
    </div>
  )
}
