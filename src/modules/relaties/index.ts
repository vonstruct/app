import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { RelationsPage } from './RelationsPage'

const relaties: AppModule = {
  id: 'relaties',
  label: 'Relaties',
  path: '/relaties',
  routes: [{ path: '/relaties', element: createElement(RelationsPage) }],
}
export default relaties
