import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { tradeLabel } from './NewRelation'

/** Relaties als contactkaarten: naam, wat ze doen, contact (mail, bel, WhatsApp) en hun projecten. Bewerken gebeurt in de tabel. */
type Row = Record<string, any>
type Proj = { project_code: string; client_id: string | null; title: string | null; phase_label: string | null; phase_active: boolean | null }

const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
const wa = (phone?: string | null) => (phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '32')

export function RelationCards({ table, onEdit }: { table: 'clients' | 'subcontractors' | 'partners'; onEdit: (id: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [projects, setProjects] = useState<Proj[]>([])
  const [search, setSearch] = useState('')
  useEffect(() => {
    setRows(null)
    supabase.from(table).select('*').then(({ data }) => setRows(data ?? []))
    if (table === 'clients') supabase.from('app_projects').select('project_code,client_id,title,phase_label,phase_active').then(({ data }) => setProjects((data as Proj[]) ?? []))
  }, [table])

  const list = useMemo(() => {
    const name = (r: Row) => table === 'clients' ? ([r.first_name, r.last_name].filter(Boolean).join(' ') || r.company || '—') : r.name ?? '—'
    const n = search.trim().toLowerCase()
    return (rows ?? [])
      .map((r) => ({ r, name: name(r) }))
      .filter(({ r, name }) => !n || [name, r.company, r.email, r.phone, r.city, r.trade, tradeLabel(r.trade), r.services, r.contact_person].some((v) => String(v ?? '').toLowerCase().includes(n)))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  }, [rows, search, table])

  if (rows === null) return <p className="muted">Laden…</p>
  return (
    <>
      <div className="rc-bar">
        <input className="search-input" placeholder="Zoek op naam, bedrijf, gemeente, e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted small">{list.length} van {rows.length}</span>
      </div>
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
                    <b>{name}</b>
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
                {projs.length > 0 && (
                  <div className="rc-projs">
                    {projs.map((p) => <Link key={p.project_code} to={`/projecten/${encodeURIComponent(p.project_code)}`} className={'rc-proj' + (p.phase_active === false ? ' done' : '')}><b>{p.project_code}</b> {p.phase_label}</Link>)}
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
