import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { ProjectList } from './ProjectList'
import { ProjectDetail } from './ProjectDetail'
import { VersionView } from './VersionView'
import { Cijfers } from './Cijfers'

const projecten: AppModule = {
  id: 'projecten',
  label: 'Projecten',
  path: '/projecten',
  also: ['/facturen', '/cijfers'],
  routes: [
    { path: '/projecten', element: createElement(ProjectList) },
    { path: '/projecten/:code', element: createElement(ProjectDetail) },
    { path: '/projecten/:code/v/:version', element: createElement(VersionView) },
    { path: '/cijfers', element: createElement(Cijfers) },
  ],
}
export default projecten
