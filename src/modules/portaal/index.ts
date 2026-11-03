import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { SETTINGS, Section } from '../../core/Section'
import { PortalPreview } from './PortalPreview'

const portaal: AppModule = {
  id: 'portaal',
  label: 'Portaal',
  path: '/portaal',
  routes: [{ path: '/portaal', element: createElement(Section, { title: 'Instellingen', tabs: SETTINGS, children: createElement(PortalPreview) }) }],
  inMenu: false,
}
export default portaal
