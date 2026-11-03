import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from './supabase'

/** Gebeurtenissenstroom (tabel `events`, gevuld door triggers in Supabase): "Recent" in de control tower, tijdlijn per project. */
type Ev = { id: number; at: string; kind: string; importance: number; project_code: string | null; title: string; detail: string | null; actor: string | null }

const ICON: Record<string, string> = {
  aanvraag_nieuw: '👤', project_nieuw: '📁', fase: '➜', versie_nieuw: '📐', kosten_klaar: '€', berekening_fout: '⚠',
  opdracht: '📅', mail_probleem: '✉', vragenlijst: '📝', backup: '💾', von_voorstel: '✨', von_actie: '✓', mail_in: '📨', afspraak_antwoord: '📅',
}
const when = (iso: string) => {
  const d = new Date(iso), now = new Date()
  const same = d.toDateString() === now.toDateString()
  const yest = new Date(now.getTime() - 864e5).toDateString() === d.toDateString()
  const hm = d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  return same ? hm : yest ? `gisteren ${hm}` : d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) + ` ${hm}`
}

export function EventFeed({ project, limit = 12, title = 'Recent' }: { project?: string; limit?: number; title?: string }) {
  const [evs, setEvs] = useState<Ev[] | null>(null)
  const [all, setAll] = useState(false)

  useEffect(() => {
    let q = supabase.from('events').select('id,at,kind,importance,project_code,title,detail,actor').order('at', { ascending: false }).limit(all ? 100 : limit)
    if (project) q = q.eq('project_code', project)
    else q = q.lt('importance', 3)
    q.then(({ data }) => setEvs((data as Ev[]) ?? []))
  }, [project, limit, all])

  return (
    <div className="panel ev-feed">
      <h2>{title}</h2>
      {evs === null ? <p className="muted small">Laden…</p> : evs.length === 0 ? (
        <p className="muted small">{project ? 'Nog geen gebeurtenissen voor dit project.' : 'Nog niets gebeurd.'}</p>
      ) : (
        <ul className="ev-list">
          {evs.map((e) => (
            <li key={e.id} className={'imp' + e.importance}>
              <span className="ev-ico" aria-hidden="true">{ICON[e.kind] ?? '•'}</span>
              <span className="ev-main">
                <span>{e.title}</span>
                <span className="muted small">
                  {when(e.at)}
                  {!project && e.project_code && <> · <Link to={`/projecten/${encodeURIComponent(e.project_code)}`}>{e.project_code}</Link></>}
                  {e.detail && <> · {e.detail}</>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {evs && evs.length >= limit && !all && <button className="link small" onClick={() => setAll(true)}>Meer tonen</button>}
    </div>
  )
}
