import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { tr, type Lang } from './i18n'

type Job = {
  id: string; title: string; start_at: string; end_at: string; status: string; address: string | null
  contact_name: string | null; contact_phone: string | null; instructions: string | null; sub_note: string | null
  project_code: string | null; project_title: string | null
}
const BUCKET = 'job-files'

/** Opdrachten voor onderaannemers en partners, met alle info om het werk te doen. */
export function Jobs({ lang, preview, empty }: { lang: Lang; preview: boolean; empty: React.ReactNode }) {
  const t = tr(lang)
  const [rows, setRows] = useState<Job[] | null>(null)
  const load = useCallback(() => {
    if (preview) {
      const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(8, 0, 0, 0)
      return setRows([{ id: 'x', title: 'Keuken plaatsen', start_at: d.toISOString(), end_at: new Date(d.getTime() + 8 * 3600000).toISOString(), status: 'gepland', address: 'Kerkstraat 1, 2440 Geel', contact_name: 'Jan Peeters', contact_phone: '0470 00 00 00', instructions: 'Onderkasten eerst, eiland op het einde. Sleutel ligt bij de buren (nr. 3).', sub_note: null, project_code: '209901', project_title: 'Keuken + berging' }])
    }
    supabase.rpc('portal_my_jobs').then(({ data }) => setRows((data as Job[]) ?? []))
  }, [preview])
  useEffect(() => { load() }, [load])
  if (rows === null) return <p className="muted">{t.loading}</p>
  if (rows.length === 0) return <>{empty}</>
  const now = Date.now()
  const next = rows.filter((r) => r.status !== 'klaar' || new Date(r.end_at).getTime() > now - 86400000)
  const past = rows.filter((r) => !next.includes(r)).reverse()
  return (
    <div className="jobs">
      {next.length > 0 && <h2 className="portal-h">{t.jobs.upcoming}</h2>}
      {next.map((j) => <JobCard key={j.id} j={j} lang={lang} preview={preview} onChange={load} />)}
      {past.length > 0 && <h2 className="portal-h">{t.jobs.past}</h2>}
      {past.map((j) => <JobCard key={j.id} j={j} lang={lang} preview={preview} onChange={load} compact />)}
    </div>
  )
}

function JobCard({ j, lang, preview, onChange, compact }: { j: Job; lang: Lang; preview: boolean; onChange: () => void; compact?: boolean }) {
  const t = tr(lang)
  const loc = lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-BE' : 'nl-BE'
  const [files, setFiles] = useState<{ name: string; url?: string; werf: boolean; path: string }[]>([])
  const [note, setNote] = useState(j.sub_note ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(0)
  const [open, setOpen] = useState(!compact)
  const loadFiles = useCallback(async () => {
    if (preview) return
    const [a, b] = await Promise.all([supabase.storage.from(BUCKET).list(j.id), supabase.storage.from(BUCKET).list(j.id + '/werf')])
    const list = [
      ...(a.data ?? []).filter((f) => f.id).map((f) => ({ name: f.name.replace(/^\d+-/, ''), path: `${j.id}/${f.name}`, werf: false })),
      ...(b.data ?? []).filter((f) => f.id).map((f) => ({ name: f.name.replace(/^\d+-/, ''), path: `${j.id}/werf/${f.name}`, werf: true })),
    ]
    const { data } = list.length ? await supabase.storage.from(BUCKET).createSignedUrls(list.map((f) => f.path), 3600) : { data: [] }
    setFiles(list.map((f) => ({ ...f, url: data?.find((d) => d.path === f.path)?.signedUrl ?? undefined })))
  }, [j.id, preview])
  useEffect(() => { if (open) loadFiles() }, [open, loadFiles])

  const update = async (status: string | null, n: string | null) => {
    if (preview) return
    const { error } = await supabase.rpc('portal_job_update', { p_job: j.id, p_status: status, p_note: n })
    setMsg(error ? error.message : t.jobs.sent)
    onChange()
  }
  const upload = async (list: FileList | null) => {
    if (!list?.length || preview) return
    for (const f of Array.from(list)) {
      setBusy((b) => b + 1)
      const safe = f.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
      const { error } = await supabase.storage.from(BUCKET).upload(`${j.id}/werf/${Date.now()}-${safe}`, f)
      setBusy((b) => b - 1)
      if (error) setMsg(`${f.name}: ${error.message}`)
    }
    loadFiles()
  }
  const s = new Date(j.start_at), e = new Date(j.end_at)
  const time = (d: Date) => d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  const day = s.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
  const plans = files.filter((f) => !f.werf), photos = files.filter((f) => f.werf)
  const tel = (j.contact_phone ?? '').replace(/[^\d+]/g, '')

  return (
    <article className={'portal-project job-card ' + j.status}>
      <div className="portal-project-head" onClick={() => compact && setOpen(!open)} style={compact ? { cursor: 'pointer' } : undefined}>
        <div>
          <span className="portal-code">{day} · {time(s)}–{s.toDateString() === e.toDateString() ? time(e) : e.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) + ' ' + time(e)}</span>
          <h2>{j.title}</h2>
          {j.project_code && <p className="muted">{t.jobs.project} {j.project_code}{j.project_title ? ` · ${j.project_title}` : ''}</p>}
        </div>
        <span className={'job-st ' + j.status}>{t.jobs.status[j.status] ?? j.status}</span>
      </div>
      {open && (
        <>
          <dl className="job-facts">
            {j.address && <div><dt>{t.jobs.where}</dt><dd>{j.address} · <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}`} target="_blank" rel="noreferrer">{t.jobs.route}</a></dd></div>}
            {(j.contact_name || j.contact_phone) && <div><dt>{t.jobs.contact}</dt><dd>{j.contact_name}{j.contact_phone && <> · <a href={`tel:${tel}`}>{j.contact_phone}</a></>}</dd></div>}
          </dl>
          {j.instructions && <div className="job-info"><strong>{t.jobs.info}</strong><p>{j.instructions}</p></div>}
          {plans.length > 0 && (
            <div className="job-files"><strong>{t.jobs.files}</strong>
              <div className="uploads">{plans.map((f) => (
                <a key={f.path} className="upl" href={f.url} target="_blank" rel="noreferrer">
                  {/\.(jpe?g|png|webp|gif)$/i.test(f.path) && f.url ? <img src={f.url} alt="" /> : <span className="upl-file">{f.path.split('.').pop()?.toUpperCase()}</span>}
                  <span className="upl-name">{f.name}</span>
                </a>
              ))}</div>
            </div>
          )}
          {j.status !== 'klaar' && (
            <div className="toolbar job-actions">
              {j.status === 'gepland' && <button className="primary" disabled={preview} onClick={() => update('bevestigd', null)}>✓ {t.jobs.confirm}</button>}
              {j.status === 'bevestigd' && <button disabled={preview} onClick={() => update('bezig', null)}>{t.jobs.start}</button>}
              {(j.status === 'bevestigd' || j.status === 'bezig') && <button className="primary" disabled={preview} onClick={() => update('klaar', note || null)}>{t.jobs.markDone}</button>}
            </div>
          )}
          <label className="q">{t.jobs.note}
            <textarea rows={2} value={note} disabled={preview} placeholder={t.jobs.notePh} onChange={(ev) => setNote(ev.target.value)} />
          </label>
          <div className="toolbar"><button disabled={preview || note === (j.sub_note ?? '')} onClick={() => update(null, note)}>{t.jobs.send}</button>{msg && <span className="muted small">{msg}</span>}</div>
          <div className="job-files"><strong>{t.jobs.photos}</strong>
            <div className="uploads">
              {photos.map((f) => (
                <a key={f.path} className="upl" href={f.url} target="_blank" rel="noreferrer">
                  {f.url && /\.(jpe?g|png|webp|gif|heic)$/i.test(f.path) ? <img src={f.url} alt="" /> : <span className="upl-file">{f.path.split('.').pop()?.toUpperCase()}</span>}
                  <span className="upl-name">{f.name}</span>
                </a>
              ))}
              <label className="upl-add">
                <input type="file" multiple accept="image/*,video/*" disabled={preview} onChange={(ev) => { upload(ev.target.files); ev.target.value = '' }} />
                {busy ? t.uploading(busy) : t.jobs.addPhotos}
              </label>
            </div>
          </div>
        </>
      )}
    </article>
  )
}
