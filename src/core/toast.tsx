import { useEffect, useState } from 'react'

/** Korte melding onderaan ("✓ Bewaard"). Overal te gebruiken: toast('Bewaard'). De host staat in Layout. */
export const toast = (text: string, kind: 'ok' | 'err' = 'ok') => window.dispatchEvent(new CustomEvent('app-toast', { detail: { text, kind } }))

export function ToastHost() {
  const [t, setT] = useState<{ text: string; kind: string; n: number } | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail
      setT({ ...d, n: Date.now() })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setT(null), 2600)
    }
    window.addEventListener('app-toast', on)
    return () => { window.removeEventListener('app-toast', on); window.clearTimeout(timer) }
  }, [])
  return t ? <div key={t.n} className={'vd-toast' + (t.kind === 'err' ? ' err' : '')} role="status">{t.kind === 'err' ? '⚠ ' : '✓ '}{t.text}</div> : null
}
