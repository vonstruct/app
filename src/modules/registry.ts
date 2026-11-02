import type { AppModule } from '../core/module'
import controltower from './controltower'
import agenda from './agenda'
import projecten from './projecten'
import regels from './regels'
import relaties from './relaties'
import portaal from './portaal'

/** Volgorde = volgorde in het menu. Een nieuwe module: map aanmaken + hier één regel toevoegen. */
export const modules: AppModule[] = [controltower, agenda, projecten, relaties, regels, portaal]
