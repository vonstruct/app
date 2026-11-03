import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from './supabase'

/** Zoeken overal (knop in de kopbalk of Ctrl/⌘ K): projecten, klanten, onderaannemers, partners, opdrachten, mails. */
type Hit = { group: string; id: string; title: string; sub?: string; to: string }

async function search(term: string): Promise<Hit[]> {
  const s = `%${term.replace(/[,()%]/g, ' ').trim()}%`
  const [p, c, sc, pa, j, m] = await Promise.all([
    supabase.from('app_projects').select('project_code,title,client_name,site_city,phase_label').or(`project_code.ilike.${s},title.ilike.${s},client_name.ilike.${s},site_city.ilike.${s}`).limit(6),
    supabase.from('clients').select('id,first_name,last_name,company,email,phone,city').or(`first_name.ilike.${s},last_name.ilike.${s},company.ilike.${s},email.ilike.${s},phone.ilike.${s}`).limit(5),
    supabase.from('subcontractors').select('id,name,trade,email').or(`name.ilike.${s},trade.ilike.${s},email.ilike.${s}`).limit(4),
    supabase.from('partners').select('id,name,services,email').or(`name.ilike.${s},email.ilike.${s}`).limit(3),
    supabase.from('jobs').select('id,title,project_code,start_at').ilike('title', s).order('start_at', { ascending: false }).limit(4),
    supabase.from('mail_messages').select('id,subject,from_name,at,summary').or(`subject.ilike.${s},from_name.ilike.${s},from_email.ilike.${s}`).eq('is_bulk', false).order('at', { ascending: false }).limit(5),
  ])
  const d = (iso: string) => new Date(iso).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
  return [
    ...(p.data ?? []).map((r: any) => ({ group: 'Projecten', id: 'p' + r.project_code, title: `${r.project_code} · ${r.client_name ?? r.title ?? ''}`, sub: [r.title, r.site_city, r.phase_label].filter(Boolean).join(' · '), to: `/projecten/${encodeURIComponent(r.project_code)}` })),
    ...(c.data ?? []).map((r: any) => ({ group: 'Klanten', id: 'c' + r.id, title: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.company, sub: [r.company, r.email, r.phone, r.city].filter(Boolean).join(' · '), to: `/relaties?tab=klanten&focus=${r.id}:email` })),
    ...(sc.data ?? []).map((r: any) => ({ group: 'Onderaannemers', id: 's' + r.id, title: r.name, sub: [r.trade, r.email].filter(Boolean).join(' · '), to: `/relaties?tab=onderaannemers&focus=${r.id}:email` })),
    ...(pa.data ?? []).map((r: any) => ({ group: 'Partners', id: 'a' + r.id, title: r.name, sub: [r.services, r.email].filter(Boolean).join(' · '), to: `/relaties?tab=partners&focus=${r.id}:email` })),
    ...(j.data ?? []).map((r: any) => ({ group: 'Opdrachten', id: 'j' + r.id, title: r.title, sub: [r.project_code, r.start_at && d(r.start_at)].filter(Boolean).join(' · '), to: `/opdrachten?focus=${r.id}` })),
    ...(m.data ?? []).map((r: any) => ({ group: 'Mails', id: 'm' + r.id, title: r.subject ?? '(zonder onderwerp)', sub: [r.from_name, d(r.at), r.summary].filter(Boolean).join(' · '), to: `/inbox?focus=${r.id}` })),
  ]
}

export function SearchButton() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <>
      <button className="tb-search" onClick={() => setOpen(true)} aria-label="Zoeken">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
        <span>Zoek project, klant, mail…</span><kbd>Ctrl K</kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    if (term.trim().length < 2) { setHits(null); return }
    let alive = true
    const t = setTimeout(() => search(term).then((h) => { if (alive) { setHits(h); setSel(0) } }), 220)
    return () => { alive = false; clearTimeout(t) }
  }, [term])
  const go = (h: Hit) => { onClose(); nav(h.to) }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (!hits?.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') go(hits[sel])
  }
  const groups = [...new Set((hits ?? []).map((h) => h.group))]
  return (
    <div className="sr-overlay" onMouseDown={onClose}>
      <div className="sr-box" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Zoeken">
        <input id="global-search" ref={input} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={key} placeholder="Zoek op projectcode, klant, gemeente, onderaannemer, opdracht of mail…" />
        <div className="sr-list">
          {hits === null ? <p className="muted small sr-hint">Typ minstens 2 letters. ↑↓ om te kiezen, Enter om te openen, Esc om te sluiten.</p>
            : hits.length === 0 ? <p className="muted small sr-hint">Niets gevonden voor "{term}".</p>
            : groups.map((g) => (
              <div key={g}>
                <div className="sr-group">{g}</div>
                {hits.filter((h) => h.group === g).map((h) => {
                  const i = hits.indexOf(h)
                  return (
                    <button key={h.id} className={'sr-hit' + (i === sel ? ' on' : '')} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
                      <span className="sr-t">{h.title}</span>{h.sub && <span className="sr-s">{h.sub}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
