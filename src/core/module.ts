import type { ReactNode } from 'react'

/**
 * Een module = één map onder src/modules met een index.ts die dit object exporteert,
 * plus één regel in src/modules/registry.ts. Meer is er niet nodig.
 */
export type AppModule = {
  id: string
  label: string // naam in het menu
  path: string // startpagina van de module, bv. '/projecten'
  routes: { path: string; element: ReactNode }[]
  inMenu?: boolean
}
