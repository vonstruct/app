import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { VonPage } from './VonPage'

const von: AppModule = {
  id: 'von',
  label: 'VON',
  path: '/von',
  routes: [{ path: '/von', element: createElement(VonPage) }],
  inMenu: false,
}
export default von
