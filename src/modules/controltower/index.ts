import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { ControlTower } from './ControlTower'

const controltower: AppModule = {
  id: 'controltower',
  label: 'Control tower',
  path: '/overzicht',
  routes: [{ path: '/overzicht', element: createElement(ControlTower) }],
}
export default controltower
