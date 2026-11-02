import { useEffect, useState } from 'react'
import { storedLang } from '../portal/i18n'

// Vraagt op de gsm om de app op het beginscherm te zetten.
// Android (Chrome): echte installatieknop via beforeinstallprompt. iPhone/iPad: Apple laat dat niet toe → korte uitleg met de Deel-knop.
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const T = {
  nl: { title: 'Zet Vonstruct op je beginscherm', and: 'Eén tik en je bent er, als een gewone app.', install: 'Installeren', later: 'Later', ios1: 'Tik onderaan op', ios2: 'Deel', ios3: 'en kies', ios4: 'Zet op beginscherm' },
  en: { title: 'Add Vonstruct to your home screen', and: 'One tap and you’re in, like a regular app.', install: 'Install', later: 'Later', ios1: 'Tap', ios2: 'Share', ios3: 'and choose', ios4: 'Add to Home Screen' },
  de: { title: 'Vonstruct zum Home-Bildschirm hinzufügen', and: 'Ein Tipp und Sie sind drin – wie eine normale App.', install: 'Installieren', later: 'Später', ios1: 'Tippen Sie auf', ios2: 'Teilen', ios3: 'und wählen Sie', ios4: 'Zum Home-Bildschirm' },
}
const KEY = 'vonstruct.installLater'
const DAYS = 14

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
const mobile = () => window.matchMedia('(pointer: coarse)').matches
const snoozed = () => { try { const v = Number(localStorage.getItem(KEY)); return v > 0 && Date.now() - v < DAYS * 86400000 } catch { return false } }

const ShareIcon = () => (
  <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
    <path d="M8 1v12M4 5l4-4 4 4M3 8H1.5v10.5h13V8H13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function InstallPrompt() {
  const [bip, setBip] = useState<BIP | null>(null)
  const [show, setShow] = useState<'android' | 'ios' | null>(null)
  const t = T[storedLang()]

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
    if (standalone() || !mobile() || snoozed() || location.hash.startsWith('#/actie')) return
    const onBip = (e: Event) => { e.preventDefault(); setBip(e as BIP); setShow('android') }
    window.addEventListener('beforeinstallprompt', onBip)
    let timer: number | undefined
    if (isIos()) timer = window.setTimeout(() => setShow('ios'), 1500)
    const onInstalled = () => setShow(null)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); clearTimeout(timer) }
  }, [])

  if (!show) return null
  const later = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* geen opslag */ } setShow(null) }
  const install = async () => { if (!bip) return; await bip.prompt(); await bip.userChoice.catch(() => null); setBip(null); setShow(null) }

  return (
    <div className="install-prompt" role="dialog" aria-label={t.title}>
      <img src="./v-icon-192.png" alt="" />
      <div className="install-text">
        <strong>{t.title}</strong>
        {show === 'android' ? <span>{t.and}</span>
          : <span>{t.ios1} <b className="install-share"><ShareIcon /> {t.ios2}</b> {t.ios3} <b>“{t.ios4}”</b>.</span>}
        <div className="install-actions">
          {show === 'android' && <button className="install-go" onClick={install}>{t.install}</button>}
          <button className="install-later" onClick={later}>{t.later}</button>
        </div>
      </div>
      {show === 'ios' && <span className="install-arrow" aria-hidden="true">▼</span>}
    </div>
  )
}
