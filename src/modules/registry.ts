import type { AppModule } from '../core/module'
import projecten from './projecten'
import regels from './regels'

/** Volgorde = volgorde in het menu. Een nieuwe module: map aanmaken + hier één regel toevoegen. */
export const modules: AppModule[] = [projecten, regels]
