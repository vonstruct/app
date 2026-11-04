import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { PLANNING, Section } from '../../core/Section'
import { Agenda } from '../agenda/Agenda'
import { JobsOverview } from '../opdrachten/JobsOverview'
import { Capacity } from '../capaciteit/Capacity'
import { FacturenPage } from '../facturen/PurchaseInvoices'
import { Orders } from '../bestellingen/Orders'
import { Tasks } from '../../core/Tasks'

/** Planning = afspraken (Agenda), opdrachten (werk door iemand) en taken (wat jij moet doen). */
const intro = 'Afspraak = moment met mensen · Opdracht = werk dat iemand uitvoert en bevestigt · Taak = iets wat jij moet doen.'
const wrap = (el: ReturnType<typeof createElement>) => createElement(Section, { title: 'Planning', intro, tabs: PLANNING, children: el })

const planning: AppModule = {
  id: 'planning',
  label: 'Planning',
  path: '/agenda',
  routes: [
    { path: '/agenda', element: wrap(createElement(Agenda)) },
    { path: '/opdrachten', element: wrap(createElement(JobsOverview)) },
    { path: '/bestellingen', element: wrap(createElement(Orders)) },
    { path: '/facturen', element: wrap(createElement(FacturenPage)) },
    { path: '/capaciteit', element: wrap(createElement(Capacity)) },
    { path: '/taken', element: wrap(createElement(Tasks, { title: 'Taken' })) },
  ],
}
export default planning
