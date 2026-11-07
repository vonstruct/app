import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { OrdersPage } from '../bestellingen/MailDocs'
import { FacturenRoute } from './FacturenRoute'

/**
 * Inkoop (7 nov 2026): bestellingen, documenten uit de mailbox en aankoopfacturen op één plek.
 * /facturen zonder ?tab=aankoop = verkoopfacturen, getoond onder Projecten (FacturenRoute kiest de juiste kop en tabs).
 */
const inkoop: AppModule = {
  id: 'inkoop',
  label: 'Inkoop',
  path: '/bestellingen',
  also: ['/facturen?tab=aankoop'],
  routes: [
    { path: '/bestellingen', element: createElement(OrdersPage) },
    { path: '/facturen', element: createElement(FacturenRoute) },
  ],
}
export default inkoop
