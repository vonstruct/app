import { useState } from 'react'
import { supabase, SUPABASE_URL } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { toast } from '../../core/toast'
import { SignaturePad } from '../../core/SignaturePad'
import { HandoverDoc } from '../../core/HandoverDoc'
import { printQuote, type Company } from '../../core/QuoteDoc'
import { RuleLink } from '../../core/RuleLink'
import { DateInput } from '../../core/DateInput'

/**
 * Tab "Oplevering" op de projectpagina: werkpunten (wie, tegen wanneer, foto's, klaar), proces-verbaal van oplevering
 * (ter plaatse laten tekenen of naar de klant sturen), garantie en nazorg. Tabellen punch_items, handovers, handover_signatures.
 */
type Item = { id: string; project_code: string; title: string; description: string | null; photos: string[]; assignee: string; subcontractor_id: string | null; partner_id: string | null; due_date: string | null; status: string; done_at: string | null; done_by: string | null; done_note: string | null; done_photos: string[]; show_client: boolean; source: string; assignee_name: string | null; overdue: boolean }
type Handover = { id: string; project_code: string; status: string; handover_date: string | null; text_body: string | null; notes: string | null; warranty_months: number | null; sent_at: string | null; sent_to: string | null }
type Sig = { signer_name: string; signed_at: string; doc_hash: string; signature_png: string | null; method: string; ip: string | null; signer_email: string | null; confirmation_sent_at: string | null }
type Proj = { project_code: string; title: string | null; site_street: string | null; site_postal_code: string | null; site_city: string | null; warranty_until: string | null; review_requested_at: string | null; clients: { first_name: string | null; last_name: string | null; email: string | null } | null }
type Who = { id: string; name: string }

const d = (v: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00' : v).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export function HandoverPanel({ project }: { project: string }) {
  const items = useQuery<Item[]>(() => supabase.from('app_punch_items').select('*').eq('project_code', project).neq('status', 'geannuleerd').order('status').order('created_at'), [project])
  const hos = useQuery<Handover[]>(() => supabase.from('handovers').select('*').eq('project_code', project).neq('status', 'geannuleerd').order('created_at', { ascending: false }), [project])
  const proj = useQuery<Proj>(() => supabase.from('projects').select('project_code,title,site_street,site_postal_code,site_city,warranty_until,review_requested_at,clients(first_name,last_name,email)').eq('project_code', project).single() as never, [project])
  const subs = useQuery<Who[]>(() => supabase.from('subcontractors').select('id,name').order('name'), [])
  const partners = useQuery<Who[]>(() => supabase.from('partners').select('id,name').order('name'), [])
  const rules = useQuery<{ key: string; value: Record<string, unknown> }[]>(() => supabase.from('rule_settings').select('key,value').in('key', ['bedrijf', 'garantie', 'oplevering_teksten', 'review_link']), [])
  const rule = (k: string) => (rules.data ?? []).find((r) => r.key === k)?.value ?? {}
  const h = (hos.data ?? [])[0] ?? null
  const reload = () => { items.reload(); hos.reload(); proj.reload() }
  if (items.loading || hos.loading || proj.loading) return <Loading />
  const p = proj.data
  const open = (items.data ?? []).filter((i) => i.status === 'open')
  const client = [p?.clients?.first_name, p?.clients?.last_name].filter(Boolean).join(' ')

  const newPv = async () => {
    const months = Number(rule('garantie').maanden ?? 24)
    const txt = String(rule('oplevering_teksten').pv ?? '').replaceAll('{project}', `${project}${p?.title ? ' (' + p.title + ')' : ''}`).replaceAll('{maanden}', String(months)).replaceAll('{voornaam}', p?.clients?.first_name ?? '')
    const { error } = await supabase.from('handovers').insert({ project_code: project, handover_date: new Date().toLocaleDateString('sv-SE'), text_body: txt, warranty_months: months })
    if (error) toast(error.message, 'err'); else { toast('PV klaar om in te vullen'); reload() }
  }
  return (
    <div className="handover">
      <ErrorBox error={items.error || hos.error} />
      <Punch project={project} items={items.data ?? []} subs={subs.data ?? []} partners={partners.data ?? []} onChange={reload} />
      <h3 className="ho-h">Proces-verbaal van oplevering</h3>
      {!h ? (
        <div className="orders-bar"><span className="muted">Nog geen PV. Maak het op zodra de plaatsing klaar is; open werkpunten komen er automatisch op.</span><button className="primary" onClick={newPv}>PV opmaken</button></div>
      ) : (
        <Pv h={h} items={open} project={p} client={client} company={rule('bedrijf') as Company} onChange={reload} />
      )}
      <h3 className="ho-h">Garantie en nazorg</h3>
      <div className="quote-intern">
        <span><small>Garantie tot</small><b>{p?.warranty_until ? d(p.warranty_until) : 'start bij het PV'}</b></span>
        <span><small>Meldingen van de klant</small><b>{(items.data ?? []).filter((i) => i.source === 'klant').length}</b></span>
        <span><small>Review</small><b>{p?.review_requested_at ? 'gevraagd ' + d(p.review_requested_at) : 'nog niet gevraagd'}</b></span>
      </div>
      {!p?.review_requested_at && h?.status === 'ondertekend' && (
        <div className="order-actions">
          <button onClick={async () => {
            const link = String(rule('review_link').link ?? '')
            const text = `Dag ${p?.clients?.first_name ?? ''},\n\nNogmaals bedankt voor je vertrouwen. Ben je tevreden over je nieuwe interieur? Een korte review helpt ons enorm${link ? ':\n' + link : '.'}\n\nGroeten,\nOlivier`
            await navigator.clipboard.writeText(text).catch(() => undefined)
            await supabase.from('projects').update({ review_requested_at: new Date().toISOString() }).eq('project_code', project)
            toast('Tekst gekopieerd; review staat als gevraagd'); reload()
          }}>Review vragen (tekst kopiëren)</button>
          {!rule('review_link').link && <span className="muted small">Tip: zet je reviewlink in <RuleLink s="Oplevering" />.</span>}
        </div>
      )}
    </div>
  )
}

function Punch({ project, items, subs, partners, onChange }: { project: string; items: Item[]; subs: Who[]; partners: Who[]; onChange: () => void }) {
  const [f, setF] = useState({ title: '', description: '', who: 'ikzelf', due: '', show_client: true })
  const [files, setFiles] = useState<FileList | null>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (list: FileList | null) => {
    const out: string[] = []
    for (const file of Array.from(list ?? [])) {
      const path = `${project}/werkpunten/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`
      const { error } = await supabase.storage.from('project-uploads').upload(path, file, { contentType: file.type })
      if (error) toast(error.message, 'err'); else out.push(path)
    }
    return out
  }
  const add = async () => {
    if (f.title.trim().length < 3) return toast('Omschrijving ontbreekt', 'err')
    setBusy(true)
    const photos = await upload(files)
    const [kind, id] = f.who.split(':')
    const { error } = await supabase.from('punch_items').insert({ project_code: project, title: f.title.trim(), description: f.description || null, photos, assignee: kind, subcontractor_id: kind === 'onderaannemer' ? id : null, partner_id: kind === 'partner' ? id : null, due_date: f.due || null, show_client: f.show_client, source: 'oplevering' })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    setF({ title: '', description: '', who: f.who, due: '', show_client: true }); setFiles(null); toast('Werkpunt toegevoegd'); onChange()
  }
  const done = async (i: Item) => {
    const note = prompt('Wat werd er gedaan? (optioneel)', '')
    if (note === null) return
    const { error } = await supabase.rpc('portal_punch_done', { p_id: i.id, p_note: note, p_photos: [] })
    if (error) toast(error.message, 'err'); else { toast('Klaar'); onChange() }
  }
  const cancel = async (i: Item) => { if (!confirm(`Werkpunt "${i.title}" schrappen?`)) return; await supabase.from('punch_items').update({ status: 'geannuleerd' }).eq('id', i.id); onChange() }
  const show = async (path: string) => { const { data } = await supabase.storage.from('project-uploads').createSignedUrl(path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  const open = items.filter((i) => i.status === 'open')
  return (
    <>
      <h3 className="ho-h">Werkpunten {open.length > 0 && <span className="jo-pill warn">{open.length} open</span>}</h3>
      {items.length === 0 && <p className="muted">Geen werkpunten.</p>}
      {items.map((i) => (
        <div key={i.id} className={'order-row ho-item' + (i.status !== 'open' ? ' done' : '')}>
          <div className="order-head">
            <span className={'jo-pill ' + (i.status === 'klaar' ? 'ok' : i.overdue ? 'bad' : i.source === 'klant' ? 'warn' : '')}>{i.status === 'klaar' ? 'Klaar' : i.source === 'klant' ? 'Melding klant' : i.overdue ? 'Te laat' : 'Open'}</span>
            <div className="order-main">
              <strong>{i.title}</strong>
              <div className="muted small">{i.assignee_name ?? i.assignee}{i.due_date ? ' · tegen ' + d(i.due_date) : ''}{!i.show_client ? ' · niet zichtbaar voor de klant' : ''}{i.description ? ' · ' + i.description : ''}</div>
              {i.status === 'klaar' && <div className="muted small">✓ {d(i.done_at)} door {i.done_by}{i.done_note ? ': ' + i.done_note : ''}</div>}
              {[...(i.photos ?? []), ...(i.done_photos ?? [])].length > 0 && <div className="ho-photos">{[...(i.photos ?? []), ...(i.done_photos ?? [])].map((ph, k) => <button key={ph} className="linkish" onClick={() => show(ph)}>foto {k + 1}</button>)}</div>}
            </div>
            {i.status === 'open' && <span className="ho-act"><button onClick={() => done(i)}>Klaar</button><button title="Schrappen" onClick={() => cancel(i)}>×</button></span>}
          </div>
        </div>
      ))}
      <div className="ho-new">
        <input placeholder="Nieuw werkpunt, bv. deur bovenkast links bijregelen" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input placeholder="Uitleg (optioneel)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <select value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}>
          <option value="ikzelf">Ikzelf</option>
          {subs.length > 0 && <optgroup label="Onderaannemer">{subs.map((s) => <option key={s.id} value={'onderaannemer:' + s.id}>{s.name}</option>)}</optgroup>}
          {partners.length > 0 && <optgroup label="Partner">{partners.map((s) => <option key={s.id} value={'partner:' + s.id}>{s.name}</option>)}</optgroup>}
        </select>
        <DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} title="tegen wanneer" />
        <label className="qcheck"><input type="checkbox" checked={f.show_client} onChange={(e) => setF({ ...f, show_client: e.target.checked })} /> klant ziet het</label>
        <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles(e.target.files)} />
        <button className="primary" disabled={busy} onClick={add}>{busy ? 'Bezig…' : '+ Werkpunt'}</button>
      </div>
    </>
  )
}

function Pv({ h, items, project, client, company, onChange }: { h: Handover; items: Item[]; project: Proj | null; client: string; company: Company; onChange: () => void }) {
  const sig = useQuery<Sig[]>(() => supabase.from('handover_signatures').select('*').eq('handover_id', h.id).order('signed_at', { ascending: false }), [h.id, h.status])
  const s = (sig.data ?? [])[0] ?? null
  const [signing, setSigning] = useState(false)
  const [name, setName] = useState(client)
  const [png, setPng] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const editable = h.status !== 'ondertekend'
  const save = async (patch: Partial<Handover>) => { const { error } = await supabase.from('handovers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', h.id); if (error) toast(error.message, 'err'); else onChange() }
  const consent = `Ik heb het proces-verbaal van oplevering voor project ${h.project_code} gelezen en aanvaard de oplevering, met de vermelde werkpunten.`
  const signHere = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_handover_sign', { p_id: h.id, p_name: name, p_png: png, p_consent: consent })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast('PV ondertekend'); setSigning(false); onChange()
  }
  const send = async () => {
    if (!confirm(`PV naar ${project?.clients?.email ?? 'de klant'} sturen om online te ondertekenen?`)) return
    setBusy(true)
    const { data: ss } = await supabase.auth.getSession()
    const r = await fetch(`${SUPABASE_URL}/functions/v1/handover-send`, { method: 'POST', headers: { Authorization: `Bearer ${ss.session?.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ handover_id: h.id }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok || j.error) return toast(j.error ?? 'Versturen mislukt', 'err')
    toast('PV verstuurd naar ' + j.to); onChange()
  }
  const site = [project?.site_street, [project?.site_postal_code, project?.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const snapItems = s ? [] : items.map((i) => ({ title: i.title, description: i.description, due: i.due_date }))
  return (
    <div className="quote">
      <div className="quote-head">
        <div><span className={'jo-pill ' + (h.status === 'ondertekend' ? 'ok' : h.status === 'verstuurd' ? 'warn' : 'muted')}>{h.status === 'ondertekend' ? 'Ondertekend' : h.status === 'verstuurd' ? 'Wacht op de klant' : 'Concept'}</span>
          {h.sent_at && <span className="muted small"> verstuurd {d(h.sent_at)} naar {h.sent_to}</span>}</div>
        <button onClick={printQuote}>Afdrukken / PDF</button>
      </div>
      {editable && (
        <div className="qedit-head">
          <label>Datum van oplevering<DateInput defaultValue={h.handover_date ?? ''} onBlur={(e) => e.target.value !== (h.handover_date ?? '') && save({ handover_date: e.target.value || null })} /></label>
          <label>Garantie (maanden)<input type="number" defaultValue={h.warranty_months ?? 24} onBlur={(e) => Number(e.target.value) !== h.warranty_months && save({ warranty_months: Number(e.target.value) })} /></label>
          <label>Tekst<textarea rows={4} defaultValue={h.text_body ?? ''} onBlur={(e) => e.target.value !== (h.text_body ?? '') && save({ text_body: e.target.value })} /></label>
          <label>Opmerkingen (optioneel)<textarea rows={4} defaultValue={h.notes ?? ''} onBlur={(e) => e.target.value !== (h.notes ?? '') && save({ notes: e.target.value || null })} /></label>
        </div>
      )}
      <div className="qpreview">
        <HandoverDoc h={{ project_code: h.project_code, project_title: project?.title, client_name: client, site, date: h.handover_date, text: h.text_body, notes: h.notes, warranty_months: h.warranty_months }}
          items={s ? (sigItems(s) ?? []) : snapItems} company={company} signature={s ? { name: s.signer_name, at: s.signed_at, hash: s.doc_hash, png: s.signature_png, method: s.method } : null} />
      </div>
      {editable && !signing && (
        <div className="quote-actions">
          <button className="primary" onClick={() => setSigning(true)}>Ter plaatse laten ondertekenen</button>
          <button disabled={busy} onClick={send}>{h.status === 'verstuurd' ? 'Opnieuw naar de klant sturen' : 'Naar de klant sturen (online tekenen)'}</button>
        </div>
      )}
      {signing && (
        <section className="pquote-sign">
          <h3>Ondertekenen door de klant</h3>
          <p className="muted small">Geef je gsm of tablet aan de klant.</p>
          <input placeholder="Volledige naam van de klant" value={name} onChange={(e) => setName(e.target.value)} />
          <SignaturePad onChange={setPng} hint="Teken hier" />
          <label className="pquote-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{consent}</label>
          <div className="order-actions"><button className="primary" disabled={busy || !png || !agree || name.trim().length < 3} onClick={signHere}>Ondertekenen</button><button onClick={() => setSigning(false)}>Annuleren</button></div>
        </section>
      )}
      {s && (
        <details className="qtexts qproof">
          <summary>Ondertekeningsbewijs</summary>
          <dl className="qproof-grid"><div style={{ flex: 1 }}>
            <p className="small">{s.method === 'ter plaatse' ? 'Ter plaatse' : 'Online'} door {s.signer_name}{s.signer_email ? ' (' + s.signer_email + ')' : ''} op {new Date(s.signed_at).toLocaleString('nl-BE', { timeZone: 'Europe/Brussels' })}{s.ip ? ' · IP ' + s.ip : ''}</p>
            <p className="small mono">SHA-256 {s.doc_hash}</p>
            <p className="small">{s.confirmation_sent_at ? 'Bevestiging gemaild ' + new Date(s.confirmation_sent_at).toLocaleString('nl-BE') : 'Bevestiging nog niet verstuurd'}</p>
          </div></dl>
        </details>
      )}
    </div>
  )
}
const sigItems = (s: Sig & { snapshot?: { open_items?: { title: string; description?: string; due?: string }[] } }) => s.snapshot?.open_items
