import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { toast } from '../../core/toast'
import { fmtEur, fmtNum, parseAmount } from '../../core/format'

type Fresh = { supplier_name: string; n_articles: number; last_update: string | null; days_old: number | null }
type Hit = { src: string; supplier: string | null; article_no: string | null; description: string; unit_price: number | null; unit: string | null; ref: string; seen: string | null }

/**
 * Rekenregels → Prijzen → Prijslijsten raadplegen (9/11/2026, Olivier: "waar kan ik mijn prijslijsten raadplegen?").
 * Per leverancier: aantal artikels en laatste update (app_supplier_freshness). Zoeken in alle prijslijsten, je eigen prijslijst
 * (Eigen artikels) en prijzen uit mails (RPC cost_search2). "Eigen prijs" = bewaard in Eigen artikels (manual_prices): gaat voor op de
 * prijslijst van de leverancier, in alle projecten. De prijslijsten zelf worden bij elke update overschreven, daarom nooit daarin.
 */
export function PriceLists() {
  const fq = useQuery<Fresh[]>(() => supabase.from('app_supplier_freshness').select('*').order('supplier_name'), [])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (q.trim().length < 2) return toast('Typ minstens 2 tekens (naam of artikelnummer)', 'err')
    setBusy(true)
    const { data, error } = await supabase.rpc('cost_search2', { p_q: q.trim(), p_limit: 50 })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    setHits((data ?? []) as Hit[])
  }
  const own = async (h: Hit, price: number) => {
    const { error } = await supabase.rpc('set_manual_item', {
      p_article_no: h.article_no ?? '', p_description: h.description, p_supplier: h.supplier, p_price: price, p_origin: 'Bestellen',
    })
    if (error) return toast(error.message, 'err')
    toast(`Eigen prijs ${fmtEur(price)} bewaard voor "${h.description}" (Eigen artikels, alle projecten). De kostprijs van bestaande versies volgt meteen (platen: na herberekenen).`)
    run()
  }
  return (
    <div className="panel">
      <h2>Prijslijsten raadplegen</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Leverancier</th><th className="num">Artikels</th><th>Laatst bijgewerkt</th></tr></thead>
          <tbody>
            {(fq.data ?? []).map((f) => (
              <tr key={f.supplier_name}>
                <td>{f.supplier_name}</td>
                <td className="num">{fmtNum(f.n_articles, 0)}</td>
                <td className={f.days_old != null && f.days_old > 35 ? 'warn-text' : undefined}>{f.last_update ? new Date(f.last_update).toLocaleDateString('nl-BE') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} placeholder="naam of artikelnummer" />
        <button onClick={run} disabled={busy}>{busy ? 'Zoeken…' : 'Zoeken'}</button>
        <span className="small muted">in alle prijslijsten, je eigen prijslijst en prijzen uit mails</span>
      </div>
      {hits && !hits.length && <p className="small muted">Niets gevonden. Probeer een kortere naam of het artikelnummer.</p>}
      {hits && hits.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bron</th><th>Omschrijving</th><th>Leverancier</th><th>Artikel</th><th className="num">Prijs</th><th className="num">Eigen prijs</th></tr></thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={i}>
                  <td><span className={'tag t-' + h.src}>{h.src === 'mail' ? 'mail' : h.src === 'eigen' ? 'eigen prijs' : 'prijslijst'}</span></td>
                  <td>{h.description}{h.seen && <div className="small muted">{new Date(h.seen).toLocaleDateString('nl-BE')}</div>}</td>
                  <td>{h.supplier}</td>
                  <td>{h.article_no}</td>
                  <td className="num">{h.unit_price == null ? '' : fmtEur(h.unit_price)}{h.unit ? <small className="muted"> / {h.unit}</small> : null}</td>
                  <td className="num"><OwnPrice onSave={(v) => own(h, v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        Een prijs aanpassen (hier, of in een tabblad van een versie of in de Kostprijs) bewaart ze als <b>eigen prijs</b> in je eigen prijslijst
        (Eigen artikels, hieronder): die gaat voor op de prijslijst van de leverancier, in alle projecten. De prijslijsten van de leveranciers
        zelf worden bij elke update overschreven, daarom komt je prijs nooit daarin.
      </p>
    </div>
  )
}

function OwnPrice({ onSave }: { onSave: (v: number) => void }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState('')
  if (!edit) return <button type="button" className="price-btn" onClick={() => { setV(''); setEdit(true) }}>eigen prijs…</button>
  return (
    <input autoFocus className="price-input" inputMode="decimal" placeholder="€ per stuk" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEdit(false); const n = parseAmount(v); if (n == null) return; if (Number.isNaN(n)) return toast('Geen geldig bedrag', 'err'); onSave(n) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false) }} />
  )
}
