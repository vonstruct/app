import { useEffect, useState } from 'react'

/**
 * Nieuwe versie gepubliceerd? De app op het beginscherm (gsm) laadt niet vanzelf opnieuw, dus we kijken zelf na
 * (bij openen, bij terugkeren naar de app en elke 5 minuten) of index.html naar een ander bundelbestand verwijst.
 * Is er een nieuwe versie, dan verschijnt de knop "Vernieuwen". Nooit vanzelf herladen (7 nov 2026, doorlichting):
 * dat deed ingetypte tekst verdwijnen bij het terugkeren naar de app.
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
    const check = async () => {
      const l = await latest()
      if (stop || !l || l === mine) return
      setReady(true)
    }
    check()
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(() => check(), 5 * 60 * 1000)
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
