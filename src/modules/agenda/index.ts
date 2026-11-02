import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { Agenda } from './Agenda'

const agenda: AppModule = {
  id: 'agenda',
  label: 'Agenda',
  path: '/agenda',
  routes: [{ path: '/agenda', element: createElement(Agenda) }],
}
export default agenda
