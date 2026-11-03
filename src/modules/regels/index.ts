import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { SETTINGS, Section } from '../../core/Section'
import { RulesPage } from './RulesPage'

const regels: AppModule = {
  id: 'regels',
  label: 'Regels',
  path: '/regels',
  routes: [{ path: '/regels', element: createElement(Section, { title: 'Instellingen', tabs: SETTINGS, children: createElement(RulesPage) }) }],
  inMenu: false,
}
export default regels
