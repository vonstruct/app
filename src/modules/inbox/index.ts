import { createElement } from 'react'
import type { AppModule } from '../../core/module'
import { INBOX, Section } from '../../core/Section'
import { Inbox } from './Inbox'

/** Inbox: mails (info@) en VON-voorstellen samen. /von hoort er als tab bij (module von). */
const inbox: AppModule = {
  id: 'inbox',
  label: 'Inbox',
  path: '/inbox',
  routes: [{ path: '/inbox', element: createElement(Section, { title: 'Inbox', tabs: INBOX, children: createElement(Inbox) }) }],
}
export default inbox
