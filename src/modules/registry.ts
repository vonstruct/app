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
import inkoop from './inkoop'

/** Volgorde = volgorde in het menu. Een nieuwe module: map aanmaken + hier één regel toevoegen. */
// Menu (7 nov 2026): Vandaag · Agenda · Projecten · Inkoop · Relaties. De rest via het menu onder je initialen (inMenu: false).
export const modules: AppModule[] = [controltower, von, inbox, planning, projecten, inkoop, relaties, instellingen, regels, portaal]
