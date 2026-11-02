import { useSearchParams } from 'react-router'
import { EditableTable, type EditCol } from '../../core/EditableTable'
import { Tabs } from '../../core/ui'

type Section = { id: string; label: string; table: string; intro: string; columns: EditCol[]; orderBy: string; newRow: Record<string, unknown>; canDelete: boolean }

const SECTIONS: Section[] = [
  {
    id: 'klanten', label: 'Klanten', table: 'clients', orderBy: 'client_number', newRow: { last_name: 'Nieuwe klant' }, canDelete: false,
    intro: 'Klanten worden automatisch aangemaakt bij de eerste upload uit PaletteCAD. Met een e-mailadres kan je de klant uitnodigen voor het klantenportaal.',
    columns: [
      { key: 'client_number', label: 'Nr', type: 'number', width: 60 },
      { key: 'first_name', label: 'Voornaam' },
      { key: 'last_name', label: 'Naam' },
      { key: 'company', label: 'Bedrijf' },
      { key: 'email', label: 'E-mail', placeholder: 'naam@voorbeeld.be' },
      { key: 'phone', label: 'Telefoon' },
      { key: 'street', label: 'Straat' },
      { key: 'postal_code', label: 'Postcode', width: 80 },
      { key: 'city', label: 'Gemeente' },
      { key: 'language', label: 'Taal', type: 'select', options: ['nl', 'en', 'de'], width: 70 },
    ],
  },
  {
    id: 'partners', label: 'Partners', table: 'partners', orderBy: 'name', newRow: { name: 'Nieuwe partner' }, canDelete: true,
    intro: 'Productiepartners, zoals partner voor het zagen en frezen van de platen. Met een e-mailadres krijgt de partner toegang tot het partnerportaal.',
    columns: [
      { key: 'name', label: 'Naam' },
      { key: 'services', label: 'Doet voor ons' },
      { key: 'contact_person', label: 'Contactpersoon' },
      { key: 'email', label: 'E-mail', placeholder: 'naam@bedrijf.be' },
      { key: 'phone', label: 'Telefoon' },
      { key: 'city', label: 'Gemeente' },
      { key: 'active', label: 'Actief', type: 'bool', width: 60 },
    ],
  },
  {
    id: 'onderaannemers', label: 'Onderaannemers', table: 'subcontractors', orderBy: 'name', newRow: { name: 'Nieuwe onderaannemer', active: true }, canDelete: true,
    intro: 'Plaatsers, elektricien, schilder … Met een e-mailadres krijgen ze toegang tot hun jobs in het portaal.',
    columns: [
      { key: 'name', label: 'Naam' },
      { key: 'trade', label: 'Vak' },
      { key: 'contact_person', label: 'Contactpersoon' },
      { key: 'email', label: 'E-mail', placeholder: 'naam@bedrijf.be' },
      { key: 'phone', label: 'Telefoon' },
      { key: 'city', label: 'Gemeente' },
      { key: 'active', label: 'Actief', type: 'bool', width: 60 },
    ],
  },
]

/** Klanten, partners en onderaannemers. Wijzigen = klikken en typen; wordt meteen bewaard. */
export function RelationsPage() {
  const [params, setParams] = useSearchParams()
  const sec = SECTIONS.find((s) => s.id === params.get('tab')) ?? SECTIONS[0]
  const [fid, fkey] = (params.get('focus') ?? '').split(':')
  return (
    <section>
      <h1>Relaties</h1>
      <p className="muted">Klik in een cel om te wijzigen. Alles wordt meteen bewaard.</p>
      <Tabs tabs={SECTIONS.map((s) => ({ id: s.id, label: s.label }))} active={sec.id} onChange={(id) => setParams({ tab: id }, { replace: true })} />
      <p className="muted">{sec.intro}</p>
      {fid && fkey && <p className="notice">Vul het gemarkeerde veld in en druk op Enter.</p>}
      <EditableTable
        key={sec.id}
        table={sec.table}
        columns={sec.columns}
        orderBy={sec.orderBy}
        newRow={sec.newRow}
        canDelete={sec.canDelete}
        focus={fid && fkey ? { id: fid, key: fkey } : undefined}
      />
    </section>
  )
}
