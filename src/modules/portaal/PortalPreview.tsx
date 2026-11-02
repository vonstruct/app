import { useEffect, useState } from 'react'
import { Portal, type PortalRole } from '../../portal/Portal'
import { Tabs } from '../../core/ui'
import { supabase } from '../../core/supabase'

type Person = { id: string; name: string; email: string | null }

/** Beheerder: bekijk het portaal zoals een klant, partner of onderaannemer het ziet; voor partners en onderaannemers met hun echte opdrachten. */
export function PortalPreview() {
  const [role, setRole] = useState<PortalRole>('klant')
  const [people, setPeople] = useState<Record<string, Person[]>>({})
  const [who, setWho] = useState<string>('')
  useEffect(() => {
    Promise.all([
      supabase.from('subcontractors').select('id,name,email').order('name'),
      supabase.from('partners').select('id,name,email').order('name'),
    ]).then(([s, p]) => setPeople({ onderaannemer: (s.data as Person[]) ?? [], partner: (p.data as Person[]) ?? [] }))
  }, [])
  useEffect(() => setWho(''), [role])
  const list = people[role] ?? []
  return (
    <>
      <h1>Portaal</h1>
      <p className="crumbs">Zo zien klanten, je productiepartner en onderaannemers het portaal na het inloggen.</p>
      <Tabs
        tabs={[
          { id: 'klant', label: 'Klant' },
          { id: 'partner', label: 'Partner (productie)' },
          { id: 'onderaannemer', label: 'Onderaannemer' },
        ]}
        active={role}
        onChange={setRole}
      />
      {role !== 'klant' && (
        <div className="toolbar" style={{ margin: '10px 0' }}>
          <label>Bekijk het portaal van{' '}
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">— voorbeeld —</option>
              {list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.email ? '' : ' (geen e-mail)'}</option>)}
            </select>
          </label>
          <span className="muted small">{who ? 'Echte opdrachten, precies zoals hij/zij ze ziet (knoppen uitgeschakeld).' : 'Voorbeeldgegevens.'}</span>
        </div>
      )}
      <div className="portal-frame">
        <Portal key={role + who} role={role} preview viewAs={who && role !== 'klant' ? { kind: role, id: who } : null} />
      </div>
    </>
  )
}
