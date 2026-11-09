import { createElement, type ComponentType } from 'react'
import { Kasten } from './Kasten'
import { Platen } from './Platen'
import { Kanten } from './Kanten'
import { Lades } from './Lades'
import { DuPont } from './DuPont'
import { Controle } from './Controle'
import { CostLines, Projectkosten } from './Kosten'

export type VersionTab = { id: string; label: string; component: ComponentType<{ dvId: string }> }

const h2 = (text: string) => createElement('h2', { className: 'vt-h' }, text)
const costTab = (cat: string) => function CostTab({ dvId }: { dvId: string }) { return createElement(CostLines, { dvId, cats: [cat] }) }

function KantenTab({ dvId }: { dvId: string }) {
  return createElement('div', null, createElement(CostLines, { dvId, cats: ['Kanten'], title: 'Kostprijs' }), h2('Kanten in de tekening'), createElement(Kanten, { dvId }))
}
function LadesTab({ dvId }: { dvId: string }) {
  return createElement('div', null, createElement(CostLines, { dvId, cats: ['Lades'], title: 'Kostprijs' }), h2('Lades in de tekening'), createElement(Lades, { dvId }),
    h2('Du Pont-onderdelen van de lades'), createElement(DuPont, { dvId }))
}

/**
 * Tabbladen van een ontwerpversie, zoals de stuklijst in PaletteCAD (9/11/2026, Olivier): Kasten Overzicht · Platen · Kanten · Lades ·
 * Werkbladen · Sanitair · Elektriciteit · Toestellen · Grepen · Verbinders & Beslagen · Varia · Productiekosten · Projectkosten · Controle.
 * Elke rubriek met haar kostregels (prijs aanklikken = eigen prijs). Groepen, marges en offerte: projectpagina › Ontwerp › Kostprijs;
 * aantallen, versies en verschillen: projectpagina › Ontwerp › Ontwerpen. Oude namen in links: VERSION_TAB_ALIAS.
 */
export const versionTabs: VersionTab[] = [
  { id: 'kasten', label: 'Kasten Overzicht', component: Kasten },
  { id: 'platen', label: 'Platen', component: Platen },
  { id: 'kanten', label: 'Kanten', component: KantenTab },
  { id: 'lades', label: 'Lades', component: LadesTab },
  { id: 'werkbladen', label: 'Werkbladen', component: costTab('Werkbladen') },
  { id: 'sanitair', label: 'Sanitair', component: costTab('Sanitair') },
  { id: 'elektriciteit', label: 'Elektriciteit', component: costTab('Elektriciteit') },
  { id: 'toestellen', label: 'Toestellen', component: costTab('Toestellen') },
  { id: 'grepen', label: 'Grepen', component: costTab('Grepen') },
  { id: 'beslag', label: 'Verbinders & Beslagen', component: costTab('Verbinders & Beslagen') },
  { id: 'varia', label: 'Varia', component: costTab('Varia') },
  { id: 'productiekosten', label: 'Productiekosten', component: costTab('Productiekosten') },
  { id: 'projectkosten', label: 'Projectkosten', component: Projectkosten },
  { id: 'controle', label: 'Controle', component: Controle },
]
export const VERSION_TAB_ALIAS: Record<string, string> = { overzicht: 'kasten', kosten: 'projectkosten', dupont: 'lades' }
