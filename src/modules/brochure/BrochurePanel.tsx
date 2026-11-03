import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { toast } from '../../core/toast'
import { printQuote } from '../../core/QuoteDoc'
import { BrochureDoc, type Brochure } from '../../core/BrochureDoc'

/** Tab "Brochure": voorbeeld van de klantenbrochure (zonder prijzen), inleiding, publiceren in het portaal. */
export function BrochurePanel({ project }: { project: string }) {
  const q = useQuery<Brochure>(() => supabase.rpc('brochure_data', { p_code: project }) as never, [project])
  const [intro, setIntro] = useState<string | null>(null)
  if (q.loading) return <Loading />
  const b = q.data
  const save = async (patch: Record<string, unknown>) => { const { error } = await supabase.from('projects').update(patch).eq('project_code', project); if (error) toast(error.message, 'err'); else { toast('Bewaard'); q.reload() } }
  const missing = (b?.materials ?? []).filter((m) => m.name === m.technical).length
  return (
    <div>
      <ErrorBox error={q.error} />
      {b && (
        <>
          <div className="quote-intern">
            <span><small>In het portaal</small><b>{b.published ? 'gepubliceerd' : 'niet zichtbaar'}</b></span>
            <span><small>Renders</small><b>{b.renders.length}</b></span>
            <span><small>Kasten</small><b>{b.cabinets.length}</b></span>
            <span><small>Materialen zonder publieke naam</small><b className={missing ? 'bad-txt' : ''}>{missing}</b></span>
          </div>
          <div className="qedit-head">
            <label>Inleiding (optioneel)<textarea rows={3} defaultValue={b.intro ?? ''} onChange={(e) => setIntro(e.target.value)} onBlur={() => intro !== null && intro !== (b.intro ?? '') && save({ brochure_intro: intro || null })} /></label>
            <div className="muted small">
              <p>Renders: laad ze op in het tabblad Documenten als soort "Render" (vink "klant" aan).</p>
              <p>Publieke namen, uitleg, onderhoud en decorbeelden per materiaal: <Link to="/regels">Rekenregels → Brochure</Link>.</p>
              <p>Kastfoto's volgen zodra PaletteCAD ze meestuurt.</p>
            </div>
          </div>
          <div className="order-actions">
            <button className="primary" onClick={() => save({ brochure_published: !b.published })}>{b.published ? 'Verbergen voor de klant' : 'Publiceren in het portaal'}</button>
            <button onClick={printQuote}>Afdrukken / PDF</button>
          </div>
          <div className="qpreview"><BrochureDoc b={b} /></div>
        </>
      )}
    </div>
  )
}
