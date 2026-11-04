import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../../core/supabase'

type Client = { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null }
const label = (c: Client) => [c.company, [c.first_name, c.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' · ') + (c.email ? ` (${c.email})` : '')
const PHASES: [string, string][] = [['design', 'Ontwerp'], ['lead', 'Aanvraag'], ['quote', 'Offerte'], ['signed', 'Voorbereiding'], ['production', 'Productie'], ['installation', 'Plaatsing']]

/** Project met de hand aanmaken (bestaande of nieuwe klant, eigen fase en eventueel eigen projectcode). RPC create_project. */
export function NewProject({ onClose, initialClient }: { onClose: () => void; initialClient?: string }) {
  const nav = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [mode, setMode] = useState<'bestaand' | 'nieuw'>('bestaand')
  const [f, setF] = useState({ client: initialClient ?? '', name: '', email: '', phone: '', title: '', phase: 'design', code: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('clients').select('id,first_name,last_name,company,email').order('last_name').then(({ data }) => setClients((data as Client[]) ?? []))
  }, [])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'bestaand' && !f.client) return setErr('Kies een klant.')
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('create_project', {
      p_client_id: mode === 'bestaand' ? f.client : null,
      p_name: mode === 'nieuw' ? f.name : null, p_email: mode === 'nieuw' ? f.email || null : null, p_phone: mode === 'nieuw' ? f.phone || null : null,
      p_title: f.title || null, p_phase: f.phase, p_code: f.code || null, p_notes: f.notes || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    nav(`/projecten/${encodeURIComponent(String(data))}`)
  }

  return (
    <div className="survey-overlay" onClick={onClose}>
      <form className="panel new-lead" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Nieuw project</h2>
        <p className="muted">Voor een project dat niet via een aanvraag binnenkomt. Gebruik de projectcode ook in PaletteCAD (veld "Project").</p>
        <div className="segmented">
          <button type="button" className={mode === 'bestaand' ? 'on' : ''} onClick={() => setMode('bestaand')}>Bestaande klant</button>
          <button type="button" className={mode === 'nieuw' ? 'on' : ''} onClick={() => setMode('nieuw')}>Nieuwe klant</button>
        </div>
        <div className="form-grid">
          {mode === 'bestaand' ? (
            <label className="wide">Klant
              <select required value={f.client} onChange={set('client')}>
                <option value="">Kies een klant…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className="wide">Naam klant<input required value={f.name} onChange={set('name')} /></label>
              <label>E-mail<input type="email" value={f.email} onChange={set('email')} /></label>
              <label>Telefoon<input type="tel" value={f.phone} onChange={set('phone')} /></label>
            </>
          )}
          <label className="wide">Omschrijving<input placeholder="bv. Keuken en berging" value={f.title} onChange={set('title')} /></label>
          <label>Fase<select value={f.phase} onChange={set('phase')}>{PHASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Projectcode<input placeholder="leeg = volgend nummer" value={f.code} onChange={set('code')} /></label>
          <label className="wide">Notitie<textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="survey-nav"><button type="button" onClick={onClose}>Annuleren</button><button className="primary" disabled={busy}>Aanmaken</button></div>
      </form>
    </div>
  )
}
