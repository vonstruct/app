import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { INBOX, Section } from '../../core/Section'
import { Inbox } from './Inbox'

/** Alle mails (info@ en olivier@). Niet in het menu (sinds 4 nov 2026): wat een antwoord nodig heeft staat in Vandaag, mails per project bij het project; bereikbaar via Zoeken, "Antwoorden" en het menu onder je initialen. */
const inbox: AppModule = {
  id: 'inbox',
  label: 'Inbox',
  path: '/inbox',
  inMenu: false,
  routes: [{ path: '/inbox', element: createElement(Section, { title: 'Mails', tabs: INBOX, children: createElement(Inbox) }) }],
}
export default inbox
