import { createElement, type ComponentType } from 'react'
import { Overzicht } from './Overzicht'
import { Kasten } from './Kasten'
import { Platen } from './Platen'
import { Kanten } from './Kanten'
import { Lades } from './Lades'
import { Beslag } from './Beslag'
import { DuPont } from './DuPont'
import { Controle } from './Controle'

export type VersionTab = { id: string; label: string; component: ComponentType<{ dvId: string }> }

const h2 = (text: string) => createElement('h2', { className: 'vt-h' }, text)

/** Overzicht met bovenaan de meldingen uit PaletteCAD (vroeger tabblad Controle). */
function OverzichtMeldingen({ dvId }: { dvId: string }) {
  return createElement('div', null, createElement(Controle, { dvId, compact: true }), createElement(Overzicht, { dvId }))
}
function PlatenKanten({ dvId }: { dvId: string }) {
  return createElement('div', null, createElement(Platen, { dvId }), h2('Kanten'), createElement(Kanten, { dvId }))
}
function LadesBeslag({ dvId }: { dvId: string }) {
  return createElement('div', null, h2('Lades'), createElement(Lades, { dvId }), h2('Du Pont-onderdelen van de lades'), createElement(DuPont, { dvId }), h2('Beslag'), createElement(Beslag, { dvId }))
}

/**
 * Tabbladen van een ontwerpversie (6 nov 2026: 4 in plaats van 9). Kosten staat voortaan op het project (Geld › Kostprijs).
 * Oude namen in links (?tab=controle, kanten, beslag, dupont) wijzen naar het nieuwe tabblad: VERSION_TAB_ALIAS.
 */
export const versionTabs: VersionTab[] = [
  { id: 'overzicht', label: 'Overzicht', component: OverzichtMeldingen },
  { id: 'kasten', label: 'Kasten', component: Kasten },
  { id: 'platen', label: 'Platen en kanten', component: PlatenKanten },
  { id: 'lades', label: 'Lades en beslag', component: LadesBeslag },
]
export const VERSION_TAB_ALIAS: Record<string, string> = { controle: 'overzicht', kanten: 'platen', beslag: 'lades', dupont: 'lades' }
