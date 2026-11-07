import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { AGENDA, Section } from '../../core/Section'
import { Agenda } from '../agenda/Agenda'
import { JobsOverview } from '../opdrachten/JobsOverview'
import { Capacity } from '../capaciteit/Capacity'
import { Tasks } from '../../core/Tasks'

/**
 * Agenda = afspraken, opdrachten en capaciteit (7 nov 2026; vroeger "Planning", met ook bestellingen, facturen en taken).
 * Bestellingen en aankoopfacturen staan onder Inkoop, verkoopfacturen onder Projecten, taken op Vandaag (/taken blijft bereikbaar).
 */
const intro = 'Afspraak = moment met mensen · Opdracht = werk dat iemand uitvoert en bevestigt · Capaciteit = hoeveel werk er per week ingepland is.'
const wrap = (el: ReturnType<typeof createElement>, title = 'Agenda') => createElement(Section, { title, intro, tabs: AGENDA, children: el })

const planning: AppModule = {
  id: 'planning',
  label: 'Agenda',
  path: '/agenda',
  also: ['/opdrachten', '/capaciteit', '/taken'],
  routes: [
    { path: '/agenda', element: wrap(createElement(Agenda)) },
    { path: '/opdrachten', element: wrap(createElement(JobsOverview)) },
    { path: '/capaciteit', element: wrap(createElement(Capacity)) },
    { path: '/taken', element: wrap(createElement(Tasks, { title: 'Taken' }), 'Taken') },
  ],
}
export default planning
