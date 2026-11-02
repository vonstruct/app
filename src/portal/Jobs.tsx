import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { tr, type Lang } from './i18n'
import { RouteLinks } from '../core/address'
import { SLOTS, type Slot } from '../modules/agenda/JobEditor'

export type PortalJob = Job
export type ViewAs = { kind: 'onderaannemer' | 'partner'; id: string }
type Job = {
  id: string; title: string; start_at: string; end_at: string; status: string; address: string | null
  contact_name: string | null; contact_phone: string | null; instructions: string | null; sub_note: string | null
  project_code: string | null; project_title: string | null; job_type?: string | null; slot?: string | null
  proposed_start?: string | null; proposed_end?: string | null; proposed_slot?: string | null; proposal_note?: string | null
}
const BUCKET = 'job-files'

/** Opdrachten voor onderaannemers en partners, met alle info om het werk te doen. */
export function Jobs({ lang, preview, empty, viewAs }: { lang: Lang; preview: boolean; empty: React.ReactNode; viewAs?: ViewAs | null }) {
  const t = tr(lang)
  const [rows, setRows] = useState<Job[] | null>(null)
  const load = useCallback(() => {
    if (viewAs) {
      // beheerder bekijkt de echte opdrachten van één onderaannemer/partner
      supabase.from('jobs').select('*, projects(title, site_street, site_postal_code, site_city, clients(first_name, last_name, phone))')
        .eq(viewAs.kind === 'partner' ? 'partner_id' : 'subcontractor_id', viewAs.id).neq('status', 'geannuleerd').order('start_at')
        .then(({ data }) => setRows(((data ?? []) as AdminRow[]).map(fromAdminRow)))
      return
    }
    if (preview) {
      const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(8, 0, 0, 0)
      return setRows([{ id: 'x', title: 'Keuken plaatsen', start_at: d.toISOString(), end_at: new Date(d.getTime() + 8 * 3600000).toISOString(), status: 'gepland', job_type: 'Nieuwbouw', slot: 'dag', address: 'Kerkstraat 1, 2440 Geel', contact_name: 'Jan Peeters', contact_phone: '0470 00 00 00', instructions: 'Onderkasten eerst, eiland op het einde. Sleutel ligt bij de buren (nr. 3).', sub_note: null, project_code: '209901', project_title: 'Keuken + berging' }])
    }
    supabase.rpc('portal_my_jobs').then(({ data }) => setRows((data as Job[]) ?? []))
  }, [preview, viewAs])
  useEffect(() => { load() }, [load])
  if (rows === null) return <p className="muted">{t.loading}</p>
  if (rows.length === 0) return <>{empty}</>
  const now = Date.now()
  const next = rows.filter((r) => r.status !== 'klaar' || new Date(r.end_at).getTime() > now - 86400000)
  const past = rows.filter((r) => !next.includes(r)).reverse()
  return (
    <div className="jobs">
      {next.length > 0 && <h2 className="portal-h">{t.jobs.upcoming}</h2>}
      {next.map((j) => <JobCard key={j.id} j={j} lang={lang} preview={preview} demo={preview && !viewAs} onChange={load} />)}
      {past.length > 0 && <h2 className="portal-h">{t.jobs.past}</h2>}
      {past.map((j) => <JobCard key={j.id} j={j} lang={lang} preview={preview} demo={preview && !viewAs} onChange={load} compact />)}
    </div>
  )
}

export function JobCard({ j, lang, preview, demo = false, onChange, compact }: { j: Job; lang: Lang; preview: boolean; demo?: boolean; onChange: () => void; compact?: boolean }) {
  const t = tr(lang)
  const loc = lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-BE' : 'nl-BE'
  const [files, setFiles] = useState<{ name: string; url?: string; werf: boolean; path: string }[]>([])
  const [note, setNote] = useState(j.sub_note ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(0)
  const [open, setOpen] = useState(!compact)
  const loadFiles = useCallback(async () => {
    if (demo) return
    const [a, b] = await Promise.all([supabase.storage.from(BUCKET).list(j.id), supabase.storage.from(BUCKET).list(j.id + '/werf')])
    const list = [
      ...(a.data ?? []).filter((f) => f.id).map((f) => ({ name: f.name.replace(/^\d+-/, ''), path: `${j.id}/${f.name}`, werf: false })),
      ...(b.data ?? []).filter((f) => f.id).map((f) => ({ name: f.name.replace(/^\d+-/, ''), path: `${j.id}/werf/${f.name}`, werf: true })),
    ]
    const { data } = list.length ? await supabase.storage.from(BUCKET).createSignedUrls(list.map((f) => f.path), 3600) : { data: [] }
    setFiles(list.map((f) => ({ ...f, url: data?.find((d) => d.path === f.path)?.signedUrl ?? undefined })))
  }, [j.id, demo])
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
  const [prop, setProp] = useState(false)
  const fmtWhen = (a: string, b: string, sl?: string | null) => {
    const x = new Date(a), y = new Date(b)
    const d = (z: Date) => z.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
    if (sl) return x.toDateString() === y.toDateString() ? `${d(x)} · ${t.jobs.slots[sl]}` : `${d(x)} ${t.jobs.until} ${d(y)}`
    return `${d(x)} · ${time(x)}–${time(y)}`
  }
  const plans = files.filter((f) => !f.werf), photos = files.filter((f) => f.werf)
  const tel = (j.contact_phone ?? '').replace(/[^\d+]/g, '')

  return (
    <article className={'portal-project job-card ' + j.status}>
      <div className="portal-project-head" onClick={() => compact && setOpen(!open)} style={compact ? { cursor: 'pointer' } : undefined}>
        <div>
          <span className="portal-code">{j.slot ? (s.toDateString() === e.toDateString() ? `${day} · ${t.jobs.slots[j.slot]}` : `${day} ${t.jobs.until} ${e.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}`) : `${day} · ${time(s)}–${s.toDateString() === e.toDateString() ? time(e) : e.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) + ' ' + time(e)}`}{j.job_type ? ` · ${t.jobs.types[j.job_type] ?? j.job_type}` : ''}</span>
          <h2>{j.title}</h2>
          {j.project_code && <p className="muted">{t.jobs.project} {j.project_code}{j.project_title ? ` · ${j.project_title}` : ''}</p>}
        </div>
        <span className={'job-st ' + j.status}>{t.jobs.status[j.status] ?? j.status}</span>
      </div>
      {open && (
        <>
          <dl className="job-facts">
            {j.address && <div><dt>{t.jobs.where}</dt><dd>{j.address}<br /><RouteLinks address={j.address} className="job-route" /></dd></div>}
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
          {j.status === 'voorstel' && j.proposed_start && (
            <div className="proposal"><strong>⇄ {t.jobs.proposedWait}</strong><p>{fmtWhen(j.proposed_start, j.proposed_end!, j.proposed_slot)}{j.proposal_note ? ` – “${j.proposal_note}”` : ''}</p></div>
          )}
          {prop && <ProposeForm j={j} lang={lang} onDone={() => { setProp(false); onChange() }} onCancel={() => setProp(false)} />}
          {j.status !== 'klaar' && !prop && (
            <div className="toolbar job-actions">
              {j.status === 'gepland' && <button className="primary" disabled={preview} onClick={() => update('bevestigd', null)}>✓ {t.jobs.confirm}</button>}
              {j.status === 'bevestigd' && <button disabled={preview} onClick={() => update('bezig', null)}>{t.jobs.start}</button>}
              {(j.status === 'bevestigd' || j.status === 'bezig') && <button className="primary" disabled={preview} onClick={() => update('klaar', note || null)}>{t.jobs.markDone}</button>}
              {['gepland', 'bevestigd', 'voorstel'].includes(j.status) && <button disabled={preview} onClick={() => setProp(true)}>⇄ {t.jobs.propose}</button>}
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

/** Onderaannemer stelt een ander moment voor (dagdeel of vast uur). */
function ProposeForm({ j, lang, onDone, onCancel }: { j: Job; lang: Lang; onDone: () => void; onCancel: () => void }) {
  const t = tr(lang)
  const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString() }
  const [slot, setSlot] = useState<Slot | ''>((j.slot as Slot) ?? '')
  const [date, setDate] = useState(local(j.start_at).slice(0, 10))
  const [from, setFrom] = useState(local(j.start_at).slice(11, 16))
  const [to, setTo] = useState(local(j.end_at).slice(11, 16))
  const [days, setDays] = useState(1)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    let s: Date, e: Date
    const hm = (d: string, [h, m]: [number, number]) => { const x = new Date(d + 'T00:00'); x.setHours(h, m, 0, 0); return x }
    if (slot) {
      s = hm(date, SLOTS[slot].from)
      const end = new Date(date + 'T12:00'); end.setDate(end.getDate() + (slot === 'dag' ? days - 1 : 0))
      const ymd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      e = hm(ymd, SLOTS[slot].to)
    } else {
      s = new Date(`${date}T${from}`); e = new Date(`${date}T${to}`)
    }
    if (!(e > s)) return setErr('⚠')
    setBusy(true)
    const { error } = await supabase.rpc('portal_job_propose', { p_job: j.id, p_start: s.toISOString(), p_end: e.toISOString(), p_slot: slot || null, p_note: reason })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="proposal">
      <strong>⇄ {t.jobs.propose}</strong>
      <p className="muted small">{t.jobs.proposeIntro}</p>
      <div className="slot-pick">
        {(Object.keys(SLOTS) as Slot[]).map((k) => <button key={k} type="button" className={slot === k ? 'on' : ''} onClick={() => setSlot(k)}>{t.jobs.slots[k]}</button>)}
        <button type="button" className={!slot ? 'on' : ''} onClick={() => setSlot('')}>{t.jobs.fixedTime}</button>
      </div>
      <div className="form-grid" style={{ marginTop: 10 }}>
        <label>{t.jobs.date}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {slot === 'dag' && <label>{t.jobs.days}<input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} /></label>}
        {!slot && <label>{t.jobs.from}<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></label>}
        {!slot && <label>{t.jobs.to}<input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></label>}
        <label className="wide">{t.jobs.reason}<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      {err && <p className="error small">{err}</p>}
      <div className="toolbar"><button className="primary" disabled={busy} onClick={send}>{t.jobs.proposeSend}</button><button onClick={onCancel}>{t.jobs.cancel}</button></div>
    </div>
  )
}

type AdminRow = Record<string, unknown> & { id: string; title: string; start_at: string; end_at: string; status: string; address: string | null; contact_name: string | null; contact_phone: string | null; instructions: string | null; sub_note: string | null; project_code: string | null; job_type: string | null; slot: string | null; proposed_start: string | null; proposed_end: string | null; proposed_slot: string | null; proposal_note: string | null; projects: { title: string | null; site_street: string | null; site_postal_code: string | null; site_city: string | null; clients: { first_name: string | null; last_name: string | null; phone: string | null } | null } | null }
/** Opdracht uit de tabel omzetten naar wat het portaal toont (zelfde regels als portal_my_jobs). */
export function fromAdminRow(r: AdminRow): Job {
  const p = r.projects
  const siteAddr = p ? [p.site_street, [p.site_postal_code, p.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  return {
    id: r.id, title: r.title, start_at: r.start_at, end_at: r.end_at, status: r.status,
    address: r.address ?? (siteAddr || null),
    contact_name: r.contact_name ?? ([p?.clients?.first_name, p?.clients?.last_name].filter(Boolean).join(' ') || null),
    contact_phone: r.contact_phone ?? p?.clients?.phone ?? null,
    instructions: r.instructions, sub_note: r.sub_note, project_code: r.project_code, project_title: p?.title ?? null,
    job_type: r.job_type, slot: r.slot, proposed_start: r.proposed_start, proposed_end: r.proposed_end, proposed_slot: r.proposed_slot, proposal_note: r.proposal_note,
  }
}
