import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { SETTINGS, Section } from '../../core/Section'
import { ControlTower } from './ControlTower'
import { Mails } from './Mails'

const controltower: AppModule = {
  id: 'controltower',
  label: 'Vandaag',
  path: '/overzicht',
  routes: [
    { path: '/overzicht', element: createElement(ControlTower) },
    { path: '/mails', element: createElement(Section, { title: 'Instellingen', tabs: SETTINGS, children: createElement(Mails) }) },
  ],
}
export default controltower
