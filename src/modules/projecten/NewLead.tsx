import { useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../../core/supabase'
import { DateTimeInput } from '../../core/DateInput'

/** Nieuwe aanvraag met de hand (de Bookings-koppeling doet hetzelfde automatisch). */
export function NewLead({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', phone: '', source: '', intro: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('create_lead', {
      p_name: f.name, p_email: f.email || null, p_phone: f.phone || null, p_source: f.source || null,
      p_intro_at: f.intro ? new Date(f.intro).toISOString() : null, p_notes: f.notes || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    nav(`/projecten/${encodeURIComponent(String(data))}`)
  }
  return (
    <div className="survey-overlay" onClick={onClose}>
      <form className="panel new-lead" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Nieuwe aanvraag</h2>
        <p className="muted">Maakt de klant en het project aan, met een nieuwe projectcode. Gebruik die code ook in PaletteCAD (veld "Project").</p>
        <div className="form-grid">
          <label className="wide">Naam<input required value={f.name} onChange={set('name')} /></label>
          <label>E-mail<input type="email" value={f.email} onChange={set('email')} /></label>
          <label>Telefoon<input type="tel" value={f.phone} onChange={set('phone')} /></label>
          <label>Bron<select value={f.source} onChange={set('source')}><option value=""></option>{['WhatsApp', 'Bookings', 'Telefoon', 'Website', 'Aanbeveling', 'Instagram', 'Andere'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Kennismaking<DateTimeInput value={f.intro} onChange={set('intro')} /></label>
          <label className="wide">Notitie<textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="survey-nav"><button type="button" onClick={onClose}>Annuleren</button><button className="primary" disabled={busy}>Aanmaken</button></div>
      </form>
    </div>
  )
}
