import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { toast } from '../../core/toast'
import { PackageView, fileSize, type Pkg, type PkgFile } from '../../core/PackageView'

/**
 * Tab "Productie" op de projectpagina: productiepakket voor partner (tabel production_packages, versies).
 * Concept: opmerkingen, restplaten/rest kantenband meegeven, bestanden (PaletteCAD-bestand groot → OneDrive via Edge Function productie,
 * andere bestanden → Storage project-uploads/<code>/productie/). Versturen = mail aan partner + zichtbaar in het partnerportaal;
 * downloads worden bijgehouden. Nieuwe versie = package_new (neemt opmerkingen over, zaagplan + gedeelde tekeningen erbij).
 */
type Row = { id: string; project_code: string; version: number; status: string; note: string | null; return_sheets: boolean; return_edges: boolean; sent_at: string | null; partner_id: string | null; created_at: string }
const STATUS: Record<string, string> = { concept: 'Concept', verstuurd: 'Verstuurd', vervangen: 'Vervangen' }
const CHUNK = 32 * 320 * 1024 // 10 MiB, veelvoud van 320 KiB (OneDrive)

export function ProductionPanel({ project }: { project: string }) {
  const q = useQuery<Row[]>(() => supabase.from('production_packages').select('*').eq('project_code', project).order('version', { ascending: false }), [project])
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const rows = q.data ?? []
  const cur = rows.find((r) => r.id === sel) ?? rows[0] ?? null
  const pv = useQuery<Pkg | null>(async () => {
    if (!cur) return { data: null, error: null }
    const { data, error } = await supabase.rpc('package_preview', { p_id: cur.id })
    return { data: data as Pkg | null, error }
  }, [cur?.id, cur?.status])
  const partner = useQuery<{ name: string; email: string | null } | null>(async () => {
    if (!cur?.partner_id) return { data: null, error: null }
    const { data, error } = await supabase.from('partners').select('name,email').eq('id', cur.partner_id).maybeSingle()
    return { data: data as { name: string; email: string | null } | null, error }
  }, [cur?.partner_id])
  const login = useQuery<boolean | null>(async () => {
    if (!partner.data?.email) return { data: null, error: null }
    const { data, error } = await supabase.rpc('portal_has_login', { p_email: partner.data.email })
    return { data: data as boolean, error }
  }, [partner.data?.email])
  const invite = async () => {
    if (!partner.data?.email) return toast('Vul eerst het e-mailadres van de partner in bij Relaties', 'err')
    setBusy('invite')
    const { data, error } = await supabase.functions.invoke('invite-client', { body: { team_email: partner.data.email } })
    setBusy(null)
    const e = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (e) return toast(e, 'err')
    toast(`Uitnodiging voor het portaal verstuurd naar ${partner.data.email}`); login.reload()
  }
  const reload = () => { q.reload(); pv.reload() }
  const editable = cur?.status === 'concept'

  const make = async () => {
    setBusy('new')
    const { data, error } = await supabase.rpc('package_new', { p_code: project })
    setBusy(null)
    if (error) return toast(error.message, 'err')
    setSel(data as string); q.reload()
  }
  const save = async (patch: Partial<Row>) => {
    if (!cur) return
    const { error } = await supabase.from('production_packages').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', cur.id)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); reload() }
  }
  const send = async () => {
    if (!cur || !confirm(`Productiepakket versie ${cur.version} versturen naar ${partner.data?.name ?? 'partner'}? Ze krijgen een mail en zien het in hun portaal.`)) return
    setBusy('send')
    const { data, error } = await supabase.functions.invoke('productie', { body: { action: 'send', package_id: cur.id } })
    setBusy(null)
    const msg = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (msg) return toast(msg, 'err')
    toast(`Verstuurd naar ${partner.data?.name ?? 'partner'}`); reload()
  }
  const download = async (f: PkgFile) => {
    const w = window.open('', '_blank')
    const { data, error } = await supabase.functions.invoke('productie', { body: { action: 'file_url', file_id: f.id } })
    if (error || !data?.url) { w?.close(); return toast('Link maken lukte niet', 'err') }
    if (w) w.location.href = data.url; else window.open(data.url, '_blank')
  }
  const removeFile = async (f: PkgFile) => {
    if (!confirm(`"${f.name}" uit het pakket halen?`)) return
    const { error } = await supabase.from('production_package_files').delete().eq('id', f.id)
    if (error) toast(error.message, 'err'); else reload()
  }
  /** groot bestand: in stukken rechtstreeks naar OneDrive (uploadsessie via Edge Function productie) */
  const uploadBig = async (file: File) => {
    if (!cur) return
    setBusy('upload:0')
    try {
      const { data: s, error } = await supabase.functions.invoke('productie', { body: { action: 'upload_start', package_id: cur.id, name: file.name } })
      if (error || !s?.uploadUrl) throw new Error((s as { error?: string })?.error ?? 'OneDrive niet bereikbaar')
      let start = 0, last: { id?: string } | null = null
      while (start < file.size) {
        const end = Math.min(start + CHUNK, file.size)
        let r: Response | null = null
        for (let t = 0; t < 3; t++) {
          r = await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` }, body: file.slice(start, end) }).catch(() => null)
          if (r && (r.ok || r.status === 202)) break
        }
        if (!r || !(r.ok || r.status === 202)) throw new Error('Opladen onderbroken. Probeer opnieuw.')
        last = await r.json().catch(() => null)
        start = end
        setBusy(`upload:${Math.round((end / file.size) * 100)}`)
      }
      if (!last?.id) throw new Error('OneDrive gaf geen bestand terug')
      const { error: e2, data: d2 } = await supabase.functions.invoke('productie', { body: { action: 'upload_done', package_id: cur.id, item_id: last.id, kind: /\.(pdf|png|jpe?g)$/i.test(file.name) ? 'tekening' : 'palettecad' } })
      if (e2 || (d2 as { error?: string })?.error) throw new Error((d2 as { error?: string })?.error ?? e2?.message)
      toast(`${file.name} staat in het pakket`)
      reload()
    } catch (e) {
      toast(String((e as Error).message ?? e), 'err')
    } finally { setBusy(null) }
  }
  /** klein bestand (pdf, foto): in Storage */
  const uploadSmall = async (file: File) => {
    if (!cur) return
    if (file.size > 50 * 1024 * 1024) return uploadBig(file)
    setBusy('upload:0')
    const path = `${project}/productie/v${cur.version}/${file.name.replace(/[^\w.\- ]+/g, '_')}`
    const up = await supabase.storage.from('project-uploads').upload(path, file, { upsert: true })
    if (up.error) { setBusy(null); return toast(up.error.message, 'err') }
    const { error } = await supabase.from('production_package_files').insert({ package_id: cur.id, kind: /\.pdf$/i.test(file.name) ? 'tekening' : 'andere', name: file.name, storage: 'storage', bucket: 'project-uploads', path, size: file.size })
    setBusy(null)
    if (error) toast(error.message, 'err'); else { toast(`${file.name} staat in het pakket`); reload() }
  }

  if (q.loading) return <Loading />
  return (
    <div className="prodpkg">
      <ErrorBox error={q.error ?? pv.error} />
      <div className="orders-bar">
        {rows.length > 1 && (
          <div className="seg">{rows.map((r) => <button key={r.id} className={cur?.id === r.id ? 'on' : ''} onClick={() => setSel(r.id)}>v{r.version}</button>)}</div>
        )}
        {!cur && <span className="muted">Nog geen productiepakket. Maak er een: het zaagplan en de tekeningen die je deelt met onderaannemers komen er vanzelf bij.</span>}
        {(!cur || cur.status !== 'concept') && <button className="primary" disabled={busy === 'new'} onClick={make}>{cur ? 'Nieuwe versie maken' : 'Productiepakket maken'}</button>}
      </div>
      {cur && (
        <section className="panel">
          <header className="prodpkg-head">
            <div><b>Productiepakket versie {cur.version}</b> <span className={'pill ' + (cur.status === 'verstuurd' ? 'ok' : 'muted')}>{STATUS[cur.status] ?? cur.status}</span>
              <div className="small muted">voor {partner.data?.name ?? '—'}{cur.sent_at ? ` · verstuurd ${new Date(cur.sent_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</div></div>
            {editable && <button className="primary" disabled={busy === 'send'} onClick={send}>{busy === 'send' ? 'Versturen…' : `Versturen naar ${partner.data?.name ?? 'partner'}`}</button>}
          </header>
          {login.data === false && (
            <p className="notice">{partner.data?.name ?? 'De partner'} heeft nog geen login voor het portaal ({partner.data?.email}). Zonder login kan hij het pakket niet openen.{' '}
              <button className="link" disabled={busy === 'invite'} onClick={invite}>Nu uitnodigen</button></p>
          )}
          {editable && (
            <div className="prodpkg-edit">
              <label className="wide">Opmerkingen voor {partner.data?.name ?? 'partner'}
                <textarea key={cur.id} rows={3} defaultValue={cur.note ?? ''} placeholder="Waar moeten ze rekening mee houden?" onBlur={(e) => e.target.value !== (cur.note ?? '') && save({ note: e.target.value || null })} />
              </label>
              <label className="check"><input type="checkbox" checked={cur.return_sheets} onChange={(e) => save({ return_sheets: e.target.checked })} /> Restplaten meegeven</label>
              <label className="check"><input type="checkbox" checked={cur.return_edges} onChange={(e) => save({ return_edges: e.target.checked })} /> Rest kantenband meegeven (behalve wit)</label>
              <div className="prodpkg-up">
                <label className="btn">PaletteCAD-bestand opladen<input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadBig(f) }} /></label>
                <label className="btn">Pdf of ander bestand<input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadSmall(f) }} /></label>
                {busy?.startsWith('upload:') && <span className="small">Opladen… {busy.split(':')[1]} %</span>}
                <span className="small muted">Groot PaletteCAD-bestand gaat naar je OneDrive (Vonstruct/Productie/{project}).</span>
              </div>
              {(pv.data?.files ?? []).length > 0 && (
                <ul className="small prodpkg-rm">{(pv.data?.files ?? []).map((f) => <li key={f.id}>{f.name} <span className="muted">{fileSize(f.size)}</span> <button className="link small" onClick={() => removeFile(f)}>weghalen</button></li>)}</ul>
              )}
            </div>
          )}
          <h3 className="prodpkg-sub">{editable ? `Zo ziet ${partner.data?.name ?? 'partner'} het` : 'Inhoud'}</h3>
          {pv.loading ? <Loading /> : pv.data && <PackageView p={pv.data} onDownload={download} admin />}
        </section>
      )}
    </div>
  )
}
