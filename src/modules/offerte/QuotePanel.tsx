import { useEffect, useMemo, useState } from 'react'
import { supabase, SUPABASE_URL } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { QuoteDoc, printQuote, lineAmount, quoteTotals, lineOn, type Company, type QLang, type QSignature } from '../../core/QuoteDoc'

/**
 * Tab "Offerte" op de projectpagina. Opbouwen uit de kosten = RPC quote_generate (kasten, lades, werkblad + vaste regels),
 * regels bewerken, intern: kostprijs en marge (nooit voor de klant), voorbeeld/afdrukken, versturen = Edge Function quote-send.
 */
type Quote = {
  id: string; project_code: string; number: string | null; title: string | null; status: string; doc_date: string | null; valid_until: string | null
  margin_pct: number | null; client_name: string | null; client_address: string | null; language: string | null; intro: string | null; closing: string | null
  sent_at: string | null; sent_to: string | null; accepted_at: string | null; accepted_name: string | null; declined_at: string | null; declined_reason: string | null
  total_excl: number; total_incl: number; cost: number | null; margin_eur: number; n_zero: number; created_at: string
  included: string | null; excluded: string | null; planning: string | null; payment: string | null; warranty: string | null; show_groups: boolean; project_title: string | null; site: string | null
}
type Line = { id: string; quote_id: string; sort: number; title: string; description: string | null; qty: number; unit_price: number; discount_pct: number; vat_rate: number; kind: string | null; source: string | null; cost_basis: number | null; opt_kind: 'optie' | 'keuze' | null; opt_group: string | null; opt_default: boolean; selected: boolean | null; supplier: string | null; order_needed: boolean | null }
type Sig = { id: string; signer_name: string; signer_email: string | null; signed_at: string; ip: string | null; user_agent: string | null; signature_png: string | null; doc_hash: string; vat6_confirmed: boolean | null; consent_text: string | null; confirmation_sent_at: string | null }

const STATUS: Record<string, [string, string]> = {
  concept: ['Concept', 'muted'], verstuurd: ['Verstuurd', 'warn'], aanvaard: ['Aanvaard', 'ok'], geweigerd: ['Geweigerd', 'bad'], vervallen: ['Vervallen', 'muted'], vervangen: ['Vervangen', 'muted'],
}
const KINDS: [string, string, number | null][] = [['vrij', 'Vrije regel', null], ['toestel', 'Toestel (21 % btw)', 21], ['sanitair', 'Sanitair', null], ['dienst', 'Dienst / arbeid', null], ['optie', 'Optie (klant vinkt aan)', null], ['keuze', 'Alternatief (klant kiest één)', null]]

export function QuotePanel({ project }: { project: string }) {
  const list = useQuery<Quote[]>(() => supabase.from('app_quotes').select('*').eq('project_code', project).order('created_at', { ascending: false }), [project])
  const company = useQuery<{ value: Company } | null>(() => supabase.from('rule_settings').select('value').eq('key', 'bedrijf').maybeSingle(), [])
  const terms = useQuery<{ value: { btw6?: string } } | null>(() => supabase.from('rule_settings').select('value').eq('key', 'offerte_voorwaarden').maybeSingle(), [])
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = (list.data ?? []).find((q) => q.id === sel) ?? (list.data ?? [])[0] ?? null

  const generate = async (margin?: number | null) => {
    setBusy(true)
    const { data, error } = await supabase.rpc('quote_generate', { p_code: project, p_margin: margin ?? null })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast('Offerte opgebouwd uit de kosten')
    setSel(data as string); list.reload()
  }

  if (list.loading) return <Loading />
  return (
    <div className="quotes">
      <div className="orders-bar">
        {(list.data ?? []).length > 1 && (
          <div className="seg">
            {(list.data ?? []).map((q) => <button key={q.id} className={current?.id === q.id ? 'on' : ''} onClick={() => setSel(q.id)}>{q.number}</button>)}
          </div>
        )}
        {!current && <span className="muted">Nog geen offerte voor dit project.</span>}
        {(!current || current.status !== 'concept') && <button className="primary" disabled={busy} onClick={() => generate()}>{busy ? 'Bezig…' : current ? 'Nieuwe offerte' : 'Offerte opbouwen uit de kosten'}</button>}
      </div>
      <ErrorBox error={list.error} />
      {current && <QuoteEditor key={current.id} q={current} company={company.data?.value ?? {}} btw6={terms.data?.value?.btw6 ?? null} onChange={list.reload} onGenerate={generate} busy={busy} />}
    </div>
  )
}

function QuoteEditor({ q, company, btw6, onChange, onGenerate, busy }: { q: Quote; company: Company; btw6: string | null; onChange: () => void; onGenerate: (m?: number | null) => void; busy: boolean }) {
  const lines = useQuery<Line[]>(() => supabase.from('quote_lines').select('*').eq('quote_id', q.id).order('sort').order('created_at'), [q.id, q.total_excl])
  const sigs = useQuery<Sig[]>(() => supabase.from('quote_signatures').select('*').eq('quote_id', q.id).order('signed_at', { ascending: false }), [q.id, q.status])
  const sig = (sigs.data ?? [])[0] ?? null
  const qsig: QSignature | null = sig ? { signer_name: sig.signer_name, signed_at: sig.signed_at, hash: sig.doc_hash, png: sig.signature_png, ip: sig.ip } : null
  const [view, setView] = useState<'bewerken' | 'voorbeeld'>(q.status === 'concept' ? 'bewerken' : 'voorbeeld')
  const [margin, setMargin] = useState<string>(q.margin_pct != null ? String(q.margin_pct) : '')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<{ name: string; address: string } | null>(null)
  const editable = q.status === 'concept'
  const ls = lines.data ?? []
  const tot = useMemo(() => quoteTotals(ls), [ls])
  const cost = ls.filter((l) => lineOn(l)).reduce((a, l) => a + Number(l.cost_basis ?? 0), 0)
  const marginEur = ls.filter((l) => l.cost_basis != null && lineOn(l)).reduce((a, l) => a + lineAmount(l) - Number(l.cost_basis), 0)
  const groups = [...new Set(ls.filter((l) => l.opt_kind === 'keuze').map((l) => l.opt_group ?? ''))]
  const zero = ls.filter((l) => Number(l.unit_price) === 0 && Number(l.discount_pct) < 100)

  // naam en adres zoals ze op de offerte komen (concept: uit klant/project)
  useEffect(() => {
    if (q.client_name) return setPreview({ name: q.client_name, address: q.client_address ?? '' })
    supabase.from('projects').select('site_street,site_postal_code,site_city,clients(first_name,last_name,company,street,postal_code,city)').eq('project_code', q.project_code).single().then(({ data }) => {
      const d = data as unknown as { site_street: string | null; site_postal_code: string | null; site_city: string | null; clients: { first_name: string | null; last_name: string | null; company: string | null; street: string | null; postal_code: string | null; city: string | null } | null } | null
      if (!d) return
      const c = d.clients
      const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.company || ''
      const addr = d.site_street ? [d.site_street, [d.site_postal_code, d.site_city].filter(Boolean).join(' ')] : [c?.street, [c?.postal_code, c?.city].filter(Boolean).join(' ')]
      setPreview({ name, address: addr.filter(Boolean).join('\n') })
    })
  }, [q.id, q.client_name, q.client_address, q.project_code])

  const saveQ = async (patch: Partial<Quote>) => {
    const { error } = await supabase.from('quotes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', q.id)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); onChange() }
  }
  const saveL = async (id: string, patch: Partial<Line>) => {
    const { error } = await supabase.from('quote_lines').update(patch).eq('id', id)
    if (error) toast(error.message, 'err'); else { lines.reload(); onChange() }
  }
  const addLine = async (kind: string, vat: number | null) => {
    const sort = Math.max(0, ...ls.filter((l) => l.sort < 800).map((l) => l.sort)) + 10
    const std = ls.find((l) => l.kind !== 'toestel')?.vat_rate ?? 6
    const opt = kind === 'optie' || kind === 'keuze' ? kind : null
    const grp = kind === 'keuze' ? (groups[0] || 'Werkblad') : null
    const { error } = await supabase.from('quote_lines').insert({ quote_id: q.id, sort, title: kind === 'toestel' ? 'Toestel' : opt === 'keuze' ? 'Alternatief' : opt === 'optie' ? 'Optie' : 'Nieuwe regel', qty: 1, unit_price: 0, vat_rate: vat ?? std, kind: opt ? 'vrij' : kind, opt_kind: opt, opt_group: grp, opt_default: opt === 'keuze' ? !ls.some((l) => l.opt_kind === 'keuze' && l.opt_group === grp) : opt === 'optie' ? false : true })
    if (error) toast(error.message, 'err'); else { lines.reload(); onChange() }
  }
  const removeLine = async (l: Line) => {
    if (!confirm(`Regel "${l.title}" weghalen?`)) return
    const { error } = await supabase.from('quote_lines').delete().eq('id', l.id)
    if (error) toast(error.message, 'err'); else { lines.reload(); onChange() }
  }
  const move = async (l: Line, dir: -1 | 1) => {
    const i = ls.findIndex((x) => x.id === l.id), j = i + dir
    if (j < 0 || j >= ls.length) return
    const o = ls[j]
    await supabase.from('quote_lines').update({ sort: o.sort }).eq('id', l.id)
    await supabase.from('quote_lines').update({ sort: l.sort === o.sort ? l.sort + dir : l.sort }).eq('id', o.id)
    lines.reload()
  }
  const send = async () => {
    setSending(true)
    const { data: s } = await supabase.auth.getSession()
    const r = await fetch(`${SUPABASE_URL}/functions/v1/quote-send`, { method: 'POST', headers: { Authorization: `Bearer ${s.session?.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id: q.id, message: msg }) })
    const j = await r.json().catch(() => ({}))
    setSending(false)
    if (!r.ok || j.error) return toast(j.error ?? 'Versturen mislukt', 'err')
    toast(`Offerte ${j.number} verstuurd naar ${j.to}`); onChange()
  }
  const newVersion = async () => {
    if (!confirm(`Nieuwe versie maken? ${q.number} wordt "vervangen" en je krijgt een nieuw concept met dezelfde regels.`)) return
    const { data: nr, error: e1 } = await supabase.rpc('next_quote_number')
    if (e1) return toast(e1.message, 'err')
    const { data: nq, error: e2 } = await supabase.from('quotes').insert({ project_code: q.project_code, number: nr, title: q.title, status: 'concept', margin_pct: q.margin_pct, language: q.language, intro: q.intro, closing: q.closing, doc_date: new Date().toLocaleDateString('sv-SE'), valid_until: q.valid_until }).select('id').single()
    if (e2 || !nq) return toast(e2?.message ?? 'mislukt', 'err')
    const { error: e3 } = await supabase.from('quote_lines').insert(ls.map(({ id: _i, quote_id: _q, ...l }) => ({ ...l, quote_id: nq.id })))
    if (e3) return toast(e3.message, 'err')
    if (q.status === 'verstuurd') await supabase.from('quotes').update({ status: 'vervangen' }).eq('id', q.id)
    toast(`Nieuwe versie ${nr}`); onChange()
  }

  const [lbl, cls] = STATUS[q.status] ?? [q.status, '']
  return (
    <div className="quote">
      <div className="quote-head">
        <div>
          <span className={'jo-pill ' + cls}>{lbl}</span> <strong>{q.number}</strong> · {q.title}
          <div className="muted small">
            {q.sent_at && <>verstuurd {new Date(q.sent_at).toLocaleDateString('nl-BE')} naar {q.sent_to} · </>}
            {q.accepted_at && <>aanvaard {new Date(q.accepted_at).toLocaleDateString('nl-BE')} door {q.accepted_name} · </>}
            {q.declined_at && <>geweigerd{q.declined_reason ? ': ' + q.declined_reason : ''} · </>}
            geldig tot {q.valid_until?.split('-').reverse().join('/')}
          </div>
        </div>
        <div className="seg">
          <button className={view === 'bewerken' ? 'on' : ''} onClick={() => setView('bewerken')}>{editable ? 'Bewerken' : 'Regels'}</button>
          <button className={view === 'voorbeeld' ? 'on' : ''} onClick={() => setView('voorbeeld')}>Voorbeeld</button>
        </div>
      </div>

      <div className="quote-intern">
        <span><small>Totaal excl. btw</small><b>{fmtEur(tot.excl)}</b></span>
        <span><small>Incl. btw</small><b>{fmtEur(tot.incl)}</b></span>
        <span title="Enkel intern: kostprijs uit de berekening (kasten, lades, werkblad)"><small>Kostprijs (intern)</small><b>{fmtEur(cost)}</b></span>
        <span title="Enkel intern"><small>Marge (intern)</small><b>{fmtEur(marginEur)}{cost ? ` · ${Math.round((marginEur / cost) * 100)} %` : ''}</b></span>
        {editable && (
          <span className="quote-margin">
            <small>Projectmarge %</small>
            <span><input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} />
              <button disabled={busy} onClick={() => onGenerate(margin === '' ? null : Number(margin))}>{busy ? '…' : 'Opnieuw opbouwen'}</button></span>
          </span>
        )}
      </div>
      {zero.length > 0 && <p className="quote-warn">{zero.length} regel(s) zonder prijs: {zero.map((l) => l.title).join(', ')}. Vul een prijs in of zet de korting op 100 %.</p>}
      <ErrorBox error={lines.error} />

      {view === 'bewerken' && (lines.loading ? <Loading /> : (
        <div className="qedit">
          {editable && (
            <div className="qedit-head">
              <label>Titel<input defaultValue={q.title ?? ''} onBlur={(e) => e.target.value !== (q.title ?? '') && saveQ({ title: e.target.value })} /></label>
              <label>Inleiding<textarea rows={4} defaultValue={q.intro ?? ''} onBlur={(e) => e.target.value !== (q.intro ?? '') && saveQ({ intro: e.target.value || null })} /></label>
            </div>
          )}
          {editable && (
            <details className="qtexts">
              <summary>Teksten op de offerte: inleiding, inbegrepen, planning, betaling, garantie</summary>
              <div className="qedit-head">
                {([['included', 'Inbegrepen (één per regel)'], ['excluded', 'Niet inbegrepen (één per regel)'], ['planning', 'Planning'], ['payment', 'Betaling'], ['warranty', 'Garantie'], ['closing', 'Slottekst (optioneel)']] as [keyof Quote, string][]).map(([k, label]) => (
                  <label key={k}>{label}<textarea rows={3} defaultValue={(q[k] as string | null) ?? ''} onBlur={(e) => e.target.value !== ((q[k] as string | null) ?? '') && saveQ({ [k]: e.target.value || null } as Partial<Quote>)} /></label>
                ))}
                <label className="qcheck"><input type="checkbox" checked={q.show_groups} onChange={(e) => saveQ({ show_groups: e.target.checked })} /> Regels per rubriek met subtotalen</label>
              </div>
              <p className="muted small">Standaardteksten aanpassen: Rekenregels → Offerte. Leeg = blok niet tonen.</p>
            </details>
          )}
          {ls.map((l, i) => (
            <div key={l.id} className={'qline' + (Number(l.unit_price) === 0 && Number(l.discount_pct) < 100 ? ' zero' : '')}>
              <div className="qline-main">
                <input className="qline-title" disabled={!editable} defaultValue={l.title} onBlur={(e) => e.target.value !== l.title && saveL(l.id, { title: e.target.value })} />
                <textarea disabled={!editable} rows={Math.min(8, Math.max(1, (l.description ?? '').split('\n').length))} placeholder="omschrijving" defaultValue={l.description ?? ''} onBlur={(e) => e.target.value !== (l.description ?? '') && saveL(l.id, { description: e.target.value || null })} />
                {l.source && <small className="muted">automatisch uit de kosten · kostprijs {fmtEur(l.cost_basis)}</small>}
                <div className="qline-opt">
                  <select disabled={!editable} value={l.opt_kind ?? ''} onChange={(e) => { const v = e.target.value || null; saveL(l.id, { opt_kind: v as Line['opt_kind'], opt_group: v === 'keuze' ? (l.opt_group || groups[0] || 'Keuze 1') : null, opt_default: v === 'optie' ? false : true }) }}>
                    <option value="">Vaste regel</option><option value="optie">Optie (aanvinken)</option><option value="keuze">Alternatief (één kiezen)</option>
                  </select>
                  {l.opt_kind === 'keuze' && <input disabled={!editable} list={'grp-' + q.id} placeholder="groep, bv. Werkblad" defaultValue={l.opt_group ?? ''} onBlur={(e) => e.target.value !== (l.opt_group ?? '') && saveL(l.id, { opt_group: e.target.value || null })} />}
                  {l.opt_kind && <label className="qcheck"><input type="checkbox" disabled={!editable} checked={l.opt_default} onChange={(e) => saveL(l.id, { opt_default: e.target.checked })} /> {l.opt_kind === 'keuze' ? 'standaardkeuze' : 'standaard aangevinkt'}</label>}
                  {!l.source && l.kind !== 'dienst' && <input disabled={!editable} placeholder="leverancier (voor de bestelling)" defaultValue={l.supplier ?? ''} onBlur={(e) => e.target.value !== (l.supplier ?? '') && saveL(l.id, { supplier: e.target.value || null })} />}
                  {!l.source && <label className="qcheck" title="Na akkoord als bestelling klaarzetten"><input type="checkbox" disabled={!editable} checked={l.order_needed ?? ['toestel', 'sanitair', 'werkblad', 'vrij'].includes(l.kind ?? '')} onChange={(e) => saveL(l.id, { order_needed: e.target.checked })} /> bestellen</label>}
                  {l.selected != null && <span className={'jo-pill ' + (l.selected ? 'ok' : 'muted')}>{l.selected ? 'gekozen door klant' : 'niet gekozen'}</span>}
                </div>
              </div>
              <div className="qline-nums">
                <label>Aantal<input type="number" disabled={!editable} defaultValue={l.qty} onBlur={(e) => Number(e.target.value) !== Number(l.qty) && saveL(l.id, { qty: Number(e.target.value) })} /></label>
                <label>Prijs excl.<input type="number" step="0.01" disabled={!editable} defaultValue={l.unit_price} onBlur={(e) => Number(e.target.value) !== Number(l.unit_price) && saveL(l.id, { unit_price: Number(e.target.value) })} /></label>
                <label>Korting %<input type="number" disabled={!editable} defaultValue={l.discount_pct} onBlur={(e) => Number(e.target.value) !== Number(l.discount_pct) && saveL(l.id, { discount_pct: Number(e.target.value) })} /></label>
                <label>Btw %<select disabled={!editable} value={Number(l.vat_rate)} onChange={(e) => saveL(l.id, { vat_rate: Number(e.target.value) })}>{[0, 6, 21].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
                <span className="qline-amt">{fmtEur(lineAmount(l))}</span>
                {editable && <span className="qline-act"><button title="Omhoog" onClick={() => move(l, -1)} disabled={i === 0}>↑</button><button title="Omlaag" onClick={() => move(l, 1)} disabled={i === ls.length - 1}>↓</button><button title="Weghalen" onClick={() => removeLine(l)}>×</button></span>}
              </div>
            </div>
          ))}
          <datalist id={'grp-' + q.id}>{groups.map((g) => <option key={g} value={g} />)}</datalist>
          {editable && <div className="order-actions">{KINDS.map(([k, label, vat]) => <button key={k} onClick={() => addLine(k, vat)}>+ {label}</button>)}</div>}
        </div>
      ))}

      {view === 'voorbeeld' && (
        <div className="qpreview">
          <div className="order-actions"><button onClick={printQuote}>Afdrukken / PDF</button></div>
          <QuoteDoc q={{ ...q, client_name: q.client_name ?? preview?.name ?? '', client_address: q.client_address ?? preview?.address ?? '' }} lines={ls} company={company} lang={(q.language as QLang) ?? 'nl'} btw6={btw6} signature={qsig} />
        </div>
      )}

      {sig && (
        <details className="qtexts qproof" open>
          <summary>Ondertekeningsbewijs</summary>
          <div className="qproof-grid">
            {sig.signature_png && <img src={sig.signature_png} alt="handtekening" />}
            <dl>
              <dt>Ondertekend door</dt><dd>{sig.signer_name} · {sig.signer_email}</dd>
              <dt>Tijdstip</dt><dd>{new Date(sig.signed_at).toLocaleString('nl-BE', { timeZone: 'Europe/Brussels' })}</dd>
              <dt>IP-adres</dt><dd>{sig.ip ?? '—'}</dd>
              <dt>Toestel</dt><dd className="small">{sig.user_agent ?? '—'}</dd>
              <dt>6 % btw-attest</dt><dd>{sig.vat6_confirmed == null ? 'n.v.t.' : sig.vat6_confirmed ? 'bevestigd' : 'niet bevestigd'}</dd>
              <dt>Verklaring</dt><dd className="small">{sig.consent_text}</dd>
              <dt>SHA-256</dt><dd className="small mono">{sig.doc_hash}</dd>
              <dt>Bevestiging</dt><dd>{sig.confirmation_sent_at ? 'gemaild ' + new Date(sig.confirmation_sent_at).toLocaleString('nl-BE') : 'nog niet verstuurd'}</dd>
            </dl>
          </div>
          <p className="muted small">De ondertekende versie (regels, keuzes, totalen) is vastgelegd en kan niet meer gewijzigd worden.</p>
        </details>
      )}
      <div className="quote-actions">
        {editable && (
          <div className="quote-send">
            <textarea rows={2} placeholder="Persoonlijke zin in de mail (optioneel)" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button className="primary" disabled={sending || zero.length > 0 || !ls.length} onClick={() => confirm(`Offerte ${q.number} (${fmtEur(tot.incl)} incl. btw) naar de klant sturen?`) && send()}>{sending ? 'Versturen…' : 'Versturen naar de klant'}</button>
          </div>
        )}
        {q.status === 'verstuurd' && <>
          <button onClick={() => send()} disabled={sending}>Opnieuw sturen</button>
          <button onClick={() => { const n = prompt('Naam van wie aanvaardde (op papier of mondeling):', q.client_name ?? ''); if (n) saveQ({ status: 'aanvaard', accepted_at: new Date().toISOString(), accepted_name: n }) }}>Aanvaard (op papier)</button>
          <button onClick={() => { const r = prompt('Reden (optioneel):') ; if (r !== null) saveQ({ status: 'geweigerd', declined_at: new Date().toISOString(), declined_reason: r || null }) }}>Geweigerd</button>
        </>}
        {['verstuurd', 'geweigerd', 'vervallen', 'aanvaard'].includes(q.status) && <button onClick={newVersion}>Nieuwe versie</button>}
      </div>
    </div>
  )
}
