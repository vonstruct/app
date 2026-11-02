import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../core/supabase'
import { Swatch } from './Swatch'
import { tr, type Lang } from './i18n'

type Tr = { label?: string; help?: string; section?: string; intro?: string; options?: (string | { label: string; info?: string })[] }
type Q = { key: string; module: string; section: string; sort: number; label: string; help: string | null; type: string; options: unknown; required: boolean; i18n?: Record<string, Tr> | null }
type M = { module: string; label: string; sort: number; intro: string | null; i18n?: Record<string, Tr> | null }
type Data = { project_code: string; modules: M[]; questions: Q[]; answers: Record<string, unknown>; status: 'open' | 'submitted'; known: Record<string, string | null> }
type Tile = { value: string; swatch: string; info?: string }

const BUCKET = 'project-uploads'
const asArr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : [])
/** Vertaling van een vraag of module (kolom i18n in Supabase); Nederlands als die ontbreekt. */
const loc = (x: { i18n?: Record<string, Tr> | null }, lang: Lang): Tr => (lang === 'nl' ? {} : x.i18n?.[lang] ?? {})

/** Vragenlijst voor de klant (ook door de beheerder te openen). Bewaart tussentijds; indienen zet het project op "Vragenlijst". */
export function Survey({ code, lang = 'nl', onClose }: { code: string; lang?: Lang; onClose: () => void }) {
  const t = tr(lang)
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState<string>('')
  const [missing, setMissing] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    supabase.rpc('portal_survey', { p_code: code }).then(({ data, error }) => {
      if (error) return setErr(error.message)
      const d = data as Data
      setData(d)
      setAnswers({ telefoon: d.known.phone ?? '', werf_straat: d.known.street ?? '', werf_postcode: d.known.postal_code ?? '', werf_gemeente: d.known.city ?? '', ...d.answers })
    })
  }, [code])

  const save = useCallback(async (a: Record<string, unknown>, submit = false) => {
    setSaved(t.saving)
    const { error } = await supabase.rpc('portal_save_survey', { p_code: code, p_answers: a, p_submit: submit })
    setSaved(error ? t.notSaved(error.message) : t.saved)
    return !error
  }, [code, t])

  const set = (key: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => save(next), 1200)
      return next
    })
  }

  // secties: algemene secties in volgorde, daarna één per gekozen projecttype
  const sections = useMemo(() => {
    if (!data) return []
    const chosen = asArr(answers.projecttype)
    const out: { title: string; name: string; intro?: string | null; qs: Q[] }[] = []
    for (const q of data.questions.filter((q) => q.module === 'algemeen')) {
      let s = out.find((x) => x.title === q.section)
      if (!s) out.push((s = { title: q.section, name: loc(q, lang).section ?? q.section, qs: [] }))
      s.qs.push(q)
    }
    const general = out.splice(0)
    const mods = data.modules.filter((m) => m.module !== 'algemeen' && chosen.includes(m.label))
    const modSections = mods.map((m) => ({ title: m.label, name: loc(m, lang).label ?? m.label, intro: loc(m, lang).intro ?? m.intro, qs: data.questions.filter((q) => q.module === m.module) }))
    // projectspecifieke vragen na "Stijl en materiaal", vóór "Praktisch"
    const i = general.findIndex((s) => s.title === 'Praktisch')
    return i < 0 ? [...general, ...modSections] : [...general.slice(0, i), ...modSections, ...general.slice(i)]
  }, [data, answers.projecttype, lang])

  if (err) return <div className="portal-empty"><h2>{t.surveyLoadErr}</h2><p>{err}</p><button onClick={onClose}>{t.back}</button></div>
  if (!data) return <p className="muted">{t.loading}</p>
  const readOnly = data.status === 'submitted'
  if (done)
    return (
      <div className="survey-done">
        <h2>{t.thanks}</h2>
        <p>{t.thanksText}</p>
        <button className="primary" onClick={onClose}>{t.backToProject}</button>
      </div>
    )

  const sec = sections[Math.min(step, sections.length - 1)]
  const isEmpty = (q: Q) => {
    const v = answers[q.key]
    if (q.type === 'upload') return asArr(v).length === 0
    if (q.type === 'multi' || q.type === 'tiles') return asArr(v).length === 0
    return v === undefined || v === null || String(v).trim() === ''
  }
  const submit = async () => {
    const miss = sections.flatMap((s) => s.qs.filter((q) => q.required && isEmpty(q)).map((q) => `${s.name}: ${loc(q, lang).label ?? q.label}`))
    setMissing(miss)
    if (miss.length) return
    window.clearTimeout(timer.current)
    if (await save(answers, true)) setDone(true)
  }
  const last = step >= sections.length - 1

  return (
    <div className="survey">
      <div className="survey-head">
        <button className="link" onClick={onClose}>{t.backArrow}</button>
        <span className="muted small">{readOnly ? t.readOnly : saved}</span>
      </div>
      <h1>{t.survey}</h1>
      <p className="muted">{t.surveyIntro} <strong>{t.surveyIntroStrong}</strong> {t.surveyIntroEnd}</p>
      <ol className="survey-steps">
        {sections.map((s, i) => (
          <li key={s.title} className={i === step ? 'now' : i < step ? 'done' : ''}><button onClick={() => setStep(i)}>{s.name}</button></li>
        ))}
      </ol>
      <section className="survey-section">
        <h2>{sec.name}</h2>
        {sec.intro && <p className="muted">{sec.intro}</p>}
        {sec.qs.map((q) => (
          <Field key={q.key} q={q} lang={lang} code={code} value={answers[q.key]} answers={answers} readOnly={readOnly} onChange={(v) => set(q.key, v)} />
        ))}
      </section>
      {missing.length > 0 && (
        <div className="auth-msg error">{t.stillMissing} <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
      )}
      <div className="survey-nav">
        {step > 0 ? <button onClick={() => setStep(step - 1)}>{t.prev}</button> : <span />}
        {!last ? (
          <button className="primary" onClick={() => { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{t.next}</button>
        ) : !readOnly ? (
          <button className="primary" onClick={submit}>{t.submit}</button>
        ) : null}
      </div>
    </div>
  )
}

function Field({ q, lang, code, value, answers, readOnly, onChange }: { q: Q; lang: Lang; code: string; value: unknown; answers: Record<string, unknown>; readOnly: boolean; onChange: (v: unknown) => void }) {
  // vervolgvragen enkel tonen als ze relevant zijn
  if (q.key === 'bron_wie' && answers.bron !== 'Aanbeveling van iemand') return null
  if (q.key === 'deadline_wat' && answers.deadline !== true) return null
  if (q.key === 'k_toestellen_info' && !answers.k_toestellen) return null
  const t = tr(lang)
  const L = loc(q, lang)
  const opts = (Array.isArray(q.options) ? q.options : []) as (string | Tile)[]
  // getoonde tekst van een keuze (de bewaarde waarde blijft de Nederlandse)
  const optText = (i: number, nlText: string) => { const o = L.options?.[i]; return typeof o === 'string' ? o : o?.label ?? nlText }
  const help = L.help ?? q.help
  const label = (
    <div className="q-label">
      <span>{L.label ?? q.label}{q.required && <span className="req"> *</span>}</span>
      {help && <small>{help}</small>}
    </div>
  )
  const dis = readOnly
  switch (q.type) {
    case 'textarea':
      return <label className="q">{label}<textarea rows={3} disabled={dis} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></label>
    case 'number':
      return <label className="q">{label}<input type="number" disabled={dis} value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} /></label>
    case 'yesno':
      return (
        <div className="q">{label}
          <div className="chips-pick">
            {[[t.yes, true], [t.no, false]].map(([t, v]) => (
              <button key={String(t)} type="button" disabled={dis} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{t as string}</button>
            ))}
          </div>
        </div>
      )
    case 'choice':
      return (
        <div className="q">{label}
          <div className="chips-pick">
            {(opts as string[]).map((o, i) => <button key={o} type="button" disabled={dis} className={value === o ? 'on' : ''} onClick={() => onChange(value === o ? null : o)}>{optText(i, o)}</button>)}
          </div>
        </div>
      )
    case 'multi': {
      const arr = asArr(value)
      return (
        <div className="q">{label}
          <div className="chips-pick">
            {(opts as string[]).map((o, i) => (
              <button key={o} type="button" disabled={dis} className={arr.includes(o) ? 'on' : ''}
                onClick={() => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])}>{arr.includes(o) ? '✓ ' : ''}{optText(i, o)}</button>
            ))}
          </div>
        </div>
      )
    }
    case 'tiles': {
      const arr = asArr(value)
      return (
        <div className="q">{label}
          <div className="tiles">
            {(opts as Tile[]).map((tile, i) => {
              const o = L.options?.[i]
              const info = (typeof o === 'object' && o?.info) || tile.info
              return (
              <button key={tile.value} type="button" disabled={dis} className={'tile' + (arr.includes(tile.value) ? ' on' : '')}
                onClick={() => onChange(arr.includes(tile.value) ? arr.filter((x) => x !== tile.value) : [...arr, tile.value])}>
                <span className="tile-img"><Swatch id={tile.swatch} /></span>
                <strong>{optText(i, tile.value)}</strong>
                {info && <small>{info}</small>}
              </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'upload':
      return <Upload q={q} t={t} code={code} paths={asArr(value)} readOnly={dis} onChange={onChange} label={label} />
    default:
      return <label className="q">{label}<input type={q.type === 'email' ? 'email' : q.type === 'tel' ? 'tel' : q.type === 'date' ? 'date' : 'text'} disabled={dis} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></label>
  }
}

function Upload({ q, t, code, paths, readOnly, onChange, label }: { q: Q; t: ReturnType<typeof tr>; code: string; paths: string[]; readOnly: boolean; onChange: (v: unknown) => void; label: React.ReactNode }) {
  const [busy, setBusy] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const accept = (q.options as { accept?: string })?.accept
  useEffect(() => {
    const todo = paths.filter((p) => !urls[p])
    if (!todo.length) return
    supabase.storage.from(BUCKET).createSignedUrls(todo, 3600).then(({ data }) => {
      const add: Record<string, string> = {}
      for (const d of data ?? []) if (d.path && d.signedUrl) add[d.path] = d.signedUrl
      setUrls((u) => ({ ...u, ...add }))
    })
  }, [paths, urls])
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setMsg(null)
    const out = [...paths]
    for (const f of Array.from(files)) {
      setBusy((b) => b + 1)
      const safe = f.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
      const path = `${code}/${q.key}/${Date.now()}-${safe}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false })
      setBusy((b) => b - 1)
      if (error) setMsg(`${f.name}: ${error.message}`)
      else out.push(path)
    }
    onChange(out)
  }
  const remove = async (p: string) => {
    await supabase.storage.from(BUCKET).remove([p])
    onChange(paths.filter((x) => x !== p))
  }
  return (
    <div className="q">{label}
      <div className="uploads">
        {paths.map((p) => {
          const isImg = /\.(jpe?g|png|webp|gif|heic)$/i.test(p)
          return (
            <div key={p} className="upl">
              {isImg && urls[p] ? <img src={urls[p]} alt="" /> : <span className="upl-file">{p.split('.').pop()?.toUpperCase()}</span>}
              <a href={urls[p]} target="_blank" rel="noreferrer" className="upl-name">{p.split('/').pop()?.replace(/^\d+-/, '')}</a>
              {!readOnly && <button type="button" className="link danger" onClick={() => remove(p)}>✕</button>}
            </div>
          )
        })}
        {!readOnly && (
          <label className="upl-add">
            <input type="file" multiple accept={accept} onChange={(e) => { add(e.target.files); e.target.value = '' }} />
            {busy ? t.uploading(busy) : t.addFiles}
          </label>
        )}
      </div>
      {msg && <p className="error small">{msg}</p>}
    </div>
  )
}
