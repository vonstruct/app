import { createElement, type ComponentType } from 'react'
import { Kasten } from './Kasten'
import { Platen } from './Platen'
import { Kanten } from './Kanten'
import { Lades } from './Lades'
import { Beslag } from './Beslag'
import { DuPont } from './DuPont'
import { Controle } from './Controle'

export type VersionTab = { id: string; label: string; component: ComponentType<{ dvId: string }> }

const h2 = (text: string) => createElement('h2', { className: 'vt-h' }, text)

function PlatenKanten({ dvId }: { dvId: string }) {
  return createElement('div', null, createElement(Platen, { dvId }), h2('Kanten'), createElement(Kanten, { dvId }))
}
function LadesDuPont({ dvId }: { dvId: string }) {
  return createElement('div', null, h2('Lades'), createElement(Lades, { dvId }), h2('Du Pont-onderdelen van de lades'), createElement(DuPont, { dvId }))
}

/**
 * Tabbladen van een ontwerpversie (6 nov 2026: 4 in plaats van 9; 9 nov 2026 op vraag van Olivier: Lades, Beslag en Controle weer apart;
 * Overzicht weg: de aantallen, versies en verschillen staan op de projectpagina › Ontwerp › Ontwerpen).
 * Kosten staat op het project (Kostprijs). Oude namen in links (?tab=kanten, dupont) wijzen naar het nieuwe tabblad: VERSION_TAB_ALIAS.
 */
export const versionTabs: VersionTab[] = [
  { id: 'kasten', label: 'Kasten', component: Kasten },
  { id: 'platen', label: 'Platen en kanten', component: PlatenKanten },
  { id: 'lades', label: 'Lades', component: LadesDuPont },
  { id: 'beslag', label: 'Beslag', component: Beslag },
  { id: 'controle', label: 'Controle', component: Controle },
]
export const VERSION_TAB_ALIAS: Record<string, string> = { overzicht: 'kasten', kanten: 'platen', dupont: 'lades' }
