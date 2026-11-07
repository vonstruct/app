import { useEffect, useMemo, useState } from 'react'
import { supabase, SUPABASE_URL } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { QuoteDoc, printQuote, lineAmount, quoteTotals, lineOn, type Company, type QLang, type QSignature } from '../../core/QuoteDoc'
import { RuleLink } from '../../core/RuleLink'
import { DateInput } from '../../core/DateInput'

/**
 * Tab "Offerte" op de projectpagina. Offertes worden in de app gemaakt (Olivier, 7 nov 2026): opbouwen uit de projectkost = RPC quote_generate
 * (groepen uit de kostprijs + vaste regels), regels bewerken, intern: kostprijs en marge (nooit voor de klant), voorbeeld/afdrukken,
 * versturen = Edge Function quote-send, ondertekenen in het portaal. Een oudere offerte (pdf, bv. uit de boekhouding) kan nog opgeladen worden (quotes.external).
 */
type Quote = {
  id: string; project_code: string; number: string | null; title: string | null; status: string; doc_date: string | null; valid_until: string | null
  margin_pct: number | null; client_name: string | null; client_address: string | null; language: string | null; intro: string | null; closing: string | null
  sent_at: string | null; sent_to: string | null; accepted_at: string | null; accepted_name: string | null; declined_at: string | null; declined_reason: string | null
  total_excl: number; total_incl: number; cost: number | null; margin_eur: number; n_zero: number; created_at: string
  included: string | null; excluded: string | null; planning: string | null; payment: string | null; warranty: string | null; show_groups: boolean; project_title: string | null; site: string | null
  external?: boolean; pdf_path?: string | null
}
type Line = { id: string; quote_id: string; sort: number; title: string; description: string | null; qty: number; unit_price: number; discount_pct: number; vat_rate: number; kind: string | null; source: string | null; cost_basis: number | null; opt_kind: 'optie' | 'keuze' | null; opt_group: string | null; opt_default: boolean; selected: boolean | null; supplier: string | null; order_needed: boolean | null; group_name?: string | null }
type Sig = { id: string; signer_name: string; signer_email: string | null; signed_at: string; ip: string | null; user_agent: string | null; signature_png: string | null; doc_hash: string; vat6_confirmed: boolean | null; consent_text: string | null; confirmation_sent_at: string | null }

const STATUS: Record<string, [string, string]> = {
  concept: ['Concept', 'muted'], verstuurd: ['Verstuurd', 'warn'], aanvaard: ['Aanvaard', 'ok'], geweigerd: ['Geweigerd', 'bad'], vervallen: ['Vervallen', 'muted'], vervangen: ['Vervangen', 'muted'],
}
const KINDS: [string, string, number | null][] = [['vrij', 'Vrije regel', null], ['toestel', 'Toestel (21 % btw)', 21], ['sanitair', 'Sanitair', null], ['dienst', 'Dienst / arbeid', null], ['info', 'Info (zonder bedrag)', null], ['optie', 'Optie (klant vinkt aan)', null], ['keuze', 'Alternatief (klant kiest één)', null]]

export function QuotePanel({ project }: { project: string }) {
  const list = useQuery<Quote[]>(() => supabase.from('app_quotes').select('*').eq('project_code', project).order('created_at', { ascending: false }), [project])
  const company = useQuery<{ value: Company } | null>(() => supabase.from('rule_settings').select('value').eq('key', 'bedrijf').maybeSingle(), [])
  const terms = useQuery<{ value: { btw6?: string } } | null>(() => supabase.from('rule_settings').select('value').eq('key', 'offerte_voorwaarden').maybeSingle(), [])
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
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
        {(!current || current.status !== 'concept' || current.external) && <button className="primary" disabled={busy} onClick={() => generate()}>{busy ? 'Bezig…' : current ? 'Nieuwe offerte' : 'Offerte opbouwen uit de projectkost'}</button>}
        <button onClick={() => setImporting((x) => !x)}>Bestaande offerte toevoegen (pdf)</button>
      </div>
      <ErrorBox error={list.error} />
      {importing && <ImportQuote project={project} onDone={(id) => { setImporting(false); if (id) { setSel(id); list.reload() } }} />}
      {current?.external && <ExternalQuote key={current.id} q={current} onChange={list.reload} />}
      {current && !current.external && <QuoteEditor key={current.id} q={current} company={company.data?.value ?? {}} btw6={terms.data?.value?.btw6 ?? null} onChange={list.reload} onGenerate={generate} busy={busy} />}
    </div>
  )
}

function QuoteEditor({ q, company, btw6, onChange, onGenerate, busy }: { q: Quote; company: Company; btw6: string | null; onChange: () => void; onGenerate: (m?: number | null) => void; busy: boolean }) {
  const lines = useQuery<Line[]>(() => supabase.from('quote_lines').select('*').eq('quote_id', q.id).order('sort').order('created_at'), [q.id, q.total_excl])
  const vn = useQuery<{ vat_note: string | null } | null>(() => supabase.from('quotes').select('vat_note').eq('id', q.id).maybeSingle(), [q.id, q.total_excl])
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
  const zero = ls.filter((l) => Number(l.unit_price) === 0 && Number(l.discount_pct) < 100 && l.kind !== 'info')

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
    const { error } = await supabase.from('quote_lines').insert({ quote_id: q.id, sort, title: kind === 'toestel' ? 'Toestel' : kind === 'info' ? 'Info, bv. 5 jaar garantie op de toestellen' : opt === 'keuze' ? 'Alternatief' : opt === 'optie' ? 'Optie' : 'Nieuwe regel', qty: 1, unit_price: 0, vat_rate: vat ?? std, kind: opt ? 'vrij' : kind, opt_kind: opt, opt_group: grp, opt_default: opt === 'keuze' ? !ls.some((l) => l.opt_kind === 'keuze' && l.opt_group === grp) : opt === 'optie' ? false : true })
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
      <PaymentSchedule q={q} onChange={onChange} />
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
              <p className="muted small">Standaardteksten aanpassen: <RuleLink s="Offerte" />. Leeg = blok niet tonen.</p>
            </details>
          )}
          {ls.map((l, i) => (
            <div key={l.id} className={'qline' + (Number(l.unit_price) === 0 && Number(l.discount_pct) < 100 ? ' zero' : '')}>
              <div className="qline-main">
                <input className="qline-title" disabled={!editable} defaultValue={l.title} onBlur={(e) => e.target.value !== l.title && saveL(l.id, { title: e.target.value })} />
                <textarea disabled={!editable} rows={Math.min(8, Math.max(1, (l.description ?? '').split('\n').length))} placeholder="omschrijving" defaultValue={l.description ?? ''} onBlur={(e) => e.target.value !== (l.description ?? '') && saveL(l.id, { description: e.target.value || null })} />
                {l.source && <small className="muted">automatisch uit de projectkost{l.group_name ? ` (${l.group_name})` : ''} · kostprijs {fmtEur(l.cost_basis)} · titel en uitleg pas je aan in Projectkost</small>}
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
          <QuoteDoc q={{ ...q, vat_note: vn.data?.vat_note ?? null, client_name: q.client_name ?? preview?.name ?? '', client_address: q.client_address ?? preview?.address ?? '' }} lines={ls} company={company} lang={(q.language as QLang) ?? 'nl'} btw6={btw6} signature={qsig} />
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

/** Bestaande offerte (bv. gemaakt in Yuki) toevoegen: pdf kiezen → de app leest ze (Edge Function doc-scan: nummer, datum, bedragen per btw-tarief),
 *  jij kijkt na → RPC quote_import_pdf. Maakt geen betalingsschijven of bestellingen. */
type VatLine = { vat_rate: number; excl: string }
function ImportQuote({ project, onDone }: { project: string; onDone: (id: string | null) => void }) {
  const [f, setF] = useState({ number: '', date: new Date().toLocaleDateString('sv-SE'), status: 'aanvaard', accepted: '', title: '' })
  const [lines, setLines] = useState<VatLine[]>([{ vat_rate: 6, excl: '' }])
  const [path, setPath] = useState<string | null>(null)
  const [scan, setScan] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const num = (v: string) => Number(String(v).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0
  const totExcl = lines.reduce((a, l) => a + num(l.excl), 0)
  const totIncl = lines.reduce((a, l) => a + num(l.excl) * (1 + l.vat_rate / 100), 0)
  const ok = f.number.trim() && totExcl > 0 && path

  const pick = async (file: File | null) => {
    if (!file) return
    setScan('busy'); setNote(null)
    const p = `${project}/documenten/offerte-${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    const up = await supabase.storage.from('project-uploads').upload(p, file, { contentType: file.type || 'application/pdf' })
    if (up.error) { setScan('fail'); return toast('Uploaden mislukt: ' + up.error.message, 'err') }
    setPath(p)
    let { data, error } = await supabase.functions.invoke('doc-scan', { body: { path: p } })
    if (error || !data?.ok) ({ data, error } = await supabase.functions.invoke('doc-scan', { body: { path: p } })) // nog één keer
    if (error || !data?.ok) {
      let why = data?.error as string | undefined
      try { why ??= (await (error as { context?: Response })?.context?.json())?.error } catch { /* */ }
      setScan('fail'); setNote(`De app kon de pdf niet lezen${why ? ` (${why})` : ''}. Kies de pdf opnieuw, of vul de gegevens zelf in.`); return
    }
    setScan('ok')
    setF((o) => ({ ...o, number: data.number ?? o.number, date: data.date ?? o.date, title: data.title ?? o.title }))
    if (Array.isArray(data.lines) && data.lines.length) setLines(data.lines.map((l: { vat_rate: number; excl: number }) => ({ vat_rate: Number(l.vat_rate), excl: String(l.excl).replace('.', ',') })))
    setNote([data.type && data.type !== 'offerte' ? `Let op: dit lijkt een ${data.type}.` : null, data.client ? `Klant op de pdf: ${data.client}.` : null, data.notes, data.warning ? `Controle: ${data.warning}.` : null].filter(Boolean).join(' '))
  }
  const save = async () => {
    if (!ok) return
    setBusy(true)
    const { data, error } = await supabase.rpc('quote_import_pdf', { p_code: project, p_number: f.number.trim().toUpperCase(), p_doc_date: f.date, p_status: f.status, p_pdf_path: path, p_lines: lines.filter((l) => num(l.excl) > 0).map((l) => ({ vat_rate: l.vat_rate, excl: num(l.excl) })), p_title: f.title || null, p_accepted_at: f.accepted || null })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast('Offerte toegevoegd'); onDone(data as string)
  }
  return (
    <div className="panel import-quote">
      <h3>Bestaande offerte toevoegen</h3>
      <p className="muted small">Kies de pdf (bv. uit Yuki): de app leest nummer, datum en bedragen per btw-tarief. Jij kijkt na en bewaart. De pdf komt ook bij Documenten; er worden geen betalingsschijven of bestellingen aangemaakt.</p>
      <label className="iq-file">Pdf of foto<input type="file" accept="application/pdf,image/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} /></label>
      {scan === 'busy' && <p className="small">De app leest de offerte… (± 10 seconden)</p>}
      {scan === 'ok' && <p className="small ok-txt">Gelezen ✓ Kijk de gegevens na.</p>}
      {note && <p className="small muted">{note}</p>}
      <div className="new-rel-grid">
        <label>Nummer<input value={f.number} onChange={set('number')} placeholder="bv. OFF1" /></label>
        <label>Datum<DateInput value={f.date} onChange={set('date')} /></label>
        <label>Omschrijving<input value={f.title} onChange={set('title')} placeholder="bv. Keuken" /></label>
        <label>Status<select value={f.status} onChange={set('status')}><option value="aanvaard">Aanvaard</option><option value="verstuurd">Verstuurd (wacht op antwoord)</option><option value="geweigerd">Geweigerd</option></select></label>
        {f.status === 'aanvaard' && <label>Aanvaard op (optioneel)<DateInput value={f.accepted} onChange={set('accepted')} /></label>}
      </div>
      <div className="iq-lines">
        <b className="small">Bedragen excl. btw per tarief</b>
        {lines.map((l, i) => (
          <div key={i} className="iq-line">
            <select value={l.vat_rate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, vat_rate: Number(e.target.value) } : x)))}><option value={6}>6 %</option><option value={21}>21 %</option><option value={12}>12 %</option><option value={0}>0 %</option></select>
            <input inputMode="decimal" value={l.excl} placeholder="bedrag excl. btw" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, excl: e.target.value } : x)))} />
            {lines.length > 1 && <button className="link small" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        <button className="link small" onClick={() => setLines([...lines, { vat_rate: 21, excl: '' }])}>+ ander btw-tarief</button>
        {totExcl > 0 && <p className="small muted">Totaal: {fmtEur(totExcl)} excl. · {fmtEur(Math.round(totIncl * 100) / 100)} incl. btw</p>}
      </div>
      <div className="row-actions"><button className="primary" disabled={!ok || busy || scan === 'busy'} onClick={save}>{busy ? 'Bezig…' : 'Toevoegen'}</button><button onClick={() => onDone(null)}>Annuleren</button></div>
    </div>
  )
}

/** Weergave van een toegevoegde (externe) offerte: pdf openen, bedrag, status wijzigen. */
function ExternalQuote({ q, onChange }: { q: Quote; onChange: () => void }) {
  const [lbl, cls] = STATUS[q.status] ?? [q.status, '']
  const open = async () => { if (!q.pdf_path) return; const { data } = await supabase.storage.from('project-uploads').createSignedUrl(q.pdf_path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  const setStatus = async (status: string) => {
    const { error } = await supabase.from('quotes').update({ status, ...(status === 'aanvaard' ? { accepted_at: new Date().toISOString() } : {}) }).eq('id', q.id)
    if (error) toast(error.message, 'err'); else { toast('Bewaard'); onChange() }
  }
  return (
    <div className="panel">
      <div className="tasks-head"><h2>{q.number} <span className={'jo-pill ' + cls}>{lbl}</span></h2>{q.pdf_path && <button className="primary" onClick={open}>Pdf openen</button>}</div>
      <p className="muted small">Toegevoegd als pdf (gemaakt buiten de app). Telt mee voor de omzet en de nacalculatie; betalingsschijven en bestellingen maak je zelf aan.</p>
      <div className="quote-intern">
        <span><small>Datum</small><b>{q.doc_date ? new Date(q.doc_date + 'T12:00').toLocaleDateString('nl-BE') : '—'}</b></span>
        <span><small>Excl. btw</small><b>{fmtEur(q.total_excl)}</b></span>
        <span><small>Incl. btw</small><b>{fmtEur(q.total_incl)}</b></span>
      </div>
      <div className="seg">{['verstuurd', 'aanvaard', 'geweigerd'].map((s) => <button key={s} className={q.status === s ? 'on' : ''} onClick={() => setStatus(s)}>{STATUS[s][0]}</button>)}</div>
    </div>
  )
}

/**
 * Betalingsschema van deze offerte (7 nov 2026, Olivier: "niet altijd te volgen, geen harde regel"): standaard uit de regel
 * betalingsschijven, per offerte aan te passen. Concept/verstuurd: bewaart quotes.payment_schedule (de schijven volgen bij het tekenen).
 * Aanvaard: RPC invoice_schedule_reset maakt de schijven opnieuw, zolang er nog niets gefactureerd is.
 */
function PaymentSchedule({ q, onChange }: { q: Quote; onChange: () => void }) {
  type S = { voorschot: number; levering: number; saldo: number }
  const own = useQuery<{ payment_schedule: S | null } | null>(() => supabase.from('quotes').select('payment_schedule').eq('id', q.id).maybeSingle(), [q.id, q.status])
  const rule = useQuery<{ value: S } | null>(() => supabase.from('rule_settings').select('value').eq('key', 'betalingsschijven').maybeSingle(), [])
  const cur: S | null = own.data?.payment_schedule ?? rule.data?.value ?? null
  const [f, setF] = useState<{ voorschot: string; levering: string; saldo: string } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!cur || q.external) return null
  const open = f !== null
  const total = f ? ['voorschot', 'levering', 'saldo'].reduce((s, k) => s + (Number(String(f[k as keyof typeof f]).replace(',', '.')) || 0), 0) : cur.voorschot + cur.levering + cur.saldo
  const save = async () => {
    if (!f) return
    const sched = { voorschot: Number(f.voorschot.replace(',', '.')) || 0, levering: Number(f.levering.replace(',', '.')) || 0, saldo: Number(f.saldo.replace(',', '.')) || 0 }
    setBusy(true)
    const { error } = q.status === 'aanvaard'
      ? await supabase.rpc('invoice_schedule_reset', { p_quote: q.id, p_schedule: sched })
      : await supabase.from('quotes').update({ payment_schedule: sched }).eq('id', q.id)
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast(q.status === 'aanvaard' ? 'Schijven opnieuw gemaakt (Geld › Facturen)' : 'Betalingsschema bewaard')
    setF(null); own.reload(); onChange()
  }
  return (
    <div className="pay-sched small">
      <b>Betalingsschema</b>{' '}
      {!open ? (
        <>
          <span>{cur.voorschot} % voorschot · {cur.levering} % bij levering · {cur.saldo} % saldo{own.data?.payment_schedule ? '' : ' (standaard)'}</span>
          {total !== 100 && <span className="muted"> · samen {total} %: de laatste schijf wordt de rest</span>}
          {['concept', 'verstuurd', 'aanvaard'].includes(q.status) && <button className="link small" onClick={() => setF({ voorschot: String(cur.voorschot), levering: String(cur.levering), saldo: String(cur.saldo) })}>aanpassen</button>}
        </>
      ) : (
        <span className="pay-sched-edit">
          <label>Voorschot % <input inputMode="decimal" value={f.voorschot} onChange={(e) => setF({ ...f, voorschot: e.target.value })} /></label>
          <label>Bij levering % <input inputMode="decimal" value={f.levering} onChange={(e) => setF({ ...f, levering: e.target.value })} /></label>
          <label>Saldo % <input inputMode="decimal" value={f.saldo} onChange={(e) => setF({ ...f, saldo: e.target.value })} /></label>
          <span className={total === 100 ? 'muted' : 'bad-txt'}>samen {total} %</span>
          <button className="primary small" disabled={busy} onClick={save}>{busy ? '…' : q.status === 'aanvaard' ? 'Schijven opnieuw maken' : 'Bewaren'}</button>
          <button className="small" onClick={() => setF(null)}>Annuleren</button>
        </span>
      )}
    </div>
  )
}
