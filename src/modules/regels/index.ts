import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { RulesPage } from './RulesPage'

const regels: AppModule = {
  id: 'regels',
  label: 'Regels',
  path: '/regels',
  routes: [{ path: '/regels', element: createElement(RulesPage) }],
}
export default regels
