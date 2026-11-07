import { useSearchParams } from 'react-router'
import { INKOOP, PROJECTEN, Section } from '../../core/Section'
import { Invoices } from '../facturen/Invoices'
import { PurchaseInvoices } from '../facturen/PurchaseInvoices'

/** /facturen?tab=aankoop = aankoopfacturen (Inkoop); /facturen = verkoopfacturen van alle projecten (Projecten). */
export function FacturenRoute() {
  const [params] = useSearchParams()
  return params.get('tab') === 'aankoop'
    ? <Section title="Inkoop" tabs={INKOOP}><PurchaseInvoices /></Section>
    : <Section title="Projecten" tabs={PROJECTEN}><Invoices /></Section>
}
