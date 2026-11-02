import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../core/supabase'
import type { ProjectRow } from '../../core/projects'
import { useQuery } from '../../core/useQuery'

type Client = { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null; street: string | null; postal_code: string | null; city: string | null }

const FIELDS: { key: keyof Client; label: string; type?: string; placeholder?: string; wide?: boolean }[] = [
  { key: 'first_name', label: 'Voornaam' },
  { key: 'last_name', label: 'Naam' },
  { key: 'email', label: 'E-mail', type: 'email', placeholder: 'naam@voorbeeld.be', wide: true },
  { key: 'phone', label: 'Telefoon', type: 'tel' },
  { key: 'company', label: 'Bedrijf' },
  { key: 'street', label: 'Straat', wide: true },
  { key: 'postal_code', label: 'Postcode' },
  { key: 'city', label: 'Gemeente' },
]

/** Klantgegevens bij een project; elk veld wordt bewaard zodra je het verlaat. */
export function ClientPanel({ project, focus, onSaved }: { project: ProjectRow; focus: string | null; onSaved: () => void }) {
  const q = useQuery<Client>(() => supabase.from('clients').select('id, first_name, last_name, company, email, phone, street, postal_code, city').eq('id', project.client_id).single(), [project.client_id])
  const [msg, setMsg] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (focus && q.data) box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [focus, q.data])
  if (!q.data) return null
  const c = q.data
  const save = async (key: keyof Client, value: string) => {
    const v = value.trim() === '' ? null : value.trim()
    if (v === (c[key] ?? null)) return
    const { error } = await supabase.from('clients').update({ [key]: v }).eq('id', c.id)
    setMsg(error ? 'Niet bewaard: ' + error.message : 'Bewaard')
    q.reload()
    onSaved()
  }
  return (
    <div ref={box} className={'panel client-panel' + (focus ? ' focus' : '')}>
      <h2>Klant {project.client_number != null && <span className="muted">nr. {project.client_number}</span>}</h2>
      {focus === 'email' && !c.email && <p className="notice">Vul het e-mailadres van de klant in. Daarmee kan je de klant later uitnodigen voor het klantenportaal.</p>}
      <div className="form-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className={f.wide ? 'wide' : undefined}>
            {f.label}
            <input
              type={f.type ?? 'text'}
              defaultValue={c[f.key] ?? ''}
              placeholder={f.placeholder}
              autoFocus={focus === f.key}
              className={focus === f.key && !c[f.key] ? 'focus-input' : undefined}
              onBlur={(e) => save(f.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          </label>
        ))}
      </div>
      {msg && <p className="muted small">{msg}</p>}
    </div>
  )
}
