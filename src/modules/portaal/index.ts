import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { PortalPreview } from './PortalPreview'

const portaal: AppModule = {
  id: 'portaal',
  label: 'Portaal',
  path: '/portaal',
  routes: [{ path: '/portaal', element: createElement(PortalPreview) }],
}
export default portaal
