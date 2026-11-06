import { Link } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../core/supabase'
import type { ProjectRow } from '../../core/projects'
import { useQuery } from '../../core/useQuery'

type Client = { id: string; first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null; street: string | null; postal_code: string | null; city: string | null; language: string | null }

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
  const q = useQuery<Client>(() => supabase.from('clients').select('id, first_name, last_name, company, email, phone, street, postal_code, city, language').eq('id', project.client_id).single(), [project.client_id])
  const [msg, setMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  // vinkje "werf = adres van de klant" (projects.site_same_as_client; de database neemt het klantadres over, ook bij latere wijzigingen)
  const sq = useQuery<{ site_same_as_client: boolean } | null>(async () => {
    const { data, error } = await supabase.from('projects').select('site_same_as_client').eq('project_code', project.project_code).maybeSingle()
    return { data: data as { site_same_as_client: boolean } | null, error }
  }, [project.project_code])
  const same = sq.data?.site_same_as_client ?? false
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
  // adres van de werf staat op het project (projects.site_*)
  const saveSite = async (key: 'site_street' | 'site_postal_code' | 'site_city', value: string) => {
    const v = value.trim() === '' ? null : value.trim()
    if (v === (project[key] ?? null)) return
    const { error } = await supabase.from('projects').update({ [key]: v }).eq('project_code', project.project_code)
    setMsg(error ? 'Niet bewaard: ' + error.message : 'Bewaard')
    onSaved()
  }
  const site = [project.site_street, [project.site_postal_code, project.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const setSame = async (on: boolean) => {
    const { error } = await supabase.from('projects').update({ site_same_as_client: on }).eq('project_code', project.project_code)
    setMsg(error ? 'Niet bewaard: ' + error.message : on ? 'Werf = adres van de klant' : 'Bewaard')
    sq.reload(); onSaved()
  }
  // gewoon bekijken = korte kaart; volledige gegevens bij Relaties. Komt de gebruiker voor een ontbrekend veld (focus), dan het formulier.
  if (!focus && !editing) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company || '—'
    const addr = [c.street, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    return (
      <div className="panel client-panel compact">
        <div className="tasks-head">
          <h2>Klant {project.client_number != null && <span className="muted">nr. {project.client_number}</span>}</h2>
          <span className="small"><button className="link small" onClick={() => setEditing(true)}>aanpassen</button> · <Link to={`/relaties?tab=klanten&focus=${c.id}:last_name`}>bij Relaties</Link></span>
        </div>
        <div className="cp-lines">
          <b>{name}{c.company && (c.first_name || c.last_name) ? <span className="muted"> · {c.company}</span> : null}</b>
          {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <button className="link small bad-txt" onClick={() => setEditing(true)}>geen e-mailadres: invullen</button>}
          {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
          {addr && <span className="muted">{addr}</span>}
          {c.language && c.language !== 'nl' && <span className="muted">Taal: {c.language === 'en' ? 'Engels' : 'Duits'}</span>}
          <span className="muted">Werf: {same ? 'zelfde als het adres van de klant' : site || <button className="link small bad-txt" onClick={() => setEditing(true)}>adres van de werf invullen</button>}</span>
        </div>
      </div>
    )
  }
  return (
    <div ref={box} className={'panel client-panel' + (focus ? ' focus' : '')}>
      <h2>Klant {project.client_number != null && <span className="muted">nr. {project.client_number}</span>}</h2>
      {focus === 'gegevens' && <p className="notice">Vul de gegevens in die nog ontbreken (oranje omrand). Elk veld wordt bewaard zodra je het verlaat.</p>}
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
              className={(focus === f.key || (focus === 'gegevens' && ['street', 'postal_code', 'city', 'phone'].includes(f.key))) && !c[f.key] ? 'focus-input' : undefined}
              onBlur={(e) => save(f.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          </label>
        ))}
        <label>
          Taal van de klant
          <select value={c.language ?? 'nl'} onChange={(e) => save('language', e.target.value)}>
            <option value="nl">Nederlands</option>
            <option value="en">Engels</option>
            <option value="de">Duits</option>
          </select>
        </label>
        <h3 className="wide cp-site">Adres van de werf <span className="muted small">(staat op opdrachten en het PV)</span></h3>
        <label className="wide check cp-same"><input type="checkbox" checked={same} disabled={!sq.data} onChange={(e) => setSame(e.target.checked)} /> Zelfde als het adres van de klant</label>
        {same ? <p className="wide muted small cp-same-addr">{[c.street, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Het adres van de klant is nog leeg: vul het hierboven in.'}</p> : ([['site_street', 'Straat', true], ['site_postal_code', 'Postcode', false], ['site_city', 'Gemeente', false]] as const).map(([k, label, wide]) => (
          <label key={k} className={wide ? 'wide' : undefined}>
            {label}
            <input key={k + (project[k] ?? '')} defaultValue={project[k] ?? ''} className={focus === 'gegevens' && !project[k] ? 'focus-input' : undefined}
              onBlur={(e) => saveSite(k, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
          </label>
        ))}
      </div>
      <p className="muted small">De taal bepaalt de mails, de berichten en het klantenportaal (de klant kan daar zelf ook wisselen).</p>
      {msg && <p className="muted small">{msg}</p>}
      {editing && !focus && <button className="link small" onClick={() => setEditing(false)}>klaar</button>}
    </div>
  )
}
