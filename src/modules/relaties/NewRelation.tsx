import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { toast } from '../../core/toast'

/** Nieuwe klant, onderaannemer of partner: kort formulier (naam verplicht; onderaannemer ook het vak). Met e-mailadres = later toegang tot het portaal. */
export type RelTable = 'clients' | 'subcontractors' | 'partners'

export const TRADES: Record<string, string> = {
  electrical: 'Elektricien', plumbing: 'Loodgieter / sanitair', technical: 'Technieken', painting: 'Schilder', tiling: 'Tegelzetter',
  plastering: 'Plafonneerder', joinery: 'Schrijnwerker', glass: 'Glas', stonework: 'Natuursteen', interior: 'Interieur',
  contractor: 'Aannemer', welding: 'Lasser / metaal', moving: 'Transport / verhuis',
}
export const tradeLabel = (t?: string | null) => (t ? TRADES[t] ?? t : null)

const TITLE: Record<RelTable, string> = { clients: 'Nieuwe klant', subcontractors: 'Nieuwe onderaannemer', partners: 'Nieuwe partner' }

export function NewRelation({ table, onDone, onCancel }: { table: RelTable; onDone: (id: string) => void; onCancel: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ language: 'nl' })
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }))
  const inp = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input value={f[k] ?? ''} onChange={set(k)} {...props} /></label>
  )
  const isClient = table === 'clients'
  const nameOk = isClient ? !!(f.first_name?.trim() || f.last_name?.trim() || f.company?.trim()) : !!f.name?.trim()
  const tradeOk = table !== 'subcontractors' || !!(f.trade === '_ander' ? f.trade_other?.trim() : f.trade)
  const emailOk = !f.email?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())

  const save = async () => {
    if (!nameOk || !tradeOk || !emailOk) return
    setBusy(true)
    const clean = (v?: string) => (v?.trim() ? v.trim() : null)
    const common = { email: clean(f.email)?.toLowerCase() ?? null, phone: clean(f.phone), street: clean(f.street), postal_code: clean(f.postal_code), city: clean(f.city), notes: clean(f.notes) }
    const row: Record<string, unknown> & { email: string | null } = isClient
      ? { ...common, first_name: clean(f.first_name), last_name: clean(f.last_name), company: clean(f.company), language: f.language || 'nl' }
      : table === 'subcontractors'
        ? { ...common, name: f.name.trim(), trade: f.trade === '_ander' ? f.trade_other.trim() : f.trade, contact_person: clean(f.contact_person), vat_number: clean(f.vat_number), active: true }
        : { ...common, name: f.name.trim(), services: clean(f.services), contact_person: clean(f.contact_person), vat_number: clean(f.vat_number), active: true }
    // dubbel e-mailadres? eerst nakijken
    if (row.email) {
      const { data: dup } = await supabase.from(table).select('id').ilike('email', row.email).limit(1)
      if (dup?.length && !confirm('Er bestaat al een relatie met dit e-mailadres. Toch toevoegen?')) { setBusy(false); return }
    }
    const { data, error } = await supabase.from(table).insert(row).select('id').single()
    setBusy(false)
    if (error) { toast(error.message, 'err'); return }
    toast('Toegevoegd')
    onDone((data as { id: string }).id)
  }

  return (
    <div className="card new-rel">
      <h3>{TITLE[table]}</h3>
      <div className="new-rel-grid">
        {isClient ? <>
          {inp('first_name', 'Voornaam', { autoFocus: true })}
          {inp('last_name', 'Naam')}
          {inp('company', 'Bedrijf (optioneel)')}
          <label>Taal<select value={f.language} onChange={set('language')}><option value="nl">Nederlands</option><option value="en">English</option><option value="de">Deutsch</option></select></label>
        </> : <>
          {inp('name', table === 'partners' ? 'Naam bedrijf' : 'Naam (bedrijf of persoon)', { autoFocus: true })}
          {table === 'subcontractors' ? (
            <label>Vak
              <select value={f.trade ?? ''} onChange={set('trade')}>
                <option value="">— kies —</option>
                {Object.entries(TRADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="_ander">Ander vak…</option>
              </select>
            </label>
          ) : inp('services', 'Doet voor ons', { placeholder: 'bv. zagen en frezen' })}
          {f.trade === '_ander' && inp('trade_other', 'Welk vak?')}
          {inp('contact_person', 'Contactpersoon')}
          {inp('vat_number', 'Btw-nummer', { placeholder: 'BE0123.456.789' })}
        </>}
        {inp('email', 'E-mail', { type: 'email', placeholder: 'naam@voorbeeld.be' })}
        {inp('phone', 'Telefoon', { type: 'tel', placeholder: '+32 …' })}
        {inp('street', 'Straat en nummer')}
        {inp('postal_code', 'Postcode', { inputMode: 'numeric' })}
        {inp('city', 'Gemeente')}
      </div>
      <label className="new-rel-notes">Notitie<textarea rows={2} value={f.notes ?? ''} onChange={set('notes')} /></label>
      {!emailOk && <p className="small bad-txt">Dat e-mailadres klopt niet.</p>}
      <p className="muted small">{isClient ? 'Een project voor deze klant maak je bij Projecten → + Nieuw project.' : 'Met een e-mailadres kan je hen later uitnodigen voor het portaal (opdrachten bevestigen, foto’s).'}</p>
      <div className="row-actions">
        <button className="primary" disabled={busy || !nameOk || !tradeOk || !emailOk} onClick={save}>{busy ? 'Bewaren…' : 'Toevoegen'}</button>
        <button onClick={onCancel}>Annuleren</button>
      </div>
    </div>
  )
}
