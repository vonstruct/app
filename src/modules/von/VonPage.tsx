import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { Tasks } from '../../core/Tasks'

/** VON: voorstellen goedkeuren (fase 3) en de takenlijst. Uitvoeren via Edge Function von-action. */
type Proposal = { id: string; created_at: string; kind: string; project_code: string | null; title: string; summary: string | null; payload: any; status: string; result: string | null; decided_at: string | null; source: string | null }
const KIND: Record<string, string> = { mail: '✉ Mail', mail_reply: '↩ Antwoord', job_reminder: '🔔 Herinnering', job_move: '📅 Verzetten', project_note: '📝 Notitie' }

function ProposalCard({ p, onDone }: { p: Proposal; onDone: () => void }) {
  const [subject, setSubject] = useState<string>(p.payload?.subject ?? '')
  const [body, setBody] = useState<string>(p.payload?.body ?? p.payload?.text ?? p.payload?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const open = p.status === 'voorstel'
  const isMail = p.kind === 'mail' || p.kind === 'mail_reply'
  const act = async (action: 'approve' | 'reject', mode?: 'draft' | 'send') => {
    if (action === 'approve' && mode !== 'draft' && !confirm(isMail ? `Mail nu versturen naar ${p.payload?.to}?` : 'Dit voorstel nu uitvoeren?')) return
    setBusy(true)
    const edits = p.kind === 'mail' ? { subject, body } : p.kind === 'mail_reply' ? { body } : p.kind === 'project_note' ? { text: body } : p.kind === 'job_reminder' ? { note: body || null } : p.kind === 'job_move' ? { note: body } : {}
    const { data, error } = await supabase.functions.invoke('von-action', { body: { action, id: p.id, payload: edits, mode } })
    setBusy(false)
    const d = data as { ok?: boolean; result?: string; error?: string } | null
    setMsg(error ? 'Mislukt.' : d?.error ?? d?.result ?? (action === 'reject' ? 'Geweigerd.' : 'Uitgevoerd.'))
    onDone()
  }
  return (
    <div className={'panel prop prop-' + p.status}>
      <div className="prop-head">
        <span className="prop-kind">{KIND[p.kind] ?? p.kind}</span>
        <strong>{p.title}</strong>
        {p.project_code && <Link className="small" to={`/projecten/${encodeURIComponent(p.project_code)}`}>{p.project_code}</Link>}
        <span className="muted small">{new Date(p.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{p.source ? ` · via ${p.source}` : ''}</span>
      </div>
      {p.summary && !isMail && <p className="small">{p.summary}</p>}
      {isMail && <p className="small muted">Aan: {p.payload?.to_name} &lt;{p.payload?.to}&gt;{p.kind === 'mail_reply' ? ` · antwoord op “${p.payload?.subject ?? ''}” (vanuit ${p.payload?.mailbox})` : ''}</p>}
      {open ? (
        <>
          {p.kind === 'mail' && <input className="prop-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <textarea className="prop-body" rows={isMail ? 8 : 3} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={p.kind === 'job_reminder' ? 'Optioneel extra zinnetje' : p.kind === 'job_move' ? 'Reden (wordt meegestuurd)' : ''} />
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
        <p className={'small ' + (p.status === 'uitgevoerd' ? 'ok-t' : p.status === 'mislukt' ? 'bad-t' : 'muted')}>
          {p.status === 'uitgevoerd' ? '✓ Uitgevoerd' : p.status === 'mislukt' ? '⚠ Mislukt' : 'Geweigerd'}{p.result ? `: ${p.result}` : ''}
        </p>
      )}
      {msg && <p className="small">{msg}</p>}
    </div>
  )
}

export function VonPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'taken' ? 'taken' : 'voorstellen'
  const [props, setProps] = useState<Proposal[] | null>(null)
  const [hist, setHist] = useState(false)
  const load = useCallback(async () => {
    let q = supabase.from('von_proposals').select('*').order('created_at', { ascending: false }).limit(50)
    q = hist ? q.neq('status', 'voorstel') : q.eq('status', 'voorstel')
    const { data } = await q
    setProps((data as Proposal[]) ?? [])
  }, [hist])
  useEffect(() => { load() }, [load])
  return (
    <section>
      <h1>VON</h1>
      <p className="muted">Voorstellen van VON wachten hier op je goedkeuring. Niets gaat naar buiten zonder jouw klik.</p>
      <div className="seg">
        <button className={tab === 'voorstellen' ? 'on' : ''} onClick={() => setParams({})}>Voorstellen{props && !hist && props.length ? ` (${props.length})` : ''}</button>
        <button className={tab === 'taken' ? 'on' : ''} onClick={() => setParams({ tab: 'taken' })}>Taken</button>
      </div>
      {tab === 'taken' ? <Tasks /> : (
        <>
          <div className="toolbar"><button className="link small" onClick={() => setHist((h) => !h)}>{hist ? '← open voorstellen' : 'afgehandelde voorstellen'}</button></div>
          {props === null ? <p className="muted">Laden…</p> : props.length === 0 ? (
            <p className="muted">{hist ? 'Nog niets afgehandeld.' : 'Geen voorstellen. Vraag VON bv. "Herinner CBI om de opdracht te bevestigen" of "Stuur Jan een mail dat we volgende week meten".'}</p>
          ) : props.map((p) => <ProposalCard key={p.id} p={p} onDone={load} />)}
        </>
      )}
    </section>
  )
}
