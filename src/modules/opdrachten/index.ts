import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { JobsOverview } from './JobsOverview'

const opdrachten: AppModule = {
  id: 'opdrachten',
  label: 'Opdrachten',
  path: '/opdrachten',
  routes: [{ path: '/opdrachten', element: createElement(JobsOverview) }],
}
export default opdrachten
