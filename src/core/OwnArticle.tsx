import { useState } from 'react'
import { supabase } from './supabase'

export const ORIGINS = ['Bestellen', 'Zelf maken', 'Negeren'] as const
export type Origin = (typeof ORIGINS)[number]

/**
 * Artikel opnemen in Eigen artikels: prijs per stuk + herkomst.
 * Herkenning op artikelnummer, of op naam als er geen nummer is. Geldt voor alle projecten.
 */
export function OwnArticleEditor({
  articleNo, description, supplier, price, origin = 'Bestellen', onSaved,
}: { articleNo: string | null; description: string; supplier: string | null; price?: number | null; origin?: Origin; onSaved: (msg: string) => void }) {
  const [p, setP] = useState(price ? String(price).replace('.', ',') : '')
  const [o, setO] = useState<Origin>(origin)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const v = p.trim().replace(',', '.')
    if (o !== 'Negeren' && (v === '' || isNaN(Number(v)))) return onSaved('Vul eerst een prijs per stuk in.')
    setBusy(true)
    const { error } = await supabase.rpc('set_manual_item', {
      p_article_no: articleNo ?? '', p_description: description, p_supplier: supplier, p_price: o === 'Negeren' ? 0 : Number(v), p_origin: o,
    })
    setBusy(false)
    onSaved(error ? 'Niet bewaard: ' + error.message
      : o === 'Negeren' ? `"${description}" wordt voortaan genegeerd.`
      : `"${description}" bewaard (${o.toLowerCase()}, € ${v.replace('.', ',')} per stuk). Geldt ook voor volgende projecten.`)
  }
  return (
    <span className="own-editor">
      <select value={o} onChange={(e) => setO(e.target.value as Origin)} title="Herkomst">
        {ORIGINS.map((x) => <option key={x}>{x}</option>)}
      </select>
      {o !== 'Negeren' && (
        <input className="price-input" inputMode="decimal" placeholder="€ per stuk" value={p}
          onChange={(e) => setP(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
      )}
      <button className="primary" disabled={busy} onClick={save}>Bewaren</button>
    </span>
  )
}
