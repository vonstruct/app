import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { VonSiri } from './VonSiri'

/**
 * VON: persoonlijke assistent van de beheerder (fase 1: enkel lezen en antwoorden).
 * Knop rechtsonder → venster met gesprek, typen of spreken (microfoon), antwoord hardop (luidspreker aan/uit).
 * Backend: Edge Function `von` (bron: vonstruct/platform supabase/functions/von). Gesprekken in von_conversations/von_messages.
 */
type Msg = { role: 'user' | 'assistant'; text: string; tools?: string[]; cost?: number; error?: boolean }
type Conv = { id: string; title: string | null; updated_at: string }

const KEY_CONV = 'von.conversation'
const KEY_VOICE = 'von.voice'
const store = { get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* geen opslag */ } } }

const TOOL_LABEL: Record<string, string> = {
  control_tower: 'control tower', projects: 'projecten', project_detail: 'project', jobs: 'opdrachten', agenda: 'agenda',
  mails: 'verzonden mails', relations: 'relaties', system_status: 'systemen', inbox: 'mailbox', mail_thread: 'mailgesprek', recent_events: 'recent', list_tasks: 'taken', add_task: 'taak gemaakt', complete_task: 'taak afgevinkt', rules: 'rekenregels',
}
const SUGGEST = ['Wat moet ik vandaag doen?', 'Welke mails wachten op een antwoord?', 'Wat staat er deze week gepland?', 'Welke opdrachten zijn nog niet bevestigd?']

/** Eenvoudige opmaak: **vet**, opsommingen (- of •) en genummerde lijnen. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>)
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  const flush = () => { if (list.length) { out.push(<ul key={'u' + out.length}>{list}</ul>); list = [] } }
  text.split('\n').forEach((l, i) => {
    const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/)
    if (m) { list.push(<li key={i}>{inline(m[1])}</li>); return }
    flush()
    if (l.trim()) out.push(<p key={i}>{inline(l.replace(/^#+\s*/, ''))}</p>)
  })
  flush()
  return <>{out}</>
}

const speakable = (t: string) => t.replace(/\*\*/g, '').replace(/^\s*[-•*]\s+/gm, '').replace(/€\s?/g, ' euro ')

const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)) }
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Meldingen van VON aanzetten op dit toestel (Web Push). Op de iPhone enkel in de app op het beginscherm. */
async function enablePush(): Promise<string> {
  if (!pushSupported()) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    return ios ? 'Op de iPhone werken meldingen alleen in de app op je beginscherm (Deel → Zet op beginscherm). Open VON daar en zet meldingen aan via het menu (…).' : 'Deze browser ondersteunt geen meldingen.'
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Meldingen zijn niet toegestaan. Zet ze aan in de instellingen van je browser of gsm.'
  const reg = await navigator.serviceWorker.register('./sw.js')
  await navigator.serviceWorker.ready
  const { data } = await supabase.functions.invoke('push', { body: { action: 'public_key' } })
  const key = (data as { key?: string } | null)?.key
  if (!key) return 'De sleutel voor meldingen kon niet opgehaald worden.'
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }))
  const device = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : /Mac/.test(navigator.userAgent) ? 'Mac' : /Windows/.test(navigator.userAgent) ? 'Windows-pc' : 'toestel'
  const r = await supabase.functions.invoke('push', { body: { action: 'subscribe', subscription: sub.toJSON(), device } })
  if (r.error) return 'Registreren mislukt.'
  await supabase.functions.invoke('push', { body: { action: 'test' } })
  return 'Meldingen staan aan op dit toestel. Je krijgt zo een proefmelding.'
}

export function Von({ embedded = false }: { embedded?: boolean } = {}) {
  const [open, setOpen] = useState(embedded)
  // openen vanuit de kopbalk (knop VON) of elders: window.dispatchEvent(new Event('von-open'))
  useEffect(() => { const o = () => setOpen(true); window.addEventListener('von-open', o); return () => window.removeEventListener('von-open', o) }, [])
  const [conv, setConv] = useState<string | null>(() => store.get(KEY_CONV))
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [voice, setVoice] = useState(() => store.get(KEY_VOICE) !== 'off')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [history, setHistory] = useState<Conv[] | null>(null)
  const [siri, setSiri] = useState(false)
  const [pushOn, setPushOn] = useState(() => pushSupported() && Notification.permission === 'granted')
  const listRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<{ stop: () => void; abort?: () => void } | null>(null)
  const recTimer = useRef<number | undefined>(undefined)

  const Rec = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition

  const loadConv = useCallback(async (id: string | null) => {
    if (!id) { setMsgs([]); return }
    const { data } = await supabase.from('von_messages').select('role,text').eq('conversation_id', id).not('text', 'is', null).order('id')
    if (!data?.length) { setConv(null); store.set(KEY_CONV, null); setMsgs([]); return }
    setMsgs(data.map((m) => ({ role: m.role as Msg['role'], text: m.text as string })))
  }, [])

  useEffect(() => { if (open) loadConv(conv) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs, busy])

  const hush = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); setSpeaking(false) }
  // iPhone/Safari: geluid mag pas na een tik van de gebruiker. Bij de eerste tik "ontgrendelen" we het voorlezen.
  const unlocked = useRef(false)
  const unlock = () => {
    if (unlocked.current || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
    unlocked.current = true
  }
  const say = (t: string) => {
    if (!voice || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    speechSynthesis.resume()
    const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('nl-BE')) ?? speechSynthesis.getVoices().find((x) => x.lang?.startsWith('nl'))
    // in korte zinnen: lange teksten lopen in sommige browsers vast en zijn dan niet te stoppen
    const parts = speakable(t).split(/(?<=[.!?:])\s+|\n+/).map((x) => x.trim()).filter(Boolean)
    setSpeaking(parts.length > 0)
    // kleine pauze na cancel(): anders slikt Chrome de nieuwe tekst soms in
    setTimeout(() => parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part)
      u.lang = v?.lang ?? 'nl-BE'
      if (v) u.voice = v
      u.volume = 1
      if (i === parts.length - 1) { u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false) }
      speechSynthesis.speak(u)
    }), 80)
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    hush()
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('von', { body: { message: q, conversation_id: conv } })
    setBusy(false)
    const d = data as { conversation_id?: string; answer?: string; tools?: string[]; cost_usd?: number; error?: string | boolean } | null
    if (error || !d?.answer) {
      const t = typeof d?.error === 'string' ? d.error : 'VON is niet bereikbaar. Probeer het zo meteen opnieuw.'
      setMsgs((m) => [...m, { role: 'assistant', text: t, error: true }])
      return
    }
    if (d.conversation_id) { setConv(d.conversation_id); store.set(KEY_CONV, d.conversation_id) }
    setMsgs((m) => [...m, { role: 'assistant', text: d.answer!, tools: d.tools, cost: d.cost_usd, error: !!d.error }])
    say(d.answer)
  }

  const listen = () => {
    if (!Rec) return
    if (listening) { stopListening(); return }
    hush()
    const r = new Rec()
    r.lang = 'nl-BE'
    r.interimResults = true
    r.continuous = false
    let finalText = ''
    r.onresult = (e: any) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      finalText = t
      setInput(t)
    }
    let done = false
    const finish = () => { if (done) return; done = true; clearTimeout(recTimer.current); setListening(false); recRef.current = null; if (finalText.trim()) send(finalText) }
    r.onend = finish
    r.onerror = finish
    recRef.current = r
    setListening(true)
    recTimer.current = window.setTimeout(() => { try { r.stop() } catch { /* al gestopt */ } setTimeout(finish, 800) }, 20000)
    r.start()
  }
  const stopListening = () => {
    clearTimeout(recTimer.current)
    try { recRef.current?.stop() } catch { /* al gestopt */ }
    try { recRef.current?.abort?.() } catch { /* al gestopt */ }
    recRef.current = null
    setListening(false)
  }

  const newConv = () => { setConv(null); store.set(KEY_CONV, null); setMsgs([]); setHistory(null) }
  const showHistory = async () => {
    if (history) { setHistory(null); return }
    const { data } = await supabase.from('von_conversations').select('id,title,updated_at').order('updated_at', { ascending: false }).limit(30)
    setHistory((data as Conv[]) ?? [])
  }
  const pick = (id: string) => { setConv(id); store.set(KEY_CONV, id); setHistory(null); loadConv(id) }
  const remove = async (id: string) => {
    if (!confirm('Dit gesprek definitief wissen?')) return
    await supabase.from('von_conversations').delete().eq('id', id)
    setHistory((h) => h?.filter((c) => c.id !== id) ?? null)
    if (id === conv) newConv()
  }
  const toggleVoice = () => {
    const v = !voice; setVoice(v); store.set(KEY_VOICE, v ? 'on' : 'off')
    if (!v) { hush(); return }
    unlock()
    const u = new SpeechSynthesisUtterance('Voorlezen staat aan.'); u.lang = 'nl-BE'; speechSynthesis.cancel(); setTimeout(() => speechSynthesis.speak(u), 80)
  }

  const [more, setMore] = useState(false)
  const hourNow = new Date().getHours()
  const greet = hourNow < 12 ? 'Goedemorgen' : hourNow < 18 ? 'Goedemiddag' : 'Goedenavond'
  const toolsText = (t: string[]) => [...new Set(t.map((x) => x.startsWith('propose_') ? 'voorstel gemaakt' : TOOL_LABEL[x] ?? x.replace(/_/g, ' ')))].join(' · ')

  return (
    <>
      {!open && !embedded && (
        <button className="von-fab" onClick={() => setOpen(true)} aria-label="VON openen" title="VON">
          <img src="./v-icon-192.png" alt="" />
        </button>
      )}
      {open && (
        <section className={embedded ? 'von von2 von-embedded' : 'von von2'} aria-label="VON" onPointerDown={unlock} onKeyDown={unlock}>
          <header className="v2-head">
            <span className="v2-mark">V</span>
            <span className="v2-title"><b>VON</b><small>{busy ? 'denkt na…' : listening ? 'luistert…' : speaking ? 'spreekt…' : 'stelt voor · jij keurt goed'}</small></span>
            <span className="v2-tools">
              <button className="v2-ib" onClick={() => { setSiri(false); history ? setHistory(null) : showHistory() }} title="Vorige gesprekken" aria-pressed={!!history}><Ico d={I.clock} /></button>
              <button className="v2-ib" onClick={newConv} title="Nieuw gesprek"><Ico d={I.plus} /></button>
              <span className="v2-more">
                <button className="v2-ib" onClick={() => setMore((x) => !x)} title="Meer" aria-expanded={more}><Ico d={I.dots} /></button>
                {more && (
                  <span className="v2-menu" onMouseLeave={() => setMore(false)}>
                    <button onClick={() => { toggleVoice(); setMore(false) }}><Ico d={voice ? I.speaker : I.mute} />{voice ? 'Voorlezen staat aan' : 'Voorlezen staat uit'}</button>
                    <button onClick={async () => { setMore(false); const m = await enablePush(); setPushOn(pushSupported() && Notification.permission === 'granted'); setMsgs((x) => [...x, { role: 'assistant', text: m }]) }}><Ico d={I.bell} />{pushOn ? 'Meldingen staan aan (proefmelding)' : 'Meldingen aanzetten'}</button>
                    <button onClick={() => { setMore(false); setHistory(null); setSiri((x) => !x) }}><Ico d={I.phone} />VON via Siri</button>
                  </span>
                )}
              </span>
              {!embedded && <a className="v2-ib" href="#/von" title="Open de VON-pagina" onClick={() => setOpen(false)}><Ico d={I.expand} /></a>}
              {!embedded && <button className="v2-ib" onClick={() => { setOpen(false); hush(); stopListening() }} aria-label="Sluiten" title="Sluiten"><Ico d={I.close} /></button>}
            </span>
          </header>

          {siri ? <div className="von-history"><VonSiri /></div> : history ? (
            <div className="von-history v2-history">
              <div className="v2-label">Vorige gesprekken</div>
              {history.length === 0 && <p className="muted">Nog geen gesprekken.</p>}
              <ul>
                {history.map((c) => (
                  <li key={c.id}>
                    <button className="v2-hist" onClick={() => pick(c.id)}>
                      <span>{c.title ?? 'Gesprek'}</span>
                      <small>{new Date(c.updated_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                    </button>
                    <button className="v2-ib small" onClick={() => remove(c.id)} title="Gesprek wissen"><Ico d={I.trash} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="von-list v2-list" ref={listRef}>
              {msgs.length === 0 && (
                <div className="v2-empty">
                  <h2>{greet}, Olivier</h2>
                  <p>Vraag iets, of tik op de microfoon en spreek.</p>
                  <div className="v2-suggest">{SUGGEST.map((q) => <button key={q} onClick={() => send(q)}><span>{q}</span><Ico d={I.arrow} /></button>)}</div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={'v2-msg ' + m.role + (m.error ? ' err' : '')}>
                  {m.role === 'assistant' && <span className="v2-who">VON</span>}
                  <div className="v2-text">{m.role === 'assistant' ? <Rich text={m.text} /> : <p>{m.text}</p>}</div>
                  {m.tools && m.tools.length > 0 && <span className="v2-meta">{toolsText(m.tools)}{m.cost != null ? ` · ${(m.cost * 100).toFixed(1)} ct` : ''}</span>}
                </div>
              ))}
              {busy && <div className="v2-msg assistant"><span className="v2-who">VON</span><span className="von-dots"><i /><i /><i /></span></div>}
            </div>
          )}

          {speaking && <div className="v2-speaking"><span className="v2-wave small" aria-hidden="true"><i /><i /><i /><i /><i /></span>VON spreekt<button onClick={hush}>Stoppen</button></div>}
          <form className="v2-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
            {listening ? (
              <div className="v2-listen"><span className="v2-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span><span>Ik luister…</span></div>
            ) : (
              <div className="v2-field">
                <textarea rows={1} value={input} placeholder="Vraag VON…" onChange={(e) => { setInput(e.target.value); if (speaking) hush() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }} />
                <button type="submit" className="v2-send" disabled={busy || !input.trim()} aria-label="Versturen"><Ico d={I.up} /></button>
              </div>
            )}
            {Rec && <button type="button" className={'v2-mic' + (listening ? ' on' : '')} onClick={listen} aria-label={listening ? 'Stop met luisteren' : 'Spreek'} title={listening ? 'Stop' : 'Spreek'}><Ico d={listening ? I.stop : I.mic} /></button>}
          </form>
        </section>
      )}
    </>
  )
}

const I = {
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  dots: 'M4 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M17 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  expand: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  close: 'M6 6l12 12M18 6 6 18',
  speaker: 'M4 9.5v5h3.5L12 18V6L7.5 9.5zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5v5h3.5L12 18V6L7.5 9.5zM16.5 9.5l5 5M21.5 9.5l-5 5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  stop: 'M7 7h10v10H7z',
}
const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
