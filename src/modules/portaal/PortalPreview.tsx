import { useState } from 'react'
import { Portal, type PortalRole } from '../../portal/Portal'
import { Tabs } from '../../core/ui'

/** Beheerder: bekijk het portaal zoals een klant, partner of onderaannemer het ziet. */
export function PortalPreview() {
  const [role, setRole] = useState<PortalRole>('klant')
  return (
    <>
      <h1>Portaal</h1>
      <p className="crumbs">Zo zien klanten, je productiepartner en onderaannemers het portaal na het inloggen. De gegevens hier zijn een voorbeeld.</p>
      <Tabs
        tabs={[
          { id: 'klant', label: 'Klant' },
          { id: 'partner', label: 'Partner (productie)' },
          { id: 'onderaannemer', label: 'Onderaannemer' },
        ]}
        active={role}
        onChange={setRole}
      />
      <div className="portal-frame">
        <Portal role={role} preview />
      </div>
    </>
  )
}
