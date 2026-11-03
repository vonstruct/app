import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { BrochureDoc, type Brochure } from '../core/BrochureDoc'
import { printQuote } from '../core/QuoteDoc'
import type { Lang } from './i18n'

/** Klantenportaal: gepubliceerde brochure(s) "Jouw ontwerp". */
const T = { nl: { title: 'Jouw ontwerp', open: 'Bekijk je ontwerp', back: '← Terug', print: 'Afdrukken / PDF' }, en: { title: 'Your design', open: 'View your design', back: '← Back', print: 'Print / PDF' }, de: { title: 'Ihr Entwurf', open: 'Entwurf ansehen', back: '← Zurück', print: 'Drucken / PDF' } }
export function BrochureList({ lang, preview = false }: { lang: Lang; preview?: boolean }) {
  const [rows, setRows] = useState<{ project_code: string; title: string | null }[]>([])
  const [open, setOpen] = useState<Brochure | null>(null)
  useEffect(() => { if (!preview) supabase.rpc('portal_my_brochures').then(({ data }) => setRows((data as never) ?? [])) }, [preview])
  if (!rows.length) return null
  const t = T[lang]
  if (open) return (
    <div className="pquote-view">
      <div className="pquote-bar"><button className="portal-link" onClick={() => setOpen(null)}>{t.back}</button><button onClick={printQuote}>{t.print}</button></div>
      <div className="qpreview"><BrochureDoc b={open} lang={lang} /></div>
    </div>
  )
  return (
    <section className="aftercare">
      <h2 className="portal-h">{t.title}</h2>
      <div className="pquotes">{rows.map((r) => (
        <button key={r.project_code} className="pquote aanvaard" onClick={async () => { const { data } = await supabase.rpc('brochure_data', { p_code: r.project_code }); if (data) setOpen(data as Brochure) }}>
          <span className="pquote-st">{r.project_code}</span><b>{r.title}</b><span /><span /><span className="muted">{t.open} →</span>
        </button>
      ))}</div>
    </section>
  )
}
