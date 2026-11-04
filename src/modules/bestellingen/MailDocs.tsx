import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { toast } from '../../core/toast'
import { Orders } from './Orders'

/**
 * Bestellingen uit de mailbox (tabel mail_documents, gevuld door Edge Function mail-docs): orderbevestigingen, facturen,
 * leveringsbons en offertes van leveranciers, gelezen uit de bijlage (of uit de mail zelf). Eén duidelijke kandidaat =
 * automatisch gekoppeld (mail_doc_link: bestelling bijwerken of aanmaken); de rest staat hier "na te kijken".
 */
type Doc = {
  id: string; message_id: string; att_id: string; name: string | null; kind: string | null; supplier: string | null; doc_number: string | null; doc_date: string | null
  reference: string | null; client_hint: string | null; address_hint: string | null; delivery_date: string | null; total_excl: number | null; total_incl: number | null
  lines: { article?: string; description?: string; qty?: number; amount_excl?: number }[] | null; project_code: string | null; match_score: number | null; match_reason: string | null
  candidates: { project_code: string | null; client: string | null; score: number; reason: string }[] | null; match_source: string | null; order_id: string | null; status: string; storage_path: string | null
  mail_messages: { subject: string | null; from_name: string | null; from_email: string | null; at: string; web_link: string | null; direction: string } | null
}
type P = { project_code: string; title: string | null; client_name: string | null }
const KIND: Record<string, string> = { bestelling: 'Bestelling', levering: 'Levering', leveringsbon: 'Leveringsbon', aankoopfactuur: 'Factuur', offerte_leverancier: 'Offerte leverancier' }
const d = (v: string | null | undefined) => (v ? new Date(v.length === 10 ? v + 'T12:00' : v).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: '2-digit' }) : '—')

/** Planning → Bestellingen: tabs "Bestellingen" en "Uit je mailbox". */
export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'mailbox' ? 'mailbox' : 'orders'
  const n = useQuery<number>(async () => {
    const { count } = await supabase.from('mail_documents').select('id', { count: 'exact', head: true }).in('status', ['nieuw', 'gelezen'])
    return { data: count ?? 0, error: null }
  }, [tab])
  return (
    <>
      <div className="segmented small" style={{ marginBottom: 12 }}>
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>Bestellingen</button>
        <button className={tab === 'mailbox' ? 'on' : ''} onClick={() => setParams({ tab: 'mailbox' }, { replace: true })}>Uit je mailbox{n.data ? ` (${n.data} na te kijken)` : ''}</button>
      </div>
      {tab === 'orders' ? <Orders /> : <MailDocs />}
    </>
  )
}

export function MailDocs({ project }: { project?: string }) {
  const [filter, setFilter] = useState<'todo' | 'linked' | 'other'>(project ? 'linked' : 'todo')
  const [pick, setPick] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const q = useQuery<Doc[]>(() => {
    let r = supabase.from('mail_documents').select('*, mail_messages(subject,from_name,from_email,at,web_link,direction)').neq('kind', 'andere')
    if (project) r = r.eq('project_code', project)
    return r.order('created_at', { ascending: false }).limit(300)
  }, [project])
  const pq = useQuery<P[]>(() => supabase.from('app_projects').select('project_code,title,client_name').order('project_code', { ascending: false }) as never, [])
  const rows = useMemo(() => (q.data ?? [])
    .filter((x) => filter === 'todo' ? ['nieuw', 'gelezen'].includes(x.status) : filter === 'linked' ? x.status === 'gekoppeld' : ['geen_project', 'genegeerd'].includes(x.status))
    .sort((a, b) => (b.mail_messages?.at ?? '').localeCompare(a.mail_messages?.at ?? '')), [q.data, filter])
  const count = (f: (x: Doc) => boolean) => (q.data ?? []).filter(f).length

  const link = async (x: Doc, code: string | null) => {
    const { error } = await supabase.rpc('mail_doc_link_all', { p_doc: x.id, p_project: code, p_source: 'hand' })
    if (error) toast(error.message, 'err'); else { toast(code ? `Gekoppeld aan ${code}` : 'Geen project'); q.reload() }
  }
  const ignore = async (x: Doc) => {
    const { error } = await supabase.from('mail_documents').update({ status: 'genegeerd', updated_at: new Date().toISOString() }).eq('id', x.id)
    if (error) toast(error.message, 'err'); else q.reload()
  }
  const openDoc = async (x: Doc) => {
    if (!x.storage_path) { if (x.mail_messages?.web_link) window.open(x.mail_messages.web_link, '_blank'); return }
    const w = window.open('', '_blank')
    const { data, error } = await supabase.functions.invoke('mail-docs', { body: { action: 'url', doc_id: x.id } })
    if (error || !data?.url) { w?.close(); toast('Bijlage niet gevonden', 'err'); return }
    if (w) w.location.href = data.url; else window.open(data.url, '_blank')
  }

  if (q.loading) return <Loading />
  return (
    <div className="orders maildocs">
      {!project && <p className="muted small">Orderbevestigingen, facturen, leveringsbons en offertes van leveranciers uit je mailbox (info@ en olivier@): de bijlage wordt gelezen en gekoppeld aan het project als de klantnaam, het werfadres, de projectcode of het bestelnummer duidelijk is. De bestelling in het project wordt dan bijgewerkt of aangemaakt. Twijfel = hier na te kijken.</p>}
      <div className="orders-bar">
        <div className="seg">
          <button className={filter === 'todo' ? 'on' : ''} onClick={() => setFilter('todo')}>Na te kijken ({count((x) => ['nieuw', 'gelezen'].includes(x.status))})</button>
          <button className={filter === 'linked' ? 'on' : ''} onClick={() => setFilter('linked')}>Gekoppeld ({count((x) => x.status === 'gekoppeld')})</button>
          <button className={filter === 'other' ? 'on' : ''} onClick={() => setFilter('other')}>Geen project ({count((x) => ['geen_project', 'genegeerd'].includes(x.status))})</button>
        </div>
      </div>
      <ErrorBox error={q.error} />
      {!rows.length && <p className="muted">{filter === 'todo' ? 'Niets na te kijken.' : 'Niets.'}</p>}
      {rows.map((x) => {
        const m = x.mail_messages
        const amt = x.total_excl ?? x.total_incl
        const cands = (x.candidates ?? []).filter((c) => c.project_code)
        const sel = pick[x.id] ?? x.project_code ?? cands[0]?.project_code ?? ''
        const isOpen = open === x.id
        return (
          <div key={x.id} className={'order-row' + (isOpen ? ' open' : '')}>
            <div className="order-head" onClick={() => setOpen(isOpen ? null : x.id)}>
              <span className="jo-pill">{KIND[x.kind ?? ''] ?? x.kind ?? 'Document'}</span>
              <div className="order-main">
                <strong>{x.supplier ?? m?.from_name ?? m?.from_email}</strong>{x.doc_number && <span className="muted"> · {x.doc_number}</span>}
                <div className="muted small">
                  {[x.reference && `ref. ${x.reference}`, x.client_hint && `klant ${x.client_hint}`, x.address_hint, x.delivery_date && `levering/afhaling ${d(x.delivery_date)}`].filter(Boolean).join(' · ') || m?.subject}
                </div>
                {x.status === 'gekoppeld' && x.project_code && (
                  <div className="small"><Link to={`/projecten/${x.project_code}?tab=bestellingen`} onClick={(e) => e.stopPropagation()}>{x.project_code}</Link>
                    <span className="muted"> · {x.match_source === 'auto' ? `automatisch (${x.match_reason ?? ''})` : x.match_source === 'agent' ? 'door de Inkoop-agent' : 'met de hand'}{x.order_id ? ' · bestelling bijgewerkt' : ''}</span></div>
                )}
              </div>
              <div className="order-dates small">{d(x.doc_date ?? m?.at)}<div className="muted">{m?.direction === 'out' ? 'door jou verstuurd' : 'ontvangen'}</div></div>
              <div className="order-amt">{amt != null ? fmtEur(amt) : ''}</div>
            </div>
            <div className="md-actions small">
              {x.status !== 'gekoppeld' && cands.slice(0, 3).map((c) => (
                <button key={c.project_code!} className="md-cand" title={c.reason} onClick={() => link(x, c.project_code)}>{c.project_code} · {c.client} <small>{c.reason}</small></button>
              ))}
              <select value={sel} onChange={(e) => setPick((p) => ({ ...p, [x.id]: e.target.value }))}>
                <option value="">— project —</option>
                {(pq.data ?? []).map((p) => <option key={p.project_code} value={p.project_code}>{p.project_code} · {p.client_name ?? p.title}</option>)}
              </select>
              <button className="primary" disabled={!sel || (x.status === 'gekoppeld' && sel === x.project_code)} onClick={() => link(x, sel)}>{x.status === 'gekoppeld' ? 'Ander project' : 'Koppelen'}</button>
              {x.status !== 'geen_project' && <button onClick={() => link(x, null)} title="Hoort bij geen klantproject (werkplaats, gereedschap, algemene kost)">Geen project</button>}
              {x.status !== 'genegeerd' && x.status !== 'gekoppeld' && <button className="link small" onClick={() => ignore(x)}>negeren</button>}
              <button className="link small" onClick={() => openDoc(x)}>{x.storage_path ? 'bijlage openen' : 'mail openen'}</button>
              {x.storage_path && m?.web_link && <a className="small" href={m.web_link} target="_blank" rel="noreferrer">mail</a>}
            </div>
            {isOpen && (
              <div className="order-body small">
                <div className="muted">{m?.from_name} &lt;{m?.from_email}&gt; · {m?.subject}</div>
                {x.lines?.length ? (
                  <table className="md-lines"><tbody>{x.lines.map((l, i) => <tr key={i}><td>{l.article ?? ''}</td><td>{l.description ?? ''}</td><td className="num">{l.qty ?? ''}</td><td className="num">{l.amount_excl != null ? fmtEur(l.amount_excl) : ''}</td></tr>)}</tbody></table>
                ) : <p className="muted">Geen regels gelezen.</p>}
                {x.total_excl != null && <div>Totaal excl. btw {fmtEur(x.total_excl)}{x.total_incl != null ? ` · incl. ${fmtEur(x.total_incl)}` : ''}</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
