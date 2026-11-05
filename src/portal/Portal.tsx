import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import logo from '../assets/vonstruct-logo.webp'
import { Survey } from './Survey'
import { Quotes } from './Quotes'
import { Aftercare, MyPunch } from './Aftercare'
import { Packages } from './Packages'
import { Documents } from './Documents'
import { BrochureList } from './BrochureList'
import { Jobs, MomentForm, type ViewAs } from './Jobs'
import { downloadIcs } from '../core/ics'
import { LANGS, asLang, storeLang, storedLang, tr, type Lang } from './i18n'

export type PortalRole = 'klant' | 'partner' | 'onderaannemer'

type Project = { project_code: string; title: string | null; phase: string | null; target_install_week: string | null; site_city: string | null; survey_status?: string }

/** Contact Vonstruct (WhatsApp Business). */
const CONTACT_PHONE = '+32 493 47 27 51'
const CONTACT_WA = '32493472751'

const STEPS = ['design', 'quote', 'signed', 'production', 'installation', 'closed']
// tussenfases tonen als hun hoofdfase (stage gate)
const STEP_OF: Record<string, string> = { final_measure: 'signed', ordering: 'signed', handover: 'installation', aftercare: 'closed' }

/** Portaal voor klanten, de productiepartner en onderaannemers. `preview` = beheerder bekijkt het als voorbeeld. */
export function Portal({ role, preview = false, viewAs = null }: { role: PortalRole; preview?: boolean; viewAs?: ViewAs | null }) {
  const [name, setName] = useState<string | null>(null)
  const [survey, setSurvey] = useState<string | null>(null)
  // link uit de offertemail: ?offerte=<id> opent meteen die offerte
  const [initialQuote] = useState<string | null>(() => new URLSearchParams(window.location.search).get('offerte'))
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
        <div className="portal-hero-text">
          <h1>{name ? t.hello(name.split(' ')[0]) : t.welcome}</h1>
          <p>{t.intro[role]}</p>
        </div>
        <aside className="portal-contact">
          <span className="portal-contact-k">{t.contactTitle}</span>
          <div className="portal-contact-row">
            <span className="portal-contact-av">OV</span>
            <span><b>Olivier Van Dyck</b><small>{t.contactRole}</small></span>
          </div>
          <span className="portal-contact-mail">info@vonstruct.com · {CONTACT_PHONE}</span>
          <span className="portal-contact-btns">
            <a className="portal-contact-btn wa" href={`https://wa.me/${CONTACT_WA}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="portal-contact-btn" href="mailto:info@vonstruct.com">{t.mailMe}</a>
          </span>
        </aside>
      </section>
      <main className="portal-main">
        {survey ? (
          <Survey code={survey} lang={lang} onClose={() => setSurvey(null)} />
        ) : role === 'klant' ? (
          <>
            <Quotes lang={lang} preview={preview} initial={initialQuote} />
            <Aftercare lang={lang} preview={preview} />
            <BrochureList lang={lang} preview={preview} />
            <Documents lang={lang} preview={preview} />
            <ClientProjects preview={preview} lang={lang} onSurvey={setSurvey} />
          </>
        ) : (
          <>
            {role === 'partner' && !viewAs && <Packages preview={preview} />}
            <MyPunch lang={lang} preview={preview || !!viewAs} />
            <Jobs lang={lang} preview={preview} viewAs={viewAs} empty={<EmptyWork role={role} lang={lang} />} />
          </>
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
      <footer className="portal-foot"><span className="portal-foot-mark">V</span>{t.footer}</footer>
    </div>
  )
}

function ClientProjects({ preview, lang, onSurvey }: { preview: boolean; lang: Lang; onSurvey: (code: string) => void }) {
  const t = tr(lang)
  const [rows, setRows] = useState<Project[] | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const loadVisits = () => { if (!preview) supabase.rpc('portal_client_visits').then(({ data }) => setVisits((data as Visit[]) ?? [])) }
  useEffect(() => {
    if (preview) { const d = new Date(); d.setDate(d.getDate() + 3); return setVisits([{ id: 'v', project_code: '209901', title: 'Keuken plaatsen', job_type: 'Nieuwbouw', slot: 'dag', start_at: d.toISOString(), end_at: new Date(d.getTime() + 86400000).toISOString(), status: 'gepland', who: 'Elektricien – Jan Peeters BV', client_in_loop: true, client_confirmed_at: null, sub_confirmed: true }]) }
    supabase.rpc('portal_client_visits').then(({ data }) => setVisits((data as Visit[]) ?? []))
  }, [preview])
  useEffect(() => {
    if (preview) return setRows([{ project_code: '209901', title: 'Keuken en berging', phase: 'design', target_install_week: null, site_city: 'Geel', survey_status: 'submitted' }])
    supabase.rpc('portal_my_projects').then(({ data }) => setRows((data as Project[]) ?? []))
  }, [preview])
  // geplande data voor de klant (start werken, plaatsing); geen interne data
  const [dates, setDates] = useState<Record<string, { works_start: string | null; install_start: string | null; install_end: string | null }>>({})
  useEffect(() => {
    if (preview) return
    supabase.rpc('portal_my_project_dates').then(({ data }) => setDates(Object.fromEntries(((data ?? []) as { project_code: string; works_start: string | null; install_start: string | null; install_end: string | null }[]).map((r) => [r.project_code, r]))))
  }, [preview])
  const fd = (v: string) => new Date(v + 'T12:00').toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-BE' : 'nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })

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
        const idx = STEPS.indexOf(STEP_OF[p.phase ?? ''] ?? p.phase ?? '')
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
                  <span className="ps-dot" aria-hidden="true">{idx >= 0 && i < idx ? '✓' : i + 1}</span>
                  <span className="ps-label">{t.phases[s]}{i === idx && <em> · {t.nowLabel}</em>}</span>
                </li>
              ))}
            </ol>
            <Visits list={visits.filter((v) => v.project_code === p.project_code)} lang={lang} onChange={loadVisits} preview={preview} />
            {dates[p.project_code]?.works_start && <p className="muted">{t.worksStart(fd(dates[p.project_code].works_start!))}</p>}
            {dates[p.project_code]?.install_start
              ? <p className="muted">{t.plannedInstallDate(fd(dates[p.project_code].install_start!), dates[p.project_code].install_end && dates[p.project_code].install_end !== dates[p.project_code].install_start ? fd(dates[p.project_code].install_end!) : null)}</p>
              : p.target_install_week && <p className="muted">{t.plannedInstall(p.target_install_week)}</p>}
            {p.survey_status !== 'submitted' ? (
              <div className="portal-todo">
                <div>
                  <span className="portal-todo-k">{t.nextStep}</span>
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

type Visit = { id: string; project_code: string; title: string; job_type: string | null; slot: string | null; start_at: string; end_at: string; status: string; who: string | null; proposed_start?: string | null; proposed_end?: string | null; proposed_slot?: string | null; proposal_note?: string | null; client_in_loop?: boolean; client_confirmed_at?: string | null; sub_confirmed?: boolean; prev_start?: string | null; prev_end?: string | null; prev_slot?: string | null; changed_by?: string | null; change_note?: string | null }

/** Klant: wie komt wanneer (datum, dagdeel of uur, wie, wat). */
function Visits({ list, lang, onChange, preview = false }: { list: Visit[]; lang: Lang; onChange: () => void; preview?: boolean }) {
  const t = tr(lang)
  const [changing, setChanging] = useState<string | null>(null)
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
          const confirm = async () => { await supabase.rpc('job_confirm', { p_job: v.id }); onChange() }
          const loop = v.client_in_loop && !done
          return (
            <li key={v.id} className={done ? 'done' : ''}>
              <span className="visits-when">{done ? '✓ ' : ''}{when}</span>
              <span>{v.who ? <strong>{v.who}</strong> : null}{v.who ? ' · ' : ''}{v.title}{v.job_type ? ` (${t.jobs.types[v.job_type] ?? v.job_type})` : ''}</span>
              {loop && v.changed_by && v.changed_by !== 'klant' && !v.client_confirmed_at && v.prev_start && (
                <span className="visits-change">⇄ {t.jobs.loop.changedBy(v.changed_by === 'vonstruct' ? 'Vonstruct' : v.who ?? '')} · {t.jobs.loop.was}: <s>{fmt(v.prev_start, v.prev_end!, v.prev_slot)}</s>{v.change_note ? ` – “${v.change_note}”` : ''}</span>
              )}
              {loop && (
                <span className="loop-status">
                  <span>{t.jobs.loop.you}: <b className={v.client_confirmed_at ? 'ok' : 'wait'}>{v.client_confirmed_at ? t.jobs.loop.ok : t.jobs.loop.wait}</b></span>
                  {v.who !== 'Vonstruct' && <span>{v.who}: <b className={v.sub_confirmed ? 'ok' : 'wait'}>{v.sub_confirmed ? t.jobs.loop.ok : t.jobs.loop.wait}</b></span>}
                </span>
              )}
              {loop && changing !== v.id && (
                <span className="toolbar">
                  {!v.client_confirmed_at && <button className="primary" disabled={preview} onClick={confirm}>✓ {t.jobs.confirm}</button>}
                  <button disabled={preview} onClick={() => setChanging(v.id)}>⇄ {t.jobs.propose}</button>
                  <button onClick={() => downloadIcs({ uid: `job-${v.id}-client@vonstruct.com`, start: v.start_at, end: v.end_at, slot: v.slot, summary: `${v.who ?? 'Vonstruct'}: ${v.title}` })}>{t.jobs.addToCal}</button>
                </span>
              )}
              {changing === v.id && <MomentForm j={v} lang={lang} onDone={() => { setChanging(null); onChange() }} onCancel={() => setChanging(null)} />}
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
