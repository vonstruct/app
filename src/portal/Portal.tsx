import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import logo from '../assets/vonstruct-logo.webp'
import { Survey } from './Survey'
import { Jobs } from './Jobs'
import { LANGS, asLang, storeLang, storedLang, tr, type Lang } from './i18n'

export type PortalRole = 'klant' | 'partner' | 'onderaannemer'

type Project = { project_code: string; title: string | null; phase: string | null; target_install_week: string | null; site_city: string | null; survey_status?: string }

const STEPS = ['design', 'quote', 'production', 'installation', 'closed']

/** Portaal voor klanten, de productiepartner en onderaannemers. `preview` = beheerder bekijkt het als voorbeeld. */
export function Portal({ role, preview = false }: { role: PortalRole; preview?: boolean }) {
  const [name, setName] = useState<string | null>(null)
  const [survey, setSurvey] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>(storedLang)
  const t = tr(lang)
  useEffect(() => {
    if (preview) return setName(null)
    supabase.rpc('my_display_name').then(({ data }) => setName(typeof data === 'string' ? data : null))
    // de taal van de klant (bij de klantgegevens) gaat voor
    if (role === 'klant') supabase.rpc('my_language').then(({ data }) => { if (data) { setLang(asLang(data)); storeLang(asLang(data)) } })
  }, [preview, role])
  const pick = (l: Lang) => {
    setLang(l)
    storeLang(l)
    if (!preview && role === 'klant') supabase.rpc('set_my_language', { p_lang: l })
  }

  return (
    <div className={preview ? 'portal preview' : 'portal'}>
      <header className="portal-top">
        <span className="portal-kind">{t.kind[role]}</span>
        <div className="portal-top-right">
          <LangPicker lang={lang} onPick={pick} label={t.language} />
          {!preview && (
            <button className="portal-out" onClick={() => supabase.auth.signOut()}>
              {t.signOut}
            </button>
          )}
          <img className="portal-logo" src={logo} alt="Vonstruct" />
        </div>
      </header>
      <section className="portal-hero">
        <h1>{name ? t.hello(name.split(' ')[0]) : t.welcome}</h1>
        <p>{t.intro[role]}</p>
      </section>
      <main className="portal-main">
        {survey ? (
          <Survey code={survey} lang={lang} onClose={() => setSurvey(null)} />
        ) : role === 'klant' ? (
          <ClientProjects preview={preview} lang={lang} onSurvey={setSurvey} />
        ) : (
          <Jobs lang={lang} preview={preview} empty={<EmptyWork role={role} lang={lang} />} />
        )}
        {!survey && role !== 'onderaannemer' && <h2 className="portal-h">{t.coming}</h2>}
        {!survey && role !== 'onderaannemer' && (
          <div className="portal-grid">
            {t.comingTiles[role].map(([title, text]) => (
              <div key={title} className="portal-tile">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        )}
      </main>
      <footer className="portal-foot">{t.footer}</footer>
    </div>
  )
}

function ClientProjects({ preview, lang, onSurvey }: { preview: boolean; lang: Lang; onSurvey: (code: string) => void }) {
  const t = tr(lang)
  const [rows, setRows] = useState<Project[] | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const loadVisits = () => { if (!preview) supabase.rpc('portal_client_visits').then(({ data }) => setVisits((data as Visit[]) ?? [])) }
  useEffect(() => {
    if (preview) { const d = new Date(); d.setDate(d.getDate() + 3); return setVisits([{ id: 'v', project_code: '209901', title: 'Keuken plaatsen', job_type: 'Nieuwbouw', slot: 'dag', start_at: d.toISOString(), end_at: new Date(d.getTime() + 86400000).toISOString(), status: 'bevestigd', who: 'Vonstruct' }]) }
    supabase.rpc('portal_client_visits').then(({ data }) => setVisits((data as Visit[]) ?? []))
  }, [preview])
  useEffect(() => {
    if (preview) return setRows([{ project_code: '209901', title: 'Keuken en berging', phase: 'design', target_install_week: null, site_city: 'Geel', survey_status: 'submitted' }])
    supabase.rpc('portal_my_projects').then(({ data }) => setRows((data as Project[]) ?? []))
  }, [preview])

  if (rows === null) return <p className="muted">{t.loading}</p>
  if (rows.length === 0)
    return (
      <div className="portal-empty">
        <h2>{t.preparing}</h2>
        <p>{t.preparingText}</p>
      </div>
    )
  return (
    <div className="portal-projects">
      {rows.map((p) => {
        const idx = p.phase === 'lead' ? -1 : STEPS.indexOf(p.phase ?? '')
        return (
          <article key={p.project_code} className="portal-project">
            <div className="portal-project-head">
              <div>
                <span className="portal-code">{t.project} {p.project_code}</span>
                <h2>{!p.title || p.title === 'Nieuwe aanvraag' ? t.yourProject : p.title}</h2>
                {p.site_city && <p className="muted">{p.site_city}</p>}
              </div>
              <span className="portal-phase">{t.phases[p.phase ?? ''] ?? '—'}</span>
            </div>
            <ol className="portal-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={idx >= 0 && i < idx ? 'done' : i === idx ? 'now' : ''}>
                  {t.phases[s]}
                </li>
              ))}
            </ol>
            <Visits list={visits.filter((v) => v.project_code === p.project_code)} lang={lang} onChange={loadVisits} />
            {p.target_install_week && <p className="muted">{t.plannedInstall(p.target_install_week)}</p>}
            {p.survey_status !== 'submitted' ? (
              <div className="portal-todo">
                <div>
                  <strong>{t.fillSurvey}</strong>
                  <p className="muted">{t.fillSurveyText}</p>
                </div>
                <button className="primary" disabled={preview} onClick={() => onSurvey(p.project_code)}>
                  {p.survey_status === 'open' ? t.continue : t.start}
                </button>
              </div>
            ) : (
              <p className="portal-ok">{t.surveyDone} · <button className="link" disabled={preview} onClick={() => onSurvey(p.project_code)}>{t.view}</button></p>
            )}
          </article>
        )
      })}
    </div>
  )
}

type Visit = { id: string; project_code: string; title: string; job_type: string | null; slot: string | null; start_at: string; end_at: string; status: string; who: string | null; proposed_start?: string | null; proposed_end?: string | null; proposed_slot?: string | null; proposal_note?: string | null }

/** Klant: wie komt wanneer (datum, dagdeel of uur, wie, wat). */
function Visits({ list, lang, onChange }: { list: Visit[]; lang: Lang; onChange: () => void }) {
  const t = tr(lang)
  if (!list.length) return null
  const loc = lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-BE' : 'nl-BE'
  const d = (x: Date) => x.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
  const tm = (x: Date) => x.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="visits">
      <strong>{t.visits}</strong>
      <ul>
        {list.map((v) => {
          const s = new Date(v.start_at), e = new Date(v.end_at)
          const when = v.slot ? (s.toDateString() === e.toDateString() ? `${d(s)} · ${t.jobs.slots[v.slot]}` : `${d(s)} ${t.jobs.until} ${d(e)}`) : `${d(s)} · ${tm(s)}–${tm(e)}`
          const done = v.status === 'klaar'
          const fmt = (a: string, b: string, sl?: string | null) => { const x = new Date(a), y = new Date(b); return sl ? (x.toDateString() === y.toDateString() ? `${d(x)} · ${t.jobs.slots[sl]}` : `${d(x)} ${t.jobs.until} ${d(y)}`) : `${d(x)} · ${tm(x)}–${tm(y)}` }
          const decide = async (ok: boolean) => { await supabase.rpc('job_decide_proposal', { p_job: v.id, p_accept: ok }); onChange() }
          return (
            <li key={v.id} className={done ? 'done' : ''}>
              <span className="visits-when">{done ? '✓ ' : ''}{when}</span>
              <span>{v.who ? <strong>{v.who}</strong> : null}{v.who ? ' · ' : ''}{v.title}{v.job_type ? ` (${t.jobs.types[v.job_type] ?? v.job_type})` : ''}</span>
              {v.status === 'voorstel' && v.proposed_start && (
                <span className="proposal">
                  {t.visitProposal(v.who ?? 'Vonstruct')} <b>{fmt(v.proposed_start, v.proposed_end!, v.proposed_slot)}</b>{v.proposal_note ? ` – “${v.proposal_note}”` : ''}
                  <span className="toolbar"><button className="primary" onClick={() => decide(true)}>{t.agree}</button><button onClick={() => decide(false)}>{t.disagree}</button></span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyWork({ role, lang }: { role: PortalRole; lang: Lang }) {
  const t = tr(lang)
  return (
    <div className="portal-empty">
      <h2>{role === 'partner' ? t.noJobsP : t.noJobsS}</h2>
      <p>{role === 'partner' ? t.noJobsPText : t.noJobsSText}</p>
    </div>
  )
}

/** Taalkeuze NL / EN / DE. */
export function LangPicker({ lang, onPick, label }: { lang: Lang; onPick: (l: Lang) => void; label: string }) {
  return (
    <div className="lang-pick" role="group" aria-label={label}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={l.id === lang ? 'on' : ''} aria-pressed={l.id === lang} onClick={() => onPick(l.id)}>{l.label}</button>
      ))}
    </div>
  )
}
