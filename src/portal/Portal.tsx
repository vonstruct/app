import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import logo from '../assets/vonstruct-logo.webp'
import { Survey } from './Survey'
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
          <EmptyWork role={role} lang={lang} />
        )}
        {!survey && <h2 className="portal-h">{t.coming}</h2>}
        {!survey && (
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
