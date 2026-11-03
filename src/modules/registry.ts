import type { AppModule } from '../core/module'
import controltower from './controltower'
import agenda from './agenda'
import opdrachten from './opdrachten'
import projecten from './projecten'
import regels from './regels'
import relaties from './relaties'
import portaal from './portaal'
import von from './von'

/** Volgorde = volgorde in het menu. Een nieuwe module: map aanmaken + hier één regel toevoegen. */
export const modules: AppModule[] = [controltower, von, agenda, opdrachten, projecten, relaties, regels, portaal]
