import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'

type Mail = { email_id: string; to_email: string | null; subject: string | null; status: string; reason: string | null; seen: boolean; created_at: string; updated_at: string }
const ST: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Verstuurd', cls: '' },
  delivered: { label: '✓ Aangekomen', cls: 'ok' },
  delayed: { label: 'Vertraagd', cls: 'warn' },
  bounced: { label: 'Geweigerd', cls: 'bad' },
  complained: { label: 'Als spam gemeld', cls: 'bad' },
  failed: { label: 'Niet verstuurd', cls: 'bad' },
}

/** Alle mails van de app (via Resend) en of ze aangekomen zijn. Gevuld door de Resend-webhook. */
export function Mails() {
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const [onlyProblems, setOnlyProblems] = useState(false)
  const q = useQuery<Mail[]>(() => {
    let b = supabase.from('mail_events').select('*').order('created_at', { ascending: false }).limit(200)
    if (onlyProblems) b = b.in('status', ['delayed', 'bounced', 'complained', 'failed'])
    return b
  }, [onlyProblems])
  const seen = async (id: string) => { await supabase.from('mail_events').update({ seen: true }).eq('email_id', id); q.reload() }
  if (focus) return <Navigate to={`/inbox?focus=${focus}`} replace />
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Mails</h1>
          <p className="muted">Alles wat de app verstuurt (uitnodigingen, opdrachten, bevestigingen …) en of het aangekomen is. Gegevens van Resend.</p>
        </div>
        <label className="check"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Enkel problemen</label>
      </div>
      <ErrorBox error={q.error} />
      {q.loading ? <Loading /> : (q.data ?? []).length === 0 ? (
        <p className="muted">{onlyProblems ? 'Geen problemen. Alle mails zijn aangekomen.' : 'Nog geen gegevens. Zodra de Resend-webhook actief is, verschijnt hier elke mail.'}</p>
      ) : (
        <div className="mails">
          {(q.data ?? []).map((m) => {
            const s = ST[m.status] ?? { label: m.status, cls: '' }
            const problem = ['delayed', 'bounced', 'complained', 'failed'].includes(m.status)
            return (
              <div key={m.email_id} className={'mail-row ' + s.cls}>
                <span className={'mail-st ' + s.cls}>{s.label}</span>
                <span className="mail-main">
                  <strong>{m.subject ?? '(zonder onderwerp)'}</strong>
                  <span className="muted small">aan {m.to_email ?? '?'}{m.reason ? ` · ${m.reason}` : ''}</span>
                </span>
                <span className="mail-side">
                  <span className="muted small">{new Date(m.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {problem && !m.seen && <button className="link small" onClick={() => seen(m.email_id)}>Gezien (weg uit control tower)</button>}
                  <a className="small" href={`https://resend.com/emails/${m.email_id}`} target="_blank" rel="noreferrer">In Resend</a>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
