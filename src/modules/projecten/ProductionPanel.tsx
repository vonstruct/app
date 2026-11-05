import { useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { toast } from '../../core/toast'
import { PackageView, fileSize, type Pkg, type PkgFile } from '../../core/PackageView'
import { PartnerOrderPanel } from './PartnerOrderPanel'

/**
 * Tab "Productie" op de projectpagina: productiepakket voor de productiepartner (tabel production_packages, versies).
 * Concept: opmerkingen, restplaten/rest kantenband meegeven, opmerkingen per kast (cabinet_notes: kasten uit bom_cabinets kiezen, per kast de keuzes uit regel productie_kast_opmerkingen of Andere met eigen tekst), bestanden = wat in de projectmap in OneDrive staat (regel productie_map,
 * Edge Function productie actie folder) + zaagplan en gedeelde tekeningen. Testmodus (regel productie_testmodus): niets naar de partner. Versturen = mail aan de partner + zichtbaar in het partnerportaal;
 * downloads worden bijgehouden. Nieuwe versie = package_new (neemt opmerkingen over, zaagplan + gedeelde tekeningen erbij).
 */
type Row = { id: string; project_code: string; version: number; status: string; note: string | null; return_sheets: boolean; return_edges: boolean; sent_at: string | null; partner_id: string | null; created_at: string; design_version_id: string | null; cabinet_notes: Record<string, CabNote> | null }
type CabNote = { tags?: string[]; other?: boolean; note?: string }
const STATUS: Record<string, string> = { concept: 'Concept', verstuurd: 'Verstuurd', vervangen: 'Vervangen' }

export function ProductionPanel({ project }: { project: string }) {
  const q = useQuery<Row[]>(() => supabase.from('production_packages').select('*').eq('project_code', project).order('version', { ascending: false }), [project])
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [folder, setFolder] = useState<{ folder_url: string; folder_path: string; n_files: number } | null>(null)
  const tm = useQuery<boolean>(async () => {
    const { data, error } = await supabase.from('rule_settings').select('value').eq('key', 'productie_testmodus').maybeSingle()
    return { data: (data as { value: { aan?: boolean } } | null)?.value?.aan !== false, error }
  }, [])
  const test = tm.data !== false
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
  const cabs = useQuery<string[]>(async () => {
    if (!cur?.design_version_id) return { data: [], error: null }
    const { data, error } = await supabase.from('bom_cabinets').select('name').eq('design_version_id', cur.design_version_id)
    const names = [...new Set(((data ?? []) as { name: string | null }[]).map((c) => c.name?.trim()).filter((n): n is string => !!n))]
    const nr = (n: string) => { const m = n.match(/^\d+/); return m ? Number(m[0]) : 1e9 }
    return { data: names.sort((a, b) => nr(a) - nr(b) || a.localeCompare(b, 'nl')), error }
  }, [cur?.design_version_id])
  /** keuzes per kast = regel productie_kast_opmerkingen (+ altijd Andere met eigen tekst) */
  const opts = useQuery<string[]>(async () => {
    const { data, error } = await supabase.from('rule_settings').select('value').eq('key', 'productie_kast_opmerkingen').maybeSingle()
    const v = (data as { value: { opties?: string } } | null)?.value?.opties ?? 'Nerf laten doorlopen, Speciale frezing'
    return { data: v.split(',').map((x) => x.trim()).filter(Boolean), error }
  }, [])
  // meteen tonen, daarna bewaren (de rij komt terug na het herladen)
  const [local, setLocal] = useState<Record<string, CabNote> | null>(null)
  useEffect(() => setLocal(null), [cur?.id, cur?.cabinet_notes])
  const notes = local ?? cur?.cabinet_notes ?? {}
  const setCab = (name: string, v: CabNote | null) => {
    const next = { ...notes }
    if (v) next[name] = v; else delete next[name]
    setLocal(next); save({ cabinet_notes: next })
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
    if (!cur || !confirm(test ? `Testmodus: de mail gaat enkel naar info@ (niets naar ${partner.data?.name ?? 'de partner'}). Doorgaan?` : `Productiepakket versie ${cur.version} versturen naar ${partner.data?.name ?? 'de partner'}? Ze krijgen een mail en zien het in hun portaal.`)) return
    setBusy('send')
    const { data, error } = await supabase.functions.invoke('productie', { body: { action: 'send', package_id: cur.id } })
    setBusy(null)
    const msg = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (msg) return toast(msg, 'err')
    toast(test ? 'Test: mail naar info@ gestuurd' : `Verstuurd naar ${partner.data?.name ?? 'de partner'}`); reload()
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
  /** projectmap in OneDrive aanmaken/uitlezen: wat erin staat, komt in het concept */
  const syncFolder = async () => {
    if (!cur) return
    setBusy('folder')
    const { data, error } = await supabase.functions.invoke('productie', { body: { action: 'folder', package_id: cur.id } })
    setBusy(null)
    const msg = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (msg) return toast(msg, 'err')
    setFolder(data as { folder_url: string; folder_path: string; n_files: number })
    pv.reload()
  }
  useEffect(() => { if (cur?.id) syncFolder() }, [cur?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (q.loading) return <Loading />
  return (
    <div className="prodpkg">
      <PartnerOrderPanel project={project} test={test} />
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
            {editable && <button className="primary" disabled={busy === 'send'} onClick={send}>{busy === 'send' ? 'Versturen…' : test ? 'Versturen (test: enkel naar info@)' : `Versturen naar ${partner.data?.name ?? 'de partner'}`}</button>}
          </header>
          {test && <p className="notice small">Testmodus: niets gaat naar {partner.data?.name ?? 'de partner'}. Versturen mailt enkel naar info@. Uitzetten in Rekenregels → Productie.</p>}
          {!test && login.data === false && (
            <p className="notice">{partner.data?.name ?? 'De partner'} heeft nog geen login voor het portaal ({partner.data?.email}). Zonder login kan hij het pakket niet openen.{' '}
              <button className="link" disabled={busy === 'invite'} onClick={invite}>Nu uitnodigen</button></p>
          )}
          {!editable && cur.id === rows[0]?.id && (
            <p className="notice">Deze versie is {cur.status === 'verstuurd' ? (test ? 'verstuurd (test)' : 'verstuurd') : cur.status} en ligt vast. Iets aanpassen (opmerkingen, per kast, vinkjes, bestanden)?{' '}
              <button className="link" disabled={busy === 'new'} onClick={make}>Maak een nieuwe versie</button>: alles van deze versie gaat mee.</p>
          )}
          {editable && (
            <div className="prodpkg-edit">
              <div className="prodpkg-notes">
                <b>Opmerkingen voor {partner.data?.name ?? 'de partner'}</b>
                <label className="wide">Algemeen
                  <textarea key={cur.id} rows={3} defaultValue={cur.note ?? ''} placeholder="Waar moeten ze rekening mee houden?" onBlur={(e) => e.target.value !== (cur.note ?? '') && save({ note: e.target.value || null })} />
                </label>
                <div className="wide">Per kast: <span className="small muted">kies de kasten uit de tekening en vink aan wat er moet gebeuren</span></div>
                {(cabs.data ?? []).length === 0 ? <span className="small muted">Geen kasten in de stuklijst van deze versie.</span> : (
                  <div className="chips-pick">{(cabs.data ?? []).map((n) => {
                    const on = n in notes
                    return <button key={n} className={on ? 'on' : ''} onClick={() => setCab(n, on ? null : {})}>{on ? '✓ ' : ''}{n}</button>
                  })}</div>
                )}
                {Object.keys(notes).length > 0 && (
                  <ul className="prodpkg-cabs">{Object.keys(notes).sort((a, b) => (cabs.data ?? []).indexOf(a) - (cabs.data ?? []).indexOf(b)).map((n) => {
                    const v = notes[n] ?? {}
                    const tags = v.tags ?? []
                    const tog = (t: string) => setCab(n, { ...v, tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] })
                    return (
                      <li key={n}>
                        <div className="prodpkg-cab-head"><b>{n}</b> <button className="link small" onClick={() => setCab(n, null)}>weghalen</button></div>
                        <div className="prodpkg-cab-opts">
                          {(opts.data ?? []).map((t) => <label key={t} className="check"><input type="checkbox" checked={tags.includes(t)} onChange={() => tog(t)} /> {t}</label>)}
                          <label className="check"><input type="checkbox" checked={!!v.other} onChange={(e) => setCab(n, { ...v, other: e.target.checked })} /> Andere</label>
                        </div>
                        {v.other && <input key={cur.id + n} defaultValue={v.note ?? ''} placeholder="Wat moet er gebeuren?" onBlur={(e) => e.target.value !== (v.note ?? '') && setCab(n, { ...v, note: e.target.value })} />}
                      </li>
                    )
                  })}</ul>
                )}
              </div>
              <label className="check"><input type="checkbox" checked={cur.return_sheets} onChange={(e) => save({ return_sheets: e.target.checked })} /> Restplaten meegeven</label>
              <label className="check"><input type="checkbox" checked={cur.return_edges} onChange={(e) => save({ return_edges: e.target.checked })} /> Rest kantenband meegeven (behalve wit)</label>
              <div className="prodpkg-folder">
                <div><b>Map in je OneDrive:</b> {folder?.folder_path ?? (busy === 'folder' ? 'wordt klaargezet…' : '—')}
                  {folder?.folder_url && <> · <a href={folder.folder_url} target="_blank" rel="noreferrer">openen</a></>}
                  {' · '}<button className="link small" disabled={busy === 'folder'} onClick={syncFolder}>{busy === 'folder' ? 'bezig…' : 'vernieuwen'}</button></div>
                <div className="small muted">Sleep je PaletteCAD-bestand en andere bestanden in deze map (via OneDrive op je pc) en klik op vernieuwen: wat in de map staat, komt in het pakket. Het zaagplan en de tekeningen die je deelt met onderaannemers zet de app er zelf bij.</div>
              </div>
              {(pv.data?.files ?? []).length > 0 && (
                <ul className="small prodpkg-rm">{(pv.data?.files ?? []).map((f) => <li key={f.id}>{f.name} <span className="muted">{fileSize(f.size)}{f.storage === 'onedrive' ? ' · uit de map' : ''}</span> {f.storage !== 'onedrive' && <button className="link small" onClick={() => removeFile(f)}>weghalen</button>}</li>)}</ul>
              )}
            </div>
          )}
          <h3 className="prodpkg-sub">{editable ? `Zo ziet ${partner.data?.name ?? 'de partner'} het` : 'Inhoud'}</h3>
          {pv.loading ? <Loading /> : pv.data && <PackageView p={pv.data} onDownload={download} admin />}
        </section>
      )}
    </div>
  )
}
