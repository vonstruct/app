import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { INBOX, Section } from '../../core/Section'
import { VonPage } from './VonPage'

const von: AppModule = {
  id: 'von',
  label: 'VON',
  path: '/von',
  routes: [{ path: '/von', element: createElement(Section, { title: 'Inbox', tabs: INBOX, children: createElement(VonPage) }) }],
  inMenu: false,
}
export default von
