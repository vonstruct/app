import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../../core/supabase'
import { DateTimeInput } from '../../core/DateInput'

/**
 * "Aanvraag of project" (8 nov 2026): één formulier in plaats van "Nieuwe aanvraag" + "Nieuw project".
 * Klant zoeken (naam, e-mail, telefoon) of een nieuwe persoon; standaard begint het in de stap Aanvraag.
 * RPC create_request herkent een bestaande persoon ook zelf op e-mail of telefoon (geen dubbels).
 */
type Client = { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null }
type Proj = { project_code: string; title: string | null; phase_label: string | null; phase_active: boolean | null }

const nameOf = (c: Client) => [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company || '—'
/** zelfde als phone_key() in de database: de laatste 9 cijfers (0470… = +32 470…) */
const phoneKey = (p?: string | null) => { const d = (p ?? '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-9) : null }
const SOURCES = ['WhatsApp', 'Telefoon', 'Bookings', 'Website', 'Aanbeveling', 'Instagram', 'Andere']
const PHASES: [string, string][] = [['lead', 'Aanvraag'], ['design', 'Ontwerp'], ['quote', 'Offerte'], ['signed', 'Voorbereiding'], ['production', 'Productie'], ['installation', 'Plaatsing']]

export function NewRequest({ onClose, initialClient, onCreated }: { onClose: () => void; initialClient?: string; onCreated?: (code: string) => void }) {
  const nav = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [pick, setPick] = useState<string>(initialClient ?? '')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ name: '', email: '', phone: '', title: '', source: '', intro: '', phase: 'lead', code: '', notes: '' })
  const [projs, setProjs] = useState<Proj[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('clients').select('id,first_name,last_name,company,email,phone').then(({ data }) => setClients((data as Client[]) ?? []))
  }, [])
  // lopende projecten van de gekozen persoon (één verzoek)
  useEffect(() => {
    if (!pick) { setProjs([]); return }
    supabase.from('app_projects').select('project_code,title,phase_label,phase_active').eq('client_id', pick).then(({ data }) => setProjs((data as Proj[]) ?? []))
  }, [pick])
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const chosen = clients.find((c) => c.id === pick) ?? null
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase(), pk = phoneKey(q)
    if (n.length < 2) return []
    return clients.filter((c) => [nameOf(c), c.company, c.email].some((v) => (v ?? '').toLowerCase().includes(n)) || (pk && phoneKey(c.phone) === pk)).slice(0, 6)
  }, [q, clients])
  // bestaat de nieuwe persoon al? (zelfde e-mail of telefoon)
  const twin = useMemo(() => {
    if (chosen) return null
    const em = f.email.trim().toLowerCase(), pk = phoneKey(f.phone)
    return clients.find((c) => (em && (c.email ?? '').toLowerCase() === em) || (pk && phoneKey(c.phone) === pk)) ?? null
  }, [f.email, f.phone, clients, chosen])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chosen && !f.name.trim() && !twin) return setErr('Kies een bestaande klant of geef een naam.')
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('create_request', {
      p_client_id: chosen?.id ?? twin?.id ?? null,
      p_name: chosen ? null : f.name || null, p_email: chosen ? null : f.email || null, p_phone: chosen ? null : f.phone || null,
      p_title: f.title || null, p_source: f.source || null, p_intro_at: f.intro ? new Date(f.intro).toISOString() : null,
      p_phase: f.phase, p_code: f.code || null, p_notes: f.notes || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    const code = String(data)
    onCreated?.(code)
    nav(`/projecten/${encodeURIComponent(code)}`)
  }

  const open = projs.filter((p) => p.phase_active !== false)
  return (
    <div className="survey-overlay" onClick={onClose}>
      <form className="panel new-lead nr" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Aanvraag of project</h2>
        <p className="muted small">Iemand vraagt iets (WhatsApp, telefoon, mail)? Dan blijft de stap op <b>Aanvraag</b>. Instappen in een project dat al loopt kan ook: kies dan een latere stap.</p>

        <div className="nr-block">
          <span className="nr-lbl">Klant</span>
          {chosen ? (
            <div className="nr-chosen">
              <div><b>{nameOf(chosen)}</b><span className="muted small">{[chosen.email, chosen.phone].filter(Boolean).join(' · ') || 'geen e-mail of telefoon'}</span></div>
              <button type="button" className="link small" onClick={() => { setPick(''); setQ('') }}>andere</button>
            </div>
          ) : (
            <>
              <input className="nr-search" placeholder="Zoek een bestaande klant: naam, e-mail of telefoon" value={q} onChange={(e) => setQ(e.target.value)} />
              {hits.length > 0 && (
                <div className="nr-hits">
                  {hits.map((c) => <button type="button" key={c.id} onClick={() => setPick(c.id)}><b>{nameOf(c)}</b><span className="muted small">{[c.email, c.phone].filter(Boolean).join(' · ')}</span></button>)}
                </div>
              )}
              <span className="nr-or muted small">of een nieuwe persoon:</span>
              <div className="form-grid">
                <label className="wide">Naam<input value={f.name} onChange={set('name')} placeholder="Voor- en achternaam" /></label>
                <label>Telefoon<input type="tel" value={f.phone} onChange={set('phone')} /></label>
                <label>E-mail<input type="email" value={f.email} onChange={set('email')} /></label>
              </div>
              {twin && <p className="nr-twin small">Deze persoon bestaat al: <b>{nameOf(twin)}</b> ({[twin.email, twin.phone].filter(Boolean).join(' · ')}). <button type="button" className="link small" onClick={() => setPick(twin.id)}>Deze kiezen</button></p>}
            </>
          )}
          {open.length > 0 && <p className="muted small nr-open">Loopt al: {open.map((p) => `${p.project_code} ${p.title ?? ''} (${p.phase_label ?? ''})`).join(' · ')}</p>}
        </div>

        <div className="form-grid">
          <label className="wide">Waar gaat het over?<input value={f.title} onChange={set('title')} placeholder="bv. Houten terras, ± 30 m²" /></label>
          <label>Bron<select value={f.source} onChange={set('source')}><option value=""></option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Kennismaking<DateTimeInput value={f.intro} onChange={set('intro')} /></label>
          <label>Stap<select value={f.phase} onChange={set('phase')}>{PHASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Projectnummer<input placeholder="leeg = volgend nummer" value={f.code} onChange={set('code')} /></label>
          <label className="wide">Notitie<textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="survey-nav"><button type="button" onClick={onClose}>Annuleren</button><button className="primary" disabled={busy}>{busy ? 'Bezig…' : 'Aanmaken'}</button></div>
      </form>
    </div>
  )
}
