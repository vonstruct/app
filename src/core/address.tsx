import { useEffect, useState } from 'react'

/**
 * Adressen: altijd als "Straat huisnummer, postcode gemeente" (bv. "Kerkstraat 1, 2440 Geel"),
 * met ", land" erachter enkel buiten België. Zo werken de route-links van Google Maps en Waze betrouwbaar.
 */
export type Addr = { street: string; postal: string; city: string; country: string }
export const joinAddress = (a: Addr) =>
  [a.street.trim(), [a.postal.trim(), a.city.trim()].filter(Boolean).join(' '), a.country.trim() && !/^(be|belgi[eë]|belgique)$/i.test(a.country.trim()) ? a.country.trim() : '']
    .filter(Boolean).join(', ')
export const splitAddress = (s: string | null | undefined): Addr => {
  const parts = (s ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const street = parts[0] ?? ''
  const m = (parts[1] ?? '').match(/^(\S*\d\S*)\s+(.+)$/)
  return { street, postal: m ? m[1] : '', city: m ? m[2] : parts[1] ?? '', country: parts[2] ?? '' }
}
export const mapsUrl = (a: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`
export const wazeUrl = (a: string) => `https://waze.com/ul?q=${encodeURIComponent(a)}&navigate=yes`

/** Twee route-knoppen: Google Maps en Waze. */
export function RouteLinks({ address, className = '' }: { address: string | null | undefined; className?: string }) {
  if (!address) return null
  return (
    <span className={'route-links ' + className}>
      <a href={mapsUrl(address)} target="_blank" rel="noreferrer">Google Maps</a>
      <a href={wazeUrl(address)} target="_blank" rel="noreferrer">Waze</a>
    </span>
  )
}

/** Adresvelden met controle via OpenStreetMap: vindt de kaart het adres, dan werkt de route. */
export function AddressFields({ value, onChange }: { value: string | null; onChange: (s: string | null) => void }) {
  const [a, setA] = useState<Addr>(() => splitAddress(value))
  const [check, setCheck] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { const cur = joinAddress(a); if ((value ?? '') !== cur) { setA(splitAddress(value)); setCheck(null) } }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Addr>) => { const n = { ...a, ...p }; setA(n); setCheck(null); onChange(joinAddress(n) || null) }
  const full = joinAddress(a)
  const verify = async () => {
    if (!a.street || !a.city) return setCheck({ ok: false, text: 'Vul minstens straat met huisnummer en gemeente in.' })
    if (!/\d/.test(a.street)) setCheck({ ok: false, text: 'Er staat geen huisnummer bij de straat.' })
    try {
      const q = new URLSearchParams({ format: 'json', limit: '1', addressdetails: '1', street: a.street, city: a.city, postalcode: a.postal, country: a.country || 'België' })
      const r = await fetch('https://nominatim.openstreetmap.org/search?' + q.toString(), { headers: { 'Accept-Language': 'nl' } })
      const j = (await r.json()) as { display_name: string; address?: { house_number?: string } }[]
      if (!j.length) return setCheck({ ok: false, text: 'Niet gevonden op de kaart. Controleer straatnaam, huisnummer en postcode.' })
      setCheck({ ok: true, text: (j[0].address?.house_number ? 'Gevonden: ' : 'Straat gevonden (huisnummer niet op de kaart): ') + j[0].display_name })
    } catch {
      setCheck({ ok: false, text: 'Controle lukte niet (geen verbinding). Test de route-link.' })
    }
  }
  return (
    <div className="addr wide">
      <div className="addr-grid">
        <label className="addr-street">Straat en huisnummer<input value={a.street} onChange={(e) => set({ street: e.target.value })} placeholder="Kerkstraat 1" /></label>
        <label>Postcode<input value={a.postal} onChange={(e) => set({ postal: e.target.value })} placeholder="2440" inputMode="numeric" /></label>
        <label>Gemeente<input value={a.city} onChange={(e) => set({ city: e.target.value })} placeholder="Geel" /></label>
        <label>Land<input value={a.country} onChange={(e) => set({ country: e.target.value })} placeholder="België" /></label>
      </div>
      <div className="addr-foot">
        <button type="button" className="link" onClick={verify}>Adres controleren</button>
        {full && <RouteLinks address={full} />}
        {check && <span className={check.ok ? 'addr-ok' : 'addr-bad'}>{check.ok ? '✓ ' : '⚠ '}{check.text}</span>}
      </div>
    </div>
  )
}
