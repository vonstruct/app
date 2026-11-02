import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../core/supabase'
import { Survey } from '../../portal/Survey'

type Q = { key: string; module: string; section: string; label: string; type: string }
type Data = { questions: Q[]; modules: { module: string; label: string }[]; answers: Record<string, unknown>; status: string }

/** Antwoorden van de klant op de vragenlijst, met foto's. De beheerder kan de vragenlijst ook zelf openen en invullen. */
export function SurveyPanel({ code, submittedAt, focus }: { code: string; submittedAt?: string | null; focus: boolean }) {
  const [data, setData] = useState<Data | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const load = () => supabase.rpc('portal_survey', { p_code: code }).then(({ data }) => setData(data as Data))
  useEffect(() => { load() }, [code])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focus && data) box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [focus, data])
  useEffect(() => {
    if (!data) return
    const paths = Object.values(data.answers).flatMap((v) => (Array.isArray(v) ? v : [])).filter((v): v is string => typeof v === 'string' && v.startsWith(code + '/'))
    if (!paths.length) return
    supabase.storage.from('project-uploads').createSignedUrls(paths, 3600).then(({ data: d }) => {
      const m: Record<string, string> = {}
      for (const x of d ?? []) if (x.path && x.signedUrl) m[x.path] = x.signedUrl
      setUrls(m)
    })
  }, [data, code])

  if (open)
    return (
      <div className="survey-overlay">
        <div className="survey-overlay-inner">
          <Survey code={code} onClose={() => { setOpen(false); load() }} />
        </div>
      </div>
    )
  if (!data) return null
  const a = data.answers
  const filled = data.questions.filter((q) => {
    const v = a[q.key]
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
  })
  const show = (q: Q) => {
    const v = a[q.key]
    if (q.type === 'upload')
      return (
        <div className="uploads">
          {(v as string[]).map((p) => /\.(jpe?g|png|webp|gif)$/i.test(p) && urls[p]
            ? <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="upl"><img src={urls[p]} alt="" /></a>
            : <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="upl"><span className="upl-file">{p.split('.').pop()?.toUpperCase()}</span><span className="upl-name">{p.split('/').pop()?.replace(/^\d+-/, '')}</span></a>)}
        </div>
      )
    if (Array.isArray(v)) return v.join(', ')
    if (v === true) return 'Ja'
    if (v === false) return 'Nee'
    return String(v)
  }
  const sections = [...new Set(filled.map((q) => q.section))]
  return (
    <div ref={box} className={'panel survey-panel' + (focus ? ' focus' : '')}>
      <div className="survey-panel-head">
        <h2>Vragenlijst <span className={'chip ' + (data.status === 'submitted' ? 'ok' : 'warn')}>{data.status === 'submitted' ? 'ingediend' + (submittedAt ? ' ' + new Date(submittedAt).toLocaleDateString('nl-BE') : '') : filled.length ? 'bezig' : 'nog niet gestart'}</span></h2>
        <button onClick={() => setOpen(true)}>{data.status === 'submitted' ? 'Openen' : 'Zelf invullen of aanvullen'}</button>
      </div>
      {filled.length === 0 ? (
        <p className="muted">De klant heeft nog niets ingevuld. De klant vult dit in via het klantenportaal; je kunt het ook zelf invullen tijdens een gesprek.</p>
      ) : (
        sections.map((s) => (
          <div key={s} className="survey-answers">
            <h3>{s}</h3>
            <dl>
              {filled.filter((q) => q.section === s).map((q) => (
                <div key={q.key} className={q.type === 'upload' ? 'wide' : undefined}><dt>{q.label}</dt><dd>{show(q)}</dd></div>
              ))}
            </dl>
          </div>
        ))
      )}
    </div>
  )
}
