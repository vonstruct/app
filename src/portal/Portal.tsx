import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import logo from '../assets/vonstruct-logo.webp'

export type PortalRole = 'klant' | 'partner' | 'onderaannemer'

type Project = { project_code: string; title: string | null; phase: string | null; target_install_week: string | null; site_city: string | null }

const PHASES: Record<string, string> = {
  lead: 'Aanvraag', intake: 'Kennismaking', survey: 'Vragenlijst', measuring: 'Opmeting', design: 'Ontwerp', quote: 'Offerte',
  signed: 'Getekend', final_measure: 'Eindopmeting', ordering: 'Bestellingen', production: 'Productie', installation: 'Plaatsing',
  handover: 'Oplevering', aftercare: 'Nazorg', closed: 'Afgerond', on_hold: 'Gepauzeerd', declined: 'Niet doorgegaan',
}
const STEPS = ['design', 'quote', 'signed', 'production', 'installation', 'handover']

const COMING: Record<PortalRole, { title: string; text: string }[]> = {
  klant: [
    { title: 'Planning', text: 'In welke fase je project zit en wat de volgende stap is.' },
    { title: 'Ontwerpen', text: 'Overzichtsbeelden van je ontwerp en de goedkeuring ervan.' },
    { title: 'Afspraken en beslissingen', text: 'Gesprekken, notities en wat er samen beslist is.' },
    { title: 'Offerte en facturen', text: 'Je offerte, opties, contract en betaalstatus.' },
    { title: 'Plaatsing', text: 'De plaatsingsdatum en de checklist vooraf.' },
    { title: 'Probleem melden', text: 'Na de plaatsing: meld een probleem, met je garantiedatum erbij.' },
  ],
  partner: [
    { title: 'Opdrachten', text: 'Per project: het PaletteCAD-bestand, de platen- en kantenlijst en de klaar-tegen-datum.' },
    { title: 'Zaagplannen', text: 'Het zaagplan per materiaal, klaar om af te drukken.' },
    { title: 'Bijzonderheden', text: 'Afwijkende onderdelen en opmerkingen per opdracht.' },
    { title: 'Palletten', text: 'Sortering per pallet wanneer meerdere opdrachten tegelijk lopen.' },
  ],
  onderaannemer: [
    { title: 'Mijn jobs', text: 'Je geplande jobs met datum, adres en contact van de klant.' },
    { title: 'Werkfiche', text: 'Plannen, tekeningen en wat er ter plaatse moet gebeuren.' },
    { title: "Foto's en opmerkingen", text: 'Voortgang en opmerkingen doorgeven vanaf de werf.' },
  ],
}

const INTRO: Record<PortalRole, string> = {
  klant: 'Hier volg je je project bij Vonstruct, van ontwerp tot plaatsing.',
  partner: 'Hier vind je de productieopdrachten van Vonstruct.',
  onderaannemer: 'Hier vind je de jobs die Vonstruct voor je inplant.',
}

/** Portaal voor klanten, de productiepartner en onderaannemers. `preview` = beheerder bekijkt het als voorbeeld. */
export function Portal({ role, preview = false }: { role: PortalRole; preview?: boolean }) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    if (preview) return setName(null)
    supabase.rpc('my_display_name').then(({ data }) => setName(typeof data === 'string' ? data : null))
  }, [preview])

  return (
    <div className={preview ? 'portal preview' : 'portal'}>
      <header className="portal-top">
        <img className="portal-logo" src={logo} alt="Vonstruct" />
        {!preview && (
          <button className="portal-out" onClick={() => supabase.auth.signOut()}>
            Afmelden
          </button>
        )}
      </header>
      <section className="portal-hero">
        <h1>{name ? `Welkom, ${name.split(' ')[0]}` : 'Welkom'}</h1>
        <p>{INTRO[role]}</p>
      </section>
      <main className="portal-main">
        {role === 'klant' ? <ClientProjects preview={preview} /> : <EmptyWork role={role} />}
        <h2 className="portal-h">Binnenkort in je portaal</h2>
        <div className="portal-grid">
          {COMING[role].map((c) => (
            <div key={c.title} className="portal-tile">
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="portal-foot">Vragen? Neem contact op met Olivier · info@vonstruct.com</footer>
    </div>
  )
}

function ClientProjects({ preview }: { preview: boolean }) {
  const [rows, setRows] = useState<Project[] | null>(null)
  useEffect(() => {
    if (preview) return setRows([{ project_code: '209901', title: 'Keuken en berging', phase: 'design', target_install_week: null, site_city: 'Geel' }])
    supabase.rpc('portal_my_projects').then(({ data }) => setRows((data as Project[]) ?? []))
  }, [preview])

  if (rows === null) return <p className="muted">Laden…</p>
  if (rows.length === 0)
    return (
      <div className="portal-empty">
        <h2>Je project wordt klaargezet</h2>
        <p>Zodra je project bij ons is aangemaakt, verschijnt het hier.</p>
      </div>
    )
  return (
    <div className="portal-projects">
      {rows.map((p) => {
        const idx = STEPS.indexOf(p.phase ?? '')
        return (
          <article key={p.project_code} className="portal-project">
            <div className="portal-project-head">
              <div>
                <span className="portal-code">Project {p.project_code}</span>
                <h2>{p.title || 'Je project'}</h2>
                {p.site_city && <p className="muted">{p.site_city}</p>}
              </div>
              <span className="portal-phase">{PHASES[p.phase ?? ''] ?? '—'}</span>
            </div>
            <ol className="portal-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={idx >= 0 && i < idx ? 'done' : i === idx ? 'now' : ''}>
                  {PHASES[s]}
                </li>
              ))}
            </ol>
            {p.target_install_week && <p className="muted">Geplande plaatsing: week {p.target_install_week}</p>}
          </article>
        )
      })}
    </div>
  )
}

function EmptyWork({ role }: { role: PortalRole }) {
  return (
    <div className="portal-empty">
      <h2>{role === 'partner' ? 'Nog geen opdrachten' : 'Nog geen jobs'}</h2>
      <p>{role === 'partner' ? 'Nieuwe productieopdrachten verschijnen hier zodra Vonstruct ze doorstuurt.' : 'Zodra Vonstruct je inplant voor een job, verschijnt die hier.'}</p>
    </div>
  )
}
