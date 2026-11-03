import { useEffect, useState } from 'react'

/**
 * Nieuwe versie gepubliceerd? De app op het beginscherm (gsm) laadt niet vanzelf opnieuw, dus we kijken zelf na
 * (bij openen, bij terugkeren naar de app en elke 5 minuten) of index.html naar een ander bundelbestand verwijst.
 * Komt de app terug op het scherm en is er een nieuwe versie, dan ververst ze meteen; anders een knop "Vernieuwen".
 */
const current = () => (document.querySelector('script[type="module"][src*="assets/index-"]') as HTMLScriptElement | null)?.src.split('/').pop() ?? null

async function latest(): Promise<string | null> {
  try {
    const r = await fetch('./index.html?v=' + Date.now(), { cache: 'no-store' })
    const html = await r.text()
    return (html.match(/assets\/(index-[^"']+\.js)/) ?? [])[1] ?? null
  } catch { return null }
}

export function UpdateCheck() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const mine = current()
    if (!mine) return // ontwikkelmodus
    let stop = false
    const check = async (reloadNow: boolean) => {
      const l = await latest()
      if (stop || !l || l === mine) return
      if (reloadNow) window.location.reload()
      else setReady(true)
    }
    check(false)
    const onVis = () => { if (document.visibilityState === 'visible') check(true) }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(() => check(false), 5 * 60 * 1000)
    return () => { stop = true; document.removeEventListener('visibilitychange', onVis); clearInterval(t) }
  }, [])
  if (!ready) return null
  return (
    <div className="update-bar" role="status">
      Er is een nieuwe versie van de app.
      <button className="primary" onClick={() => window.location.reload()}>Vernieuwen</button>
    </div>
  )
}
