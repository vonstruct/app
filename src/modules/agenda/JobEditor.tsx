import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { AddressFields, RouteLinks } from '../../core/address'
import { JobCard, fromAdminRow } from '../../portal/Jobs'

/** Opdracht voor een onderaannemer of partner. Zichtbaar in de agenda en in hun portaal. */
export type Job = {
  id: string
  project_code: string | null
  subcontractor_id: string | null
  partner_id: string | null
  title: string
  start_at: string
  end_at: string
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  instructions: string | null
  status: 'gepland' | 'bevestigd' | 'voorstel' | 'bezig' | 'klaar' | 'geannuleerd'
  proposed_start: string | null
  proposed_end: string | null
  proposed_slot: Slot | null
  proposal_note: string | null
  decided_by: string | null
  decided_at: string | null
  job_type: (typeof JOB_TYPES)[number] | null
  slot: Slot | null
  for_me: boolean
  show_client: boolean
  notify_client: boolean
  sub_note: string | null
  confirmed_at: string | null
  outlook_event_id?: string | null
  teams?: boolean
  teams_url?: string | null
  client_confirmed_at?: string | null
  prev_start?: string | null
  prev_end?: string | null
  prev_slot?: Slot | null
  changed_by?: string | null
  change_note?: string | null
  changed_at?: string | null
  done_at: string | null
}
export type JobDraft = Partial<Job> & { title?: string; start_at?: string; end_at?: string }
type Who = { key: string; kind: 'onderaannemer' | 'partner' | 'mezelf'; id: string; name: string; email: string | null; phone: string | null; contact: string | null }
type P = { project_code: string; title: string | null; site_street: string | null; site_postal_code: string | null; site_city: string | null; clients: { first_name: string | null; last_name: string | null; phone: string | null; email: string | null } | null }

export type Slot = 'dag' | 'voormiddag' | 'namiddag'
/** Vaste uren per dagdeel. */
export const SLOTS: Record<Slot, { label: string; from: [number, number]; to: [number, number] }> = {
  dag: { label: 'Hele dag', from: [8, 0], to: [16, 30] },
  voormiddag: { label: 'Voormiddag', from: [8, 0], to: [12, 0] },
  namiddag: { label: 'Namiddag', from: [12, 30], to: [16, 30] },
}
export const JOB_TYPES = ['Herstelling', 'Renovatie', 'Nieuwbouw', 'Ophaling', 'Bestellen', 'Productie'] as const
const at = (d: Date, [h, m]: [number, number]) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x }
const dayInput = (iso: string) => toLocalInput(iso).slice(0, 10)
export const JOB_STATUS: Record<Job['status'], string> = { gepland: 'Wacht op bevestiging', bevestigd: 'Bevestigd', voorstel: 'Ander moment voorgesteld', bezig: 'Bezig', klaar: 'Klaar', geannuleerd: 'Geschrapt' }
const BUCKET = 'job-files'
const LINK = 'https://app.vonstruct.com'
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const waNumber = (phone: string | null) => {
  let d = (phone ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = '32' + d.slice(1)
  return d
}
export const when = (s: string, e: string, slot?: Slot | null) => {
  if (slot) {
    const a = new Date(s), b = new Date(e)
    const d = (x: Date) => x.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })
    return a.toDateString() === b.toDateString() ? `${d(a)}, ${SLOTS[slot].label.toLowerCase()}` : `${d(a)} t.e.m. ${d(b)} (hele dagen)`
  }
  const a = new Date(s), b = new Date(e)
  const day = a.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  const t = (d: Date) => d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  return a.toDateString() === b.toDateString() ? `${day}, ${t(a)}–${t(b)}` : `${day} ${t(a)} tot ${b.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })} ${t(b)}`
}

export function JobEditor({ draft, onClose, onSaved }: { draft: JobDraft; onClose: () => void; onSaved: () => void }) {
  const [who, setWho] = useState<Who[]>([])
  const [projects, setProjects] = useState<P[]>([])
  const [j, setJ] = useState<JobDraft>(() => {
    const s = draft.start_at ?? new Date(new Date().setHours(8, 0, 0, 0)).toISOString()
    return { status: 'gepland', show_client: true, notify_client: false, ...draft, start_at: s, end_at: draft.end_at ?? new Date(new Date(s).getTime() + 4 * 3600000).toISOString() }
  })
  const [files, setFiles] = useState<{ name: string; path: string; url?: string; werf: boolean }[]>([])
  const [pending, setPending] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState<{ text: string; to: Who } | null>(null)
  const [tpl, setTpl] = useState<Record<string, string>>({})
  const isNew = !j.id
  const [asSub, setAsSub] = useState(false)
  // projectdocumenten die de onderaannemer ook ziet (tab Documenten, vinkje "onderaannemers")
  const [projDocs, setProjDocs] = useState<string[]>([])
  useEffect(() => {
    if (!j.project_code) { setProjDocs([]); return }
    supabase.from('project_documents').select('title').eq('project_code', j.project_code).eq('show_sub', true).eq('archived', false)
      .then(({ data }) => setProjDocs(((data as { title: string }[]) ?? []).map((d) => d.title)))
  }, [j.project_code])
  const [log, setLog] = useState<{ at: string; actor: string | null; what: string }[]>([])
  useEffect(() => { if (j.id) supabase.from('job_log').select('at,actor,what').eq('job_id', j.id).order('at', { ascending: false }).then(({ data }) => setLog((data as typeof log) ?? [])) }, [j.id, j.status, j.start_at])
  const confirmFor = async (who: 'onderaannemer' | 'klant') => {
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('job_confirm', { p_job: j.id, p_for: who })
    if (error) { setBusy(false); return setErr(error.message) }
    const { data } = await supabase.from('jobs').select('*').eq('id', j.id!).single()
    setBusy(false)
    if (data) setJ(data as Job)
    onSaved()
  }


  useEffect(() => {
    Promise.all([
      supabase.from('subcontractors').select('id,name,email,phone,contact_person,trade,active').order('name'),
      supabase.from('partners').select('id,name,email,phone,contact_person,active').order('name'),
      supabase.from('projects').select('project_code,title,site_street,site_postal_code,site_city,clients(first_name,last_name,phone,email)').order('project_code', { ascending: false }),
      supabase.from('message_templates').select('key,body').eq('lang', 'nl').in('key', ['opdracht', 'opdracht_gewijzigd']),
    ]).then(([s, p, pr, t]) => {
      const out: Who[] = [{ key: 'me', kind: 'mezelf', id: '', name: 'Mezelf (Vonstruct)', email: null, phone: null, contact: null }]
      for (const r of (s.data ?? []) as { id: string; name: string; email: string | null; phone: string | null; contact_person: string | null; trade: string | null }[]) out.push({ key: 's:' + r.id, kind: 'onderaannemer', id: r.id, name: r.trade ? `${r.name} (${r.trade})` : r.name, email: r.email, phone: r.phone, contact: r.contact_person })
      for (const r of (p.data ?? []) as { id: string; name: string; email: string | null; phone: string | null; contact_person: string | null }[]) out.push({ key: 'p:' + r.id, kind: 'partner', id: r.id, name: r.name, email: r.email, phone: r.phone, contact: r.contact_person })
      setWho(out)
      setProjects((pr.data as unknown as P[]) ?? [])
      setTpl(Object.fromEntries(((t.data ?? []) as { key: string; body: string }[]).map((x) => [x.key, x.body])))
    })
  }, [])

  const loadFiles = async (id: string) => {
    const [a, b] = await Promise.all([supabase.storage.from(BUCKET).list(id), supabase.storage.from(BUCKET).list(id + '/werf')])
    const list = [
      ...(a.data ?? []).filter((f) => f.id).map((f) => ({ name: f.name.replace(/^\d+-/, ''), path: `${id}/${f.name}`, werf: false })),
      ...(b.data ?? []).filter((f) => f.id).map((f) => ({ name: f.name.replace(/^\d+-/, ''), path: `${id}/werf/${f.name}`, werf: true })),
    ]
    const { data } = list.length ? await supabase.storage.from(BUCKET).createSignedUrls(list.map((f) => f.path), 3600) : { data: [] }
    setFiles(list.map((f) => ({ ...f, url: data?.find((d) => d.path === f.path)?.signedUrl ?? undefined })))
  }
  useEffect(() => { if (j.id) loadFiles(j.id) }, [j.id])

  const assignee = who.find((w) => (j.for_me && w.key === 'me') || (j.subcontractor_id && w.key === 's:' + j.subcontractor_id) || (j.partner_id && w.key === 'p:' + j.partner_id))
  const set = (patch: Partial<Job>) => setJ((x) => ({ ...x, ...patch }))
  const pickProject = (code: string) => {
    const p = projects.find((x) => x.project_code === code)
    if (!p) return set({ project_code: null })
    const addr = [p.site_street, [p.site_postal_code, p.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const cname = [p.clients?.first_name, p.clients?.last_name].filter(Boolean).join(' ')
    set({ project_code: code, address: j.address || addr || null, contact_name: j.contact_name || cname || null, contact_phone: j.contact_phone || p.clients?.phone || null })
  }
  const slot = j.slot ?? null
  const days = slot === 'dag' ? Math.max(1, Math.round((new Date(dayInput(j.end_at!)).getTime() - new Date(dayInput(j.start_at!)).getTime()) / 86400000) + 1) : 1
  const setSlot = (sl: Slot | null, day = new Date(j.start_at!), n = days) => {
    if (!sl) return set({ slot: null })
    const end = new Date(day); end.setDate(end.getDate() + (sl === 'dag' ? n - 1 : 0))
    set({ slot: sl, start_at: at(day, SLOTS[sl].from).toISOString(), end_at: at(end, SLOTS[sl].to).toISOString() })
  }
  const dur = Math.round((new Date(j.end_at!).getTime() - new Date(j.start_at!).getTime()) / 3600000 * 4) / 4

  const save = async () => {
    if (!j.title?.trim()) return setErr('Geef de opdracht een omschrijving (bv. "Keuken plaatsen").')
    if (!assignee) return setErr('Kies voor wie de opdracht is.')
    if (assignee.kind !== 'mezelf' && !assignee.email) return setErr(`${assignee.name} heeft nog geen e-mailadres. Zonder e-mailadres kan hij/zij niet inloggen op het portaal. Vul het eerst in bij Relaties.`)
    if (new Date(j.end_at!) <= new Date(j.start_at!)) return setErr('Het einde ligt voor het begin.')
    setBusy(true); setErr(null)
    const row = {
      project_code: j.project_code || null, for_me: assignee.kind === 'mezelf', show_client: j.show_client ?? true, notify_client: !!(j.notify_client && (j.show_client ?? true)), subcontractor_id: assignee.kind === 'onderaannemer' ? assignee.id : null, partner_id: assignee.kind === 'partner' ? assignee.id : null,
      title: j.title.trim(), start_at: j.start_at, end_at: j.end_at, address: j.address || null, contact_name: j.contact_name || null, contact_phone: j.contact_phone || null,
      instructions: j.instructions || null, status: j.status ?? 'gepland', job_type: j.job_type || null, slot: j.slot || null, teams: j.teams ?? true, updated_at: new Date().toISOString(),
    }
    const res = isNew ? await supabase.from('jobs').insert(row).select('*').single() : await supabase.from('jobs').update(row).eq('id', j.id!).select('*').single()
    if (res.error) { setBusy(false); return setErr(res.error.message) }
    const saved = res.data as Job
    for (const f of pending) {
      const safe = f.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
      const { error } = await supabase.storage.from(BUCKET).upload(`${saved.id}/${Date.now()}-${safe}`, f)
      if (error) setErr(`${f.name}: ${error.message}`)
    }
    setPending([])
    setJ(saved)
    await loadFiles(saved.id)
    setBusy(false)
    const body = (tpl[isNew ? 'opdracht' : 'opdracht_gewijzigd'] ?? '')
      .replaceAll('{voornaam}', (assignee.contact || assignee.name).split(' ')[0])
      .replaceAll('{naam}', assignee.name)
      .replaceAll('{titel}', saved.title)
      .replaceAll('{wanneer}', when(saved.start_at, saved.end_at, saved.slot))
      .replaceAll('{type}', saved.job_type ?? '')
      .replaceAll('{adres}', saved.address ? `${saved.address}\nRoute: https://waze.com/ul?q=${encodeURIComponent(saved.address)}&navigate=yes` : '—')
      .replaceAll('{contact}', [saved.contact_name, saved.contact_phone].filter(Boolean).join(', ') || '—')
      .replaceAll('{link}', LINK)
    onSaved()
    if (assignee.kind === 'mezelf') return onClose()
    setSent({ text: body, to: assignee })
  }
  const [upBusy, setUpBusy] = useState(0)
  const uploadNow = async (list: File[]) => {
    for (const f of list) {
      setUpBusy((b) => b + 1)
      const safe = f.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
      const { error } = await supabase.storage.from(BUCKET).upload(`${j.id}/${Date.now()}-${safe}`, f)
      setUpBusy((b) => b - 1)
      if (error) setErr(`${f.name}: ${error.message}`)
    }
    if (j.id) loadFiles(j.id)
  }
  // schrappen: status geannuleerd → iedereen krijgt bericht en de afspraak verdwijnt uit alle agenda's
  const cancelJob = async () => {
    if (!j.id) return
    if (!window.confirm('Opdracht schrappen? De onderaannemer (en de klant, als die in de loop zit) krijgt een bericht dat ze niet doorgaat, en ze verdwijnt uit alle agenda\'s.')) return
    setBusy(true); setErr(null)
    const { error } = await supabase.from('jobs').update({ status: 'geannuleerd', updated_at: new Date().toISOString() }).eq('id', j.id)
    setBusy(false)
    if (error) return setErr(error.message)
    set({ status: 'geannuleerd' })
    onSaved()
  }
  // definitief verwijderen (enkel na schrappen, zodat iedereen eerst verwittigd is)
  const deleteJob = async () => {
    if (!j.id) return
    if (!window.confirm('Opdracht definitief verwijderen, met bestanden en geschiedenis? Dit kan niet ongedaan gemaakt worden.')) return
    setBusy(true); setErr(null)
    const paths = files.map((f) => f.path)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    const { error } = await supabase.from('jobs').delete().eq('id', j.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
    onClose()
  }
  const removeFile = async (path: string) => { await supabase.storage.from(BUCKET).remove([path]); if (j.id) loadFiles(j.id) }
  const invite = async () => {
    if (!assignee?.email) return setErr('Vul eerst het e-mailadres in bij Relaties.')
    const { data, error } = await supabase.functions.invoke('invite-client', { body: { team_email: assignee.email } })
    const e = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    setErr(e ? e : null)
    if (!e) alert((data as { mode: string }).mode === 'invited' ? `Uitnodiging voor het portaal verstuurd naar ${assignee.email}.` : `${assignee.email} had al toegang: er is een inloglink verstuurd.`)
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="toolbar"><span className={'chip agenda-cat cat-' + (assignee?.kind ?? 'onderaannemer')}><i />Opdracht</span>{!isNew && <span className={'chip job-st ' + j.status}>{JOB_STATUS[j.status!]}</span>}</span>
          <button className="link" onClick={onClose} aria-label="Sluiten">✕</button>
        </div>
        <h2>{isNew ? 'Nieuwe opdracht' : j.title}</h2>
        {sent ? (
          <div className="msg-box">
            <p className="notice">Opdracht bewaard{files.length ? ` met ${files.length} bestand(en)` : ''}. {sent.to.name} krijgt een uitnodiging in zijn agenda (vanuit info@) en ziet de opdracht in het portaal. Wil je ook een berichtje sturen?</p>
            <textarea readOnly rows={9} value={sent.text} />
            <div className="toolbar">
              {waNumber(sent.to.phone) ? <a className="btn-wa" href={`https://wa.me/${waNumber(sent.to.phone)}?text=${encodeURIComponent(sent.text)}`} target="_blank" rel="noreferrer">Versturen via WhatsApp</a> : <span className="muted small">Geen telefoonnummer bij Relaties.</span>}
              {sent.to.email && <a className="btn-plain" href={`mailto:${sent.to.email}?subject=${encodeURIComponent('Opdracht Vonstruct: ' + j.title)}&body=${encodeURIComponent(sent.text)}`}>Per mail</a>}
              <button onClick={() => navigator.clipboard.writeText(sent.text)}>Kopiëren</button>
              <button onClick={() => setSent(null)}>Verder bewerken</button>
              <button className="primary" onClick={onClose}>Klaar</button>
            </div>
            <p className="muted small">Nog geen toegang tot het portaal? <button className="link" onClick={invite}>Stuur {sent.to.name} een uitnodiging</button> (mail in huisstijl).</p>
          </div>
        ) : (
          <>
            {!isNew && assignee?.kind !== 'mezelf' && (
              <p><button type="button" className="link" onClick={() => setAsSub(!asSub)}>{asSub ? '▾' : '▸'} Zo ziet {assignee?.name ?? 'de onderaannemer'} deze opdracht in het portaal</button></p>
            )}
            {asSub && !isNew && (
              <div className="as-sub portal">
                <JobCard j={fromAdminRow({ ...(j as Job), projects: null } as unknown as Parameters<typeof fromAdminRow>[0])} lang="nl" preview onChange={() => {}} />
              </div>
            )}
            {j.status === 'geannuleerd' && <p className="auth-msg error">Geschrapt: deze opdracht gaat niet door. Iedereen kreeg bericht en ze is uit de agenda's verwijderd. Je kunt ze nu definitief verwijderen.</p>}
            {!isNew && j.status !== 'geannuleerd' && (
              <div className="confirm-box">
                <strong>Bevestigingen{j.status === 'bevestigd' || j.status === 'bezig' || j.status === 'klaar' ? ' – alles bevestigd ✓' : ''}</strong>
                {j.changed_by && j.prev_start && <p className="muted small">⇄ Moment gewijzigd door {j.changed_by === 'vonstruct' ? 'jou' : j.changed_by === 'klant' ? 'de klant' : assignee?.name ?? 'de onderaannemer'}{j.changed_at ? ` op ${new Date(j.changed_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''} · was: <s>{when(j.prev_start, j.prev_end!, j.prev_slot)}</s>{j.change_note ? ` – “${j.change_note}”` : ''}</p>}
                <ul>
                  <li><span>Vonstruct (jij)</span><b className="ok">✓ gepland</b></li>
                  {assignee && assignee.kind !== 'mezelf' && (
                    <li><span>{assignee.name}</span>{j.confirmed_at ? <b className="ok">✓ {new Date(j.confirmed_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b> : <><b className="wait">wacht</b><button className="link" disabled={busy} onClick={() => confirmFor('onderaannemer')}>bevestig namens hem/haar</button></>}</li>
                  )}
                  {j.notify_client && j.show_client && j.project_code && (
                    <li><span>Klant</span>{j.client_confirmed_at ? <b className="ok">✓ {new Date(j.client_confirmed_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b> : <><b className="wait">wacht</b><button className="link" disabled={busy} onClick={() => confirmFor('klant')}>bevestig namens de klant</button></>}</li>
                  )}
                </ul>
                <p className="muted small">Wijzig je hieronder het moment, dan moeten de anderen opnieuw bevestigen (ze krijgen een mail).</p>
              </div>
            )}
            {j.sub_note && <p className="agenda-notes agenda-mynote">💬 {assignee?.name ?? 'Onderaannemer'}: {j.sub_note}</p>}
            {j.done_at && <p className="muted small">Klaar gemeld op {new Date(j.done_at).toLocaleString('nl-BE')}</p>}
            <div className="form-grid agenda-form">
              <label>Voor
                <select value={assignee?.key ?? ''} onChange={(e) => { const w = who.find((x) => x.key === e.target.value); set({ for_me: w?.kind === 'mezelf', subcontractor_id: w?.kind === 'onderaannemer' ? w.id : null, partner_id: w?.kind === 'partner' ? w.id : null }) }}>
                  <option value="">— kies —</option>
                  <option value="me">Mezelf (Vonstruct)</option>
                  <optgroup label="Onderaannemers">{who.filter((w) => w.kind === 'onderaannemer').map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}</optgroup>
                  <optgroup label="Partners">{who.filter((w) => w.kind === 'partner').map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}</optgroup>
                </select>
                {assignee && assignee.kind !== 'mezelf' && !assignee.email && <small className="addr-bad">⚠ Geen e-mailadres. <Link to={`/relaties?tab=${assignee.kind === 'partner' ? 'partners' : 'onderaannemers'}&focus=${assignee.id}:email`} onClick={onClose}>Invullen bij Relaties</Link></small>}
              </label>
              <label>Project
                <select value={j.project_code ?? ''} onChange={(e) => pickProject(e.target.value)}>
                  <option value="">—</option>
                  {projects.map((p) => <option key={p.project_code} value={p.project_code}>{p.project_code} · {[p.clients?.first_name, p.clients?.last_name].filter(Boolean).join(' ') || p.title}</option>)}
                </select>
              </label>
              <label className="wide">Wat moet er gebeuren (korte titel)<input value={j.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Bv. Keuken plaatsen, Stopcontacten eiland aansluiten" /></label>
              <div className="wide">
                <div className="q-label"><span>Wanneer</span></div>
                <div className="slot-pick">
                  {(Object.keys(SLOTS) as Slot[]).map((k) => <button key={k} type="button" className={slot === k ? 'on' : ''} onClick={() => setSlot(k)}>{SLOTS[k].label} <small>{SLOTS[k].from.join(':').replace(/:0$/, ':00')}–{SLOTS[k].to.join(':').replace(/:0$/, ':00')}</small></button>)}
                  <button type="button" className={!slot ? 'on' : ''} onClick={() => setSlot(null)}>Vast uur</button>
                </div>
              </div>
              {slot && <label>Datum<input type="date" value={dayInput(j.start_at!)} onChange={(e) => e.target.value && setSlot(slot, new Date(e.target.value + 'T12:00'))} /></label>}
              {slot === 'dag' && <label>Aantal dagen<input type="number" min={1} max={30} value={days} onChange={(e) => setSlot('dag', new Date(j.start_at!), Math.max(1, Number(e.target.value)))} /></label>}
              {!slot && <label>Begin<input type="datetime-local" value={toLocalInput(j.start_at!)} onChange={(e) => { const s = new Date(e.target.value); const d = new Date(j.end_at!).getTime() - new Date(j.start_at!).getTime(); set({ start_at: s.toISOString(), end_at: new Date(s.getTime() + d).toISOString() }) }} /></label>}
              {!slot && <label>Duur (uur)<input type="number" min={0.25} step={0.25} value={dur} onChange={(e) => set({ end_at: new Date(new Date(j.start_at!).getTime() + Number(e.target.value) * 3600000).toISOString() })} /></label>}
              <label>Type werk
                <select value={j.job_type ?? ''} onChange={(e) => set({ job_type: (e.target.value || null) as Job['job_type'] })}>
                  <option value="">—</option>
                  {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {assignee?.kind !== 'mezelf' && (
                <label className="wide check">
                  <input type="checkbox" checked={j.teams ?? true} onChange={(e) => set({ teams: e.target.checked })} />
                  {' '}Teams-link in de uitnodiging{j.teams_url && (j.teams ?? true) ? <> · <a href={j.teams_url} target="_blank" rel="noreferrer">vergadering openen</a></> : null}
                  <small className="muted"> {assignee?.name ?? 'De onderaannemer'} krijgt een uitnodiging in zijn agenda vanuit info@ (met link naar de details en plannen). Accepteren = bevestigd.</small>
                </label>
              )}
              <label className="wide check">
                <input type="checkbox" checked={j.show_client ?? true} onChange={(e) => set({ show_client: e.target.checked })} disabled={!j.project_code} />
                {' '}Klant ziet dit in zijn portaal: datum, {assignee?.kind === 'mezelf' ? 'Vonstruct' : 'wie er komt'} en het werk (zonder instructies){!j.project_code && ' – kies eerst een project'}
              </label>
              <label className="wide check">
                <input type="checkbox" checked={!!j.notify_client && (j.show_client ?? true)} onChange={(e) => set({ notify_client: e.target.checked })} disabled={!j.project_code || !(j.show_client ?? true)} />
                {' '}Klant in de loop: klant krijgt mails (in zijn taal) en moet het moment ook bevestigen; hij kan zelf een ander moment voorstellen{(() => { const e = projects.find((p) => p.project_code === j.project_code)?.clients?.email; return e ? <b className="addr-bad"> → mails gaan naar {e}</b> : null })()}
              </label>
              <AddressFields value={j.address ?? null} onChange={(v) => set({ address: v })} />
              <label>Contact ter plaatse<input value={j.contact_name ?? ''} onChange={(e) => set({ contact_name: e.target.value })} /></label>
              <label>Telefoon contact<input type="tel" value={j.contact_phone ?? ''} onChange={(e) => set({ contact_phone: e.target.value })} /></label>
              <label className="wide">Instructies en info
                <textarea rows={6} value={j.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} placeholder={'Wat moet er precies gebeuren, materiaal, toegang (sleutel, code), parkeren, aandachtspunten…'} />
              </label>
              {!isNew && (
                <label>Status
                  <select value={j.status} onChange={(e) => set({ status: e.target.value as Job['status'] })}>
                    {Object.entries(JOB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="q">
              <div className="q-label"><span>Plannen, tekeningen en foto's</span><small>Zichtbaar voor de onderaannemer via "Details en plannen" in de uitnodiging en in het portaal. Foto's van de werf (van de onderaannemer) staan apart.</small></div>
              {j.project_code && assignee?.kind !== 'mezelf' && (
                <p className="muted small" style={{ margin: '0 0 6px' }}>
                  {projDocs.length ? <>Ziet ook {projDocs.length} document{projDocs.length === 1 ? '' : 'en'} van het project: {projDocs.slice(0, 4).join(', ')}{projDocs.length > 4 ? ' …' : ''}. </> : 'Nog geen projectdocumenten voor onderaannemers. '}
                  <Link to={`/projecten/${j.project_code}?tab=documenten`}>Documenten van {j.project_code}</Link> (vinkje "onderaannemers").
                </p>
              )}
              <div className="uploads">
                {files.map((f) => (
                  <div key={f.path} className="upl">
                    {/\.(jpe?g|png|webp|gif|heic)$/i.test(f.path) && f.url ? <img src={f.url} alt="" /> : <span className="upl-file">{f.path.split('.').pop()?.toUpperCase()}</span>}
                    <a href={f.url} target="_blank" rel="noreferrer" className="upl-name">{f.werf ? '📷 ' : ''}{f.name}</a>
                    {!f.werf && <button type="button" className="link danger" onClick={() => removeFile(f.path)}>✕</button>}
                  </div>
                ))}
                {pending.map((f) => <div key={f.name} className="upl"><span className="upl-file">NIEUW</span><span className="upl-name">{f.name}</span><button type="button" className="link danger" onClick={() => setPending((p) => p.filter((x) => x !== f))}>✕</button></div>)}
                <label className="upl-add">
                  <input type="file" multiple onChange={(e) => { const list = Array.from(e.target.files ?? []); e.target.value = ''; if (j.id) uploadNow(list); else setPending((p) => [...p, ...list]) }} />
                  {upBusy ? `Opladen… (${upBusy})` : '+ Bestanden toevoegen'}
                </label>
              </div>
            </div>
            {log.length > 0 && (
              <details className="job-log"><summary>Geschiedenis ({log.length})</summary>
                <ul>{log.map((l, i) => <li key={i}><span className="muted small">{new Date(l.at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {l.actor === 'info@vonstruct.com' ? 'jij' : l.actor ?? '—'}</span> {l.what}</li>)}</ul>
              </details>
            )}
            {err && <p className="auth-msg error">{err}</p>}
            <div className="toolbar">
              <button className="primary" disabled={busy} onClick={save}>{busy ? 'Bewaren…' : isNew ? 'Opdracht aanmaken' : 'Bewaren'}</button>
              <button onClick={onClose}>Sluiten</button>
              {!isNew && j.status !== 'geannuleerd' && <button className="danger-btn" disabled={busy} onClick={cancelJob}>Opdracht schrappen</button>}
              {!isNew && j.status === 'geannuleerd' && <button className="danger-btn" disabled={busy} onClick={deleteJob}>🗑 Definitief verwijderen</button>}
              {j.project_code && <Link to={`/projecten/${j.project_code}`} onClick={onClose}>Project {j.project_code} →</Link>}
              <RouteLinks address={j.address} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
