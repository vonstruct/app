import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from './supabase'

/** Mails uit info@ en olivier@ (tabel mail_messages, gevuld door Edge Function mail-sync). Per project, of de hele inbox. */
export type MailRow = {
  id: string; mailbox: string; direction: 'in' | 'out'; at: string; from_name: string | null; from_email: string | null; to_emails: string[]; to_names: string[]
  subject: string | null; snippet: string | null; summary: string | null; category: string | null; needs_reply: boolean | null; urgency: number | null
  replied: boolean; dismissed_at: string | null; party_kind: string | null; party_name: string | null; project_code: string | null; has_attachments: boolean; web_link: string | null; is_bulk: boolean; proposal_status: string | null
}
type Filter = 'wacht' | 'alle' | 'in' | 'out'

const fmt = (iso: string) => {
  const d = new Date(iso), today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
}
const hasProposal = (m: MailRow) => !!m.proposal_status && m.proposal_status !== 'mislukt'
const waiting = (m: MailRow) => m.direction === 'in' && !!m.needs_reply && !m.replied && !m.dismissed_at && !hasProposal(m)

function MailItem({ m, open, onToggle, onChanged, showProject }: { m: MailRow; open: boolean; onToggle: () => void; onChanged: () => void; showProject: boolean }) {
  const [body, setBody] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    if (open && body === null) supabase.from('mail_messages').select('body_text').eq('id', m.id).single().then(({ data }) => setBody((data as { body_text: string | null } | null)?.body_text ?? ''))
  }, [open, body, m.id])
  const who = m.direction === 'in' ? (m.party_name ?? m.from_name ?? m.from_email) : `aan ${m.party_name ?? m.to_names?.[0] ?? m.to_emails?.[0] ?? '?'}`
  const propose = async () => {
    setBusy(true); setNote(null)
    const { data, error } = await supabase.functions.invoke('von', { body: { message: `Stel een antwoord voor op de mail met id ${m.id}. Lees eerst het gesprek met mail_thread, en maak dan het voorstel met propose_mail_reply. Antwoord daarna in één zin.` } })
    setBusy(false)
    setNote(error ? 'VON kon geen voorstel maken.' : ((data as { answer?: string } | null)?.answer ?? 'Voorstel gemaakt.'))
    onChanged()
  }
  const dismiss = async () => { await supabase.from('mail_messages').update({ dismissed_at: new Date().toISOString() }).eq('id', m.id); onChanged() }
  return (
    <li className={'ml-item' + (waiting(m) ? ' wait' : '') + (m.urgency === 1 && waiting(m) ? ' urgent' : '') + (open ? ' open' : '')}>
      <button className="ml-row" onClick={onToggle}>
        <span className="ml-dir" title={m.direction === 'in' ? 'ontvangen' : 'verzonden'}>{m.direction === 'in' ? '↘' : '↗'}</span>
        <span className="ml-main">
          <span className="ml-top"><strong>{who}</strong>{m.party_kind && <span className="ml-kind">{m.party_kind}</span>}<span className="ml-subj">{m.subject ?? '(zonder onderwerp)'}</span>{m.has_attachments && <span title="bijlage">📎</span>}</span>
          <span className="muted small">{m.summary ?? m.snippet}</span>
        </span>
        <span className="ml-side">
          <span className="muted small">{fmt(m.at)}</span>
          {m.direction === 'in' && m.replied ? <span className="chip ok">beantwoord</span>
            : m.proposal_status === 'voorstel' ? <Link to="/von" className="chip gold" onClick={(e) => e.stopPropagation()}>✨ voorstel klaar</Link>
            : m.proposal_status === 'uitgevoerd' ? <span className="chip ok">✓ antwoord verstuurd of concept</span>
            : waiting(m) ? <span className="chip warn">wacht op antwoord</span> : null}
        </span>
      </button>
      {open && (
        <div className="ml-body">
          <p className="muted small">
            {m.direction === 'in' ? `Van ${m.from_name ?? ''} <${m.from_email}>` : `Aan ${(m.to_emails ?? []).join(', ')}`} · {new Date(m.at).toLocaleString('nl-BE')} · mailbox {m.mailbox}
            {showProject && m.project_code && <> · <Link to={`/projecten/${encodeURIComponent(m.project_code)}`}>{m.project_code}</Link></>}
          </p>
          <pre className="ml-text">{body ?? 'Laden…'}</pre>
          <div className="toolbar">
            {m.direction === 'in' && <button className="primary" disabled={busy} onClick={propose}>{busy ? 'VON schrijft…' : '✨ Antwoord laten voorstellen'}</button>}
            {m.web_link && <a className="btn-plain" href={m.web_link} target="_blank" rel="noreferrer">Openen in Outlook</a>}
            {waiting(m) && <button className="link" onClick={dismiss}>Geen antwoord nodig</button>}
          </div>
          {note && <p className="notice small">{note} <Link to="/von">Naar de voorstellen →</Link></p>}
        </div>
      )}
    </li>
  )
}

export function MailList({ project, focus, title, limit = 40 }: { project?: string; focus?: string | null; title?: string; limit?: number }) {
  const [rows, setRows] = useState<MailRow[] | null>(null)
  const [filter, setFilter] = useState<Filter>(project ? 'alle' : 'wacht')
  const [search, setSearch] = useState('')
  const [bulk, setBulk] = useState(false)
  const [open, setOpen] = useState<string | null>(focus ?? null)
  const load = useCallback(async () => {
    let q = supabase.from('app_mail_messages').select('*').order('at', { ascending: false }).limit(limit)
    if (project) q = q.eq('project_code', project)
    if (!bulk) q = q.eq('is_bulk', false)
    if (filter === 'wacht') q = q.eq('direction', 'in').eq('needs_reply', true).eq('replied', false).is('dismissed_at', null).or('proposal_status.is.null,proposal_status.eq.voorstel,proposal_status.eq.mislukt')
    if (filter === 'in' || filter === 'out') q = q.eq('direction', filter)
    const s = search.trim().replace(/[,()]/g, ' ')
    if (s) q = q.or(`subject.ilike.%${s}%,from_name.ilike.%${s}%,from_email.ilike.%${s}%,party_name.ilike.%${s}%,summary.ilike.%${s}%`)
    const { data } = await q
    let list = (data as MailRow[]) ?? []
    if (focus && !list.some((m) => m.id === focus)) {
      const { data: f } = await supabase.from('app_mail_messages').select('*').eq('id', focus).maybeSingle()
      if (f) list = [f as MailRow, ...list]
    }
    setRows(list)
  }, [project, filter, search, bulk, limit, focus])
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t) }, [load, search])

  return (
    <div className="panel mail-list">
      <div className="ml-head">
        <h2>{title ?? 'Mails'}</h2>
        <div className="segmented small">
          {(['wacht', 'alle', 'in', 'out'] as Filter[]).map((f) => (
            <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'wacht' ? 'Wacht op antwoord' : f === 'alle' ? 'Alle' : f === 'in' ? 'Ontvangen' : 'Verzonden'}</button>
          ))}
        </div>
        <input className="search-input" placeholder="Zoeken…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!project && <label className="check small"><input type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} /> ook nieuwsbrieven</label>}
      </div>
      {rows === null ? <p className="muted small">Laden…</p> : rows.length === 0 ? (
        <p className="muted small">{filter === 'wacht' ? 'Niets wacht op antwoord.' : project ? 'Nog geen mails gekoppeld aan dit project (op e-mailadres van de klant of projectcode in het onderwerp).' : 'Geen mails.'}</p>
      ) : (
        <ul className="ml">
          {rows.map((m) => <MailItem key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} onChanged={load} showProject={!project} />)}
        </ul>
      )}
    </div>
  )
}
