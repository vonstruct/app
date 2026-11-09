import { useEffect, useState } from 'react'
import { toast } from '../../core/toast'
import { fmtEur, fmtNum } from '../../core/format'
import { howText, searchPrices } from './priceSearch'

/** Zoekresultaat (RPC cost_search2): unit_price = per stuk; pack_qty/pack_price = verpakking (doos van N); pack_sure = al gedeeld door N. */
export type Hit = { src: string; supplier: string | null; article_no: string | null; description: string; unit_price: number | null; unit: string | null; ref: string; seen: string | null; pack_qty?: number | null; pack_price?: number | null; pack_sure?: boolean | null }

/**
 * Zoekt in eigen artikels, prijslijsten (Häfele, Du Pont, …) en de regels van bestellingen en facturen uit je mailbox.
 * Eerst op artikelnummer, niets gevonden = op tekst. Met een regel: eerst het artikelnummer van de regel, niets = de naam van de regel.
 */
export function PriceFinder({ query, articleNo, onPick }: { query: string; articleNo?: string | null; onPick: (h: Hit) => void }) {
  const art = (articleNo ?? '').trim()
  const [q, setQ] = useState(art || query)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [how, setHow] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const run = async (text = q) => {
    setBusy(true)
    const r = await searchPrices<Hit>(text, 15)
    setBusy(false)
    if (r.error) return toast(r.error.message, 'err')
    setHits(r.hits)
    setHow(howText(r.how, text, r.hits.length))
    return r.hits.length
  }
  useEffect(() => {
    (async () => {
      if (art) {
        const n = await run(art)
        // niets op het artikelnummer van de regel: dan op de naam van de regel
        if (n === 0 && query) {
          setQ(query)
          const m = await run(query)
          if (m != null) setHow(m ? `Niets op artikelnummer ${art}: gezocht op de naam.` : `Niets op artikelnummer ${art} en niets op de naam: probeer een korter woord, of "zelf invullen".`)
        }
      } else if (query) run(query)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="finder">
      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} placeholder="artikelnummer (of naam)" />
        <button onClick={() => run()} disabled={busy}>{busy ? 'Zoeken…' : 'Zoeken'}</button>
        <span className="small muted">eerst op artikelnummer, anders op tekst · in eigen artikels, prijslijsten en bestellingen/facturen uit je mailbox</span>
      </div>
      {hits && how && <p className="small muted">{how}</p>}
      {hits && hits.length > 0 && (
        <table className="finder-hits">
          <tbody>
            {hits.map((h, i) => (
              <tr key={i}>
                <td><span className={'tag t-' + h.src}>{h.src === 'mail' ? 'mail' : h.src === 'eigen' ? 'eerder ingevuld' : 'prijslijst'}</span></td>
                <td>{h.description}<div className="small muted">{[h.supplier, h.article_no, h.seen && new Date(h.seen).toLocaleDateString('nl-BE')].filter(Boolean).join(' · ')}</div></td>
                <td className="num">
                  {h.unit_price == null ? '' : fmtEur(h.unit_price)}{h.unit ? <small className="muted"> / {h.unit}</small> : null}
                  {h.pack_qty && h.pack_price != null && h.pack_sure && <div className="small muted">doos van {fmtNum(h.pack_qty, 0)}: {fmtEur(h.pack_price)}</div>}
                  {h.pack_qty && h.pack_price != null && !h.pack_sure && <div className="small muted">verpakking per {fmtNum(h.pack_qty, 0)}</div>}
                </td>
                <td className="nowrap">
                  <button className="small" disabled={h.unit_price == null} onClick={() => onPick(h)}>{h.pack_qty && !h.pack_sure ? 'Kies (per stuk)' : 'Kies'}</button>
                  {/* twijfel: is de prijs per stuk of per verpakking van N? dan kies je zelf */}
                  {h.pack_qty && !h.pack_sure && h.pack_price != null && (
                    <button className="small" title={`De prijs geldt voor de verpakking van ${h.pack_qty}: delen door ${h.pack_qty}`} onClick={() => onPick({ ...h, unit_price: Math.round((h.pack_price! / h.pack_qty!) * 10000) / 10000 })}>÷ {fmtNum(h.pack_qty, 0)}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

