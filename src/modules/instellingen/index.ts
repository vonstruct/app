import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { SETTINGS, Section } from '../../core/Section'
import { Settings } from './Settings'

const instellingen: AppModule = {
  id: 'instellingen',
  label: 'Instellingen',
  path: '/instellingen',
  routes: [{ path: '/instellingen', element: createElement(Section, { title: 'Instellingen', tabs: SETTINGS, children: createElement(Settings) }) }],
}
export default instellingen
