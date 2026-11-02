import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { ControlTower } from './ControlTower'
import { Mails } from './Mails'

const controltower: AppModule = {
  id: 'controltower',
  label: 'Control tower',
  path: '/overzicht',
  routes: [
    { path: '/overzicht', element: createElement(ControlTower) },
    { path: '/mails', element: createElement(Mails) },
  ],
}
export default controltower
