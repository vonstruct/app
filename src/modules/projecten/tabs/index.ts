import type { ComponentType } from 'react'
import { Kasten } from './Kasten'
import { Platen } from './Platen'
import { Kanten } from './Kanten'
import { Lades } from './Lades'
import { Beslag } from './Beslag'
import { DuPont } from './DuPont'
import { Controle } from './Controle'

export type VersionTab = { id: string; label: string; component: ComponentType<{ dvId: string }> }

/** Tabbladen van een ontwerpversie. Een nieuw tabblad (bv. Kosten): component maken + hier één regel. */
export const versionTabs: VersionTab[] = [
  { id: 'kasten', label: 'Kasten', component: Kasten },
  { id: 'platen', label: 'Platen', component: Platen },
  { id: 'kanten', label: 'Kanten', component: Kanten },
  { id: 'lades', label: 'Lades', component: Lades },
  { id: 'beslag', label: 'Beslag', component: Beslag },
  { id: 'dupont', label: 'Du Pont (lades)', component: DuPont },
  { id: 'controle', label: 'Controle', component: Controle },
]
