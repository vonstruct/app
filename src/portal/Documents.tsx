import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import type { Lang } from './i18n'

/** Klantenportaal: documenten die Olivier deelt (plannen, renders, attesten). */
type D = { id: string; project_code: string; kind: string; title: string; path: string; mime: string | null }
const T = { nl: { title: 'Documenten', open: 'Openen' }, en: { title: 'Documents', open: 'Open' }, de: { title: 'Dokumente', open: 'Öffnen' } }
const KIND: Record<string, Record<Lang, string>> = {
  Plan: { nl: 'Plan', en: 'Plan', de: 'Plan' }, Render: { nl: 'Render', en: 'Render', de: 'Visualisierung' }, 'Technische tekening': { nl: 'Technische tekening', en: 'Technical drawing', de: 'Technische Zeichnung' },
  Attest: { nl: 'Attest', en: 'Certificate', de: 'Bescheinigung' }, Foto: { nl: "Foto's", en: 'Photos', de: 'Fotos' }, Contract: { nl: 'Contract', en: 'Contract', de: 'Vertrag' }, Andere: { nl: 'Andere', en: 'Other', de: 'Sonstiges' },
}
export function Documents({ lang, preview = false }: { lang: Lang; preview?: boolean }) {
  const [rows, setRows] = useState<D[]>([])
  useEffect(() => { if (!preview) supabase.rpc('portal_my_documents').then(({ data }) => setRows((data as D[]) ?? [])) }, [preview])
  if (!rows.length) return null
  const open = async (d: D) => { const { data } = await supabase.storage.from('project-uploads').createSignedUrl(d.path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  return (
    <section className="aftercare">
      <h2 className="portal-h">{T[lang].title}</h2>
      <ul className="aftercare-items">
        {rows.map((d) => <li key={d.id}><span>▤</span><div style={{ flex: 1 }}><b>{d.title}</b><small>{KIND[d.kind]?.[lang] ?? d.kind} · {d.project_code}</small></div><button onClick={() => open(d)}>{T[lang].open}</button></li>)}
      </ul>
    </section>
  )
}
