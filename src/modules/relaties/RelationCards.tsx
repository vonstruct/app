import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { tradeLabel } from './NewRelation'
import { YukiHistory } from '../../core/YukiHistory'
import { openNew } from '../../core/NewMenu'

/** Relaties als contactkaarten: naam, wat ze doen, contact (mail, bel, WhatsApp) en hun projecten. Bewerken gebeurt in de tabel. */
type Row = Record<string, any>
type Proj = { project_code: string; client_id: string | null; title: string | null; phase_label: string | null; phase_active: boolean | null }

/** Aanvrager of klant (7 nov 2026): klant = er is een offerte verstuurd (of al gefactureerd in Yuki). View app_client_status. */
type Status = 'klant' | 'aanvrager' | 'niet doorgegaan' | 'contact'
const STATUS_LABEL: Record<Status, string> = { klant: 'Klant', aanvrager: 'Aanvrager', 'niet doorgegaan': 'Niet doorgegaan', contact: 'Zonder project' }
const FILTERS: [Status | 'alle', string][] = [['alle', 'Alle'], ['klant', 'Klanten'], ['aanvrager', 'Aanvragers'], ['niet doorgegaan', 'Niet doorgegaan'], ['contact', 'Zonder project']]

const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
const wa = (phone?: string | null) => (phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '32')

export function RelationCards({ table, onEdit }: { table: 'clients' | 'subcontractors' | 'partners'; onEdit: (id: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [projects, setProjects] = useState<Proj[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [only, setOnly] = useState<Status | 'alle'>('alle')
  useEffect(() => {
    setRows(null)
    supabase.from(table).select('*').then(({ data }) => setRows(data ?? []))
    if (table === 'clients') {
      supabase.from('app_projects').select('project_code,client_id,title,phase_label,phase_active').then(({ data }) => setProjects((data as Proj[]) ?? []))
      // één verzoek voor de hele lijst (nooit per kaart)
      supabase.from('app_client_status').select('client_id,status').then(({ data }) => setStatus(Object.fromEntries(((data ?? []) as { client_id: string; status: Status }[]).map((x) => [x.client_id, x.status]))))
    }
  }, [table])

  const list = useMemo(() => {
    const name = (r: Row) => table === 'clients' ? ([r.first_name, r.last_name].filter(Boolean).join(' ') || r.company || '—') : r.name ?? '—'
    const n = search.trim().toLowerCase()
    return (rows ?? [])
      .map((r) => ({ r, name: name(r) }))
      .filter(({ r, name }) => !n || [name, r.company, r.email, r.phone, r.city, r.trade, tradeLabel(r.trade), r.services, r.contact_person].some((v) => String(v ?? '').toLowerCase().includes(n)))
      .filter(({ r }) => table !== 'clients' || only === 'alle' || status[r.id] === only)
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  }, [rows, search, table, only, status])

  if (rows === null) return <p className="muted">Laden…</p>
  return (
    <>
      <div className="rc-bar">
        <input className="search-input" placeholder="Zoek op naam, bedrijf, gemeente, e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted small">{list.length} van {rows.length}</span>
      </div>
      {table === 'clients' && (
        <div className="seg rc-filter" role="group" aria-label="Soort">
          {FILTERS.map(([k, label]) => {
            const n = k === 'alle' ? rows.length : rows.filter((r) => status[r.id] === k).length
            return (k === 'alle' || n > 0) && <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{label} <span className="muted">{n}</span></button>
          })}
        </div>
      )}
      {list.length === 0 ? <p className="muted">Niemand gevonden.</p> : (
        <div className="rc-grid">
          {list.map(({ r, name }) => {
            const sub = table === 'clients' ? [r.company, r.city].filter(Boolean).join(' · ') : [tradeLabel(r.trade) ?? r.services, r.contact_person, r.city].filter(Boolean).join(' · ')
            const projs = table === 'clients' ? projects.filter((p) => p.client_id === r.id) : []
            const inactive = r.active === false
            return (
              <article key={r.id} className={'rc' + (inactive ? ' inactive' : '')}>
                <div className="rc-top">
                  <span className="rc-av">{initials(name)}</span>
                  <div className="rc-who">
                    <b>{name}{table === 'clients' && status[r.id] && <span className={'rc-status ' + status[r.id].replace(' ', '-')}>{STATUS_LABEL[status[r.id]]}</span>}</b>
                    {sub && <span className="muted small">{sub}</span>}
                  </div>
                  <button className="link small rc-edit" onClick={() => onEdit(r.id)}>Bewerken</button>
                </div>
                <div className="rc-contact">
                  {r.email ? <span className="rc-line">{r.email}</span> : <span className="rc-line missing">geen e-mailadres</span>}
                  {r.phone && <span className="rc-line">{r.phone}</span>}
                </div>
                <div className="rc-acts">
                  {r.email && <a className="rc-btn" href={`mailto:${r.email}`}>Mail</a>}
                  {r.phone && <a className="rc-btn" href={`tel:${r.phone}`}>Bel</a>}
                  {r.phone && wa(r.phone) && <a className="rc-btn wa" href={`https://wa.me/${wa(r.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {table === 'clients' && r.language && r.language !== 'nl' && <span className="rc-lang">{String(r.language).toUpperCase()}</span>}
                  {inactive && <span className="rc-lang">niet actief</span>}
                </div>
                {table === 'clients' && <YukiHistory clientId={r.id} compact />}
                {table === 'clients' && (
                  <div className="rc-projs">
                    {projs.map((p) => <Link key={p.project_code} to={`/projecten/${encodeURIComponent(p.project_code)}`} className={'rc-proj' + (p.phase_active === false ? ' done' : '')}><b>{p.project_code}</b> {p.title ? p.title + ' · ' : ''}{p.phase_label}</Link>)}
                    {!projs.length && <span className="muted small">Nog geen project in de app.</span>}
                    <button type="button" onClick={() => openNew({ kind: 'aanvraag', client: r.id })} className="rc-proj add">+ Aanvraag of project</button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
