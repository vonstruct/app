import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { Tasks } from '../../core/Tasks'
import { Von } from '../../core/Von'
import { toast } from '../../core/toast'

/**
 * VON (fase 4): het commandocentrum. Wacht op jou (voorstellen, per plan), Gesprek, Wat VON deed (met ongedaan maken),
 * In het oog (wat VON opvolgt), Taken. Voorstellen kunnen over alles gaan (soorten in tabel von_action_types).
 * Uitvoeren / weigeren / ongedaan maken via Edge Function von-action. Niets gebeurt zonder goedkeuring.
 */
export type Proposal = { id: string; created_at: string; kind: string; project_code: string | null; title: string; summary: string | null; payload: any; before: any; plan: string | null; status: string; result: string | null; decided_at: string | null; source: string | null; undone_at: string | null }
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
  title: 'Titel', phase: 'Fase', target_install_week: 'Plaatsingsweek', site_street: 'Straat', site_postal_code: 'Postcode', site_city: 'Gemeente', intro_at: 'Kennismaking', lead_source: 'Bron',
  first_name: 'Voornaam', last_name: 'Naam', company: 'Bedrijf', email: 'E-mail', phone: 'Telefoon', street: 'Straat', postal_code: 'Postcode', city: 'Gemeente', country: 'Land', language: 'Taal', notes: 'Notitie',
  name: 'Naam', trade: 'Vak', services: 'Diensten', contact_person: 'Contactpersoon', active: 'Actief',
}
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
      case 'event_create': case 'event_move': return { title: jobTitle, notes: jobInfo || null }
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
        {t?.outward && open && <span className="prop-out" title="Gaat naar buiten (mail, uitnodiging, opdracht of agenda)">naar buiten</span>}
        <strong>{p.title}</strong>
        {p.project_code && <Link className="small" to={`/projecten/${encodeURIComponent(p.project_code)}`}>{p.project_code}</Link>}
        <span className="muted small">{new Date(p.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{p.source ? ` · via ${p.source}` : ''}</span>
      </div>
      {isMail && <p className="small muted">Aan: {p.payload?.to_name} &lt;{p.payload?.to}&gt;{p.kind === 'mail_reply' ? ` · antwoord op “${p.payload?.subject ?? ''}” (vanuit ${p.payload?.mailbox})` : ''}</p>}
      {p.kind === 'whatsapp' && <p className="small muted">Aan: {p.payload?.to_name} · {p.payload?.phone}</p>}
      {!isMail && !hasDiff && !['job_create', 'event_create', 'event_move'].includes(p.kind) && p.summary && <p className="small">{p.summary}</p>}

      {hasDiff && (
        <table className="prop-diff">
          <thead><tr><th>Veld</th><th>Nu</th><th>Wordt</th></tr></thead>
          <tbody>
            {Object.keys(p.payload?.changes ?? {}).map((k) => (
              <tr key={k}>
                <td>{FIELD[k] ?? k}</td>
                <td className="muted">{show(p.before?.[k])}</td>
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
                <button className="primary" disabled={busy} onClick={() => act('approve', 'send')}>✓ Versturen</button>
                <button disabled={busy} onClick={() => act('approve', 'draft')}>Als concept in Outlook</button>
              </>
            ) : <button className="primary" disabled={busy} onClick={() => act('approve')}>✓ Goedkeuren</button>}
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

const TABS: [string, string][] = [['wacht', 'Wacht op jou'], ['gesprek', 'Gesprek'], ['gedaan', 'Wat VON deed'], ['oog', 'In het oog'], ['taken', 'Taken']]

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
          <h1>VON</h1>
          <p className="muted">Je assistent voor de hele app. VON leest alles, stelt voor en voert pas uit na jouw goedkeuring.</p>
        </div>
      </header>
      <nav className="pd-tabs">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setParams(id === 'wacht' ? {} : { tab: id })}>{label}{id === 'wacht' && n ? <span className="nav-badge">{n}</span> : null}</button>)}
      </nav>
      {tab === 'wacht' && <ProposalList />}
      {tab === 'gesprek' && <Von embedded />}
      {tab === 'gedaan' && <Done />}
      {tab === 'oog' && <Watching />}
      {tab === 'taken' && <Tasks title="Taken" />}
    </section>
  )
}
