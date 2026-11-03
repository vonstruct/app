import { useEffect, useState } from 'react'
import logo from '../assets/vonstruct-logo.webp'
import { supabase } from './supabase'
import type { Company } from './QuoteDoc'

/** Klantenbrochure (zonder prijzen): renders, kasten, materialen met publieke naam/decorbeeld/onderhoud, lades, toestellen. Data = RPC brochure_data(code). */
export type Brochure = {
  project_code: string; title: string | null; intro: string | null; client: string | null; published: boolean; company: Company
  renders: { title: string; path: string }[]
  cabinets: { name: string; width: number; depth: number; height: number; image: string | null; text: string | null }[]
  materials: { name: string; family: string | null; description: string | null; care: string | null; image: string | null; technical: string }[]
  drawers: { n: number; brands: string | null } | null
  appliances: { title: string; description: string | null }[]
}
type L = 'nl' | 'en' | 'de'
const T = {
  nl: { doc: 'Jouw ontwerp', for: 'voor', cab: 'De kasten', mat: 'Materialen', care: 'Onderhoud', drawers: 'Lades', nDrawers: (n: number) => `${n} lades met zachte sluiting`, app: 'Toestellen en sanitair', dims: 'B × D × H' },
  en: { doc: 'Your design', for: 'for', cab: 'The cabinets', mat: 'Materials', care: 'Care', drawers: 'Drawers', nDrawers: (n: number) => `${n} soft-close drawers`, app: 'Appliances and sanitary', dims: 'W × D × H' },
  de: { doc: 'Ihr Entwurf', for: 'für', cab: 'Die Schränke', mat: 'Materialien', care: 'Pflege', drawers: 'Schubladen', nDrawers: (n: number) => `${n} Schubladen mit Soft-Close`, app: 'Geräte und Sanitär', dims: 'B × T × H' },
}

function Img({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(path.startsWith('http') ? path : null)
  useEffect(() => { if (!path.startsWith('http')) supabase.storage.from('project-uploads').createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)) }, [path])
  return url ? <img src={url} alt={alt} className={className} /> : <div className={(className ?? '') + ' bro-ph'} />
}

export function BrochureDoc({ b, lang = 'nl' }: { b: Brochure; lang?: L }) {
  const t = T[lang]
  const [hero, ...more] = b.renders
  return (
    <article className="qdoc bro">
      <header className="bro-cover">
        {hero && <Img path={hero.path} alt={hero.title} className="bro-hero" />}
        <div className="bro-cover-text">
          <img src={logo} alt="Vonstruct" className="qdoc-logo" />
          <h1>{t.doc}</h1>
          <p>{b.title}{b.client ? ` · ${t.for} ${b.client}` : ''}</p>
        </div>
      </header>
      {b.intro && <p className="qdoc-text bro-intro">{b.intro}</p>}
      {more.length > 0 && <div className="bro-gallery">{more.map((r) => <Img key={r.path} path={r.path} alt={r.title} />)}</div>}
      {b.cabinets.length > 0 && <>
        <h2 className="bro-h">{t.cab}</h2>
        <div className="bro-grid">
          {b.cabinets.map((c, i) => (
            <div key={i} className="bro-card">
              {c.image ? <Img path={c.image} alt={c.name} /> : <div className="bro-box" style={{ aspectRatio: `${Math.max(c.width, 200)} / ${Math.max(c.height, 200)}` }} />}
              <b>{c.name}</b><small>{t.dims}: {c.width} × {c.depth} × {c.height} mm</small>{c.text && <small>{c.text}</small>}
            </div>
          ))}
        </div>
      </>}
      {b.materials.length > 0 && <>
        <h2 className="bro-h">{t.mat}</h2>
        <div className="bro-mats">
          {b.materials.map((m, i) => (
            <div key={i} className="bro-mat">
              {m.image ? <Img path={m.image} alt={m.name} /> : <div className="bro-swatch" />}
              <div><b>{m.name}</b>{m.family && <small>{m.family}</small>}{m.description && <p>{m.description}</p>}{m.care && <p><i>{t.care}:</i> {m.care}</p>}</div>
            </div>
          ))}
        </div>
      </>}
      {b.drawers && b.drawers.n > 0 && <><h2 className="bro-h">{t.drawers}</h2><p className="qdoc-text">{t.nDrawers(b.drawers.n)}{b.drawers.brands ? ` · ${b.drawers.brands}` : ''}</p></>}
      {b.appliances.length > 0 && <><h2 className="bro-h">{t.app}</h2><ul className="hdoc-items">{b.appliances.map((a, i) => <li key={i}><b>{a.title}</b>{a.description && <span> — {a.description}</span>}</li>)}</ul></>}
      <footer className="qdoc-foot"><span>{b.company?.adres}</span><span>{b.company?.web}</span><span>{b.company?.telefoon}</span><span>{b.company?.email}</span></footer>
    </article>
  )
}
