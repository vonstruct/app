import type { AppModule } from '../core/module'
import controltower from './controltower'
import inbox from './inbox'
import planning from './planning'
import instellingen from './instellingen'
import projecten from './projecten'
import regels from './regels'
import relaties from './relaties'
import portaal from './portaal'
import von from './von'

/** Volgorde = volgorde in het menu. Een nieuwe module: map aanmaken + hier één regel toevoegen. */
export const modules: AppModule[] = [controltower, von, inbox, planning, projecten, relaties, instellingen, regels, portaal]
