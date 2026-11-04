import { useRef, useState } from 'react'

/**
 * Inspreken via de browser (Web Speech API, nl-BE): werkt in Chrome en Edge op de computer en Android; Safari deels.
 * start(onText) geeft de herkende tekst (ook tussentijds) door; stopt vanzelf na een pauze.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any
export function useDictation(lang = 'nl-BE') {
  const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
  const [listening, setListening] = useState(false)
  const rec = useRef<Rec | null>(null)
  const start = (onText: (text: string, final: boolean) => void, onError?: (msg: string) => void) => {
    if (!Ctor) return onError?.('Inspreken werkt niet in deze browser (gebruik Chrome of Edge).')
    if (rec.current) { rec.current.stop(); return }
    const r = new Ctor()
    r.lang = lang; r.interimResults = true; r.continuous = false
    r.onresult = (e: Rec) => {
      let text = ''; let final = false
      for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true }
      onText(text.trim(), final)
    }
    r.onerror = (e: Rec) => { if (e.error === 'not-allowed') onError?.('Geef de browser toegang tot de microfoon.'); else if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.('Inspreken mislukt: ' + e.error) }
    r.onend = () => { rec.current = null; setListening(false) }
    rec.current = r; setListening(true); r.start()
  }
  return { supported: !!Ctor, listening, start, stop: () => rec.current?.stop() }
}

/** Eenvoudige datum uit een ingesproken taak: "morgen", "overmorgen", "volgende week", "tegen vrijdag", "op 12 december". */
const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
export function dueFromText(text: string): { text: string; due: string | null } {
  const t = text.toLowerCase()
  const now = new Date(); now.setHours(12, 0, 0, 0)
  const iso = (d: Date) => d.toLocaleDateString('sv-SE')
  const add = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return d }
  const strip = (re: RegExp) => text.replace(re, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim()
  if ((t.match(/\b(tegen |voor |op )?overmorgen\b/))) return { text: strip(/\b(tegen |voor |op )?overmorgen\b/i), due: iso(add(2)) }
  if ((t.match(/\b(tegen |voor |op )?morgen\b/))) return { text: strip(/\b(tegen |voor |op )?morgen\b/i), due: iso(add(1)) }
  if ((t.match(/\b(tegen |voor |op )?vandaag\b/))) return { text: strip(/\b(tegen |voor |op )?vandaag\b/i), due: iso(now) }
  if ((t.match(/\b(tegen |voor )?volgende week\b/))) return { text: strip(/\b(tegen |voor )?volgende week\b/i), due: iso(add(7)) }
  const dm = t.match(new RegExp(`\\b(tegen |voor |op )?(\\d{1,2}) (${MONTHS.join('|')})\\b`))
  if (dm) {
    const d = new Date(now.getFullYear(), MONTHS.indexOf(dm[3]), Number(dm[2]), 12)
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    return { text: strip(new RegExp(`\\b(tegen |voor |op )?${dm[2]} ${dm[3]}\\b`, 'i')), due: iso(d) }
  }
  const wd = t.match(new RegExp(`\\b(tegen |voor |op |volgende )?(${DAYS.join('|')})\\b`))
  if (wd) {
    let n = (DAYS.indexOf(wd[2]) - now.getDay() + 7) % 7 || 7
    if (wd[1]?.trim() === 'volgende' && n < 7) n += 7
    return { text: strip(new RegExp(`\\b(tegen |voor |op |volgende )?${wd[2]}\\b`, 'i')), due: iso(add(n)) }
  }
  return { text, due: null }
}
