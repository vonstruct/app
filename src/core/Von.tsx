import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

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
  mails: 'mails', relations: 'relaties', system_status: 'systemen',
}
const SUGGEST = ['Wat moet ik vandaag doen?', 'Wat staat er deze week gepland?', 'Welke opdrachten zijn nog niet bevestigd?', 'Zijn er mails niet aangekomen?']

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

export function Von() {
  const [open, setOpen] = useState(false)
  const [conv, setConv] = useState<string | null>(() => store.get(KEY_CONV))
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [voice, setVoice] = useState(() => store.get(KEY_VOICE) !== 'off')
  const [listening, setListening] = useState(false)
  const [history, setHistory] = useState<Conv[] | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<{ stop: () => void } | null>(null)

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

  const say = (t: string) => {
    if (!voice || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(speakable(t))
    u.lang = 'nl-BE'
    const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('nl-BE')) ?? speechSynthesis.getVoices().find((x) => x.lang?.startsWith('nl'))
    if (v) u.voice = v
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
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
    if (listening) { recRef.current?.stop(); return }
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
    r.onend = () => { setListening(false); recRef.current = null; if (finalText.trim()) send(finalText) }
    r.onerror = () => { setListening(false); recRef.current = null }
    recRef.current = r
    setListening(true)
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    r.start()
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
  const toggleVoice = () => { const v = !voice; setVoice(v); store.set(KEY_VOICE, v ? 'on' : 'off'); if (!v && 'speechSynthesis' in window) speechSynthesis.cancel() }

  return (
    <>
      {!open && (
        <button className="von-fab" onClick={() => setOpen(true)} aria-label="VON openen" title="VON">
          <img src="./v-icon-192.png" alt="" />
        </button>
      )}
      {open && (
        <section className="von" aria-label="VON">
          <header className="von-head">
            <img src="./v-icon-192.png" alt="" />
            <strong>VON</strong>
            <span className="muted small">alleen lezen</span>
            <span className="von-actions">
              <button className="link" onClick={toggleVoice} title={voice ? 'Voorlezen staat aan' : 'Voorlezen staat uit'}>{voice ? '🔊' : '🔇'}</button>
              <button className="link" onClick={showHistory} title="Vorige gesprekken">🕘</button>
              <button className="link" onClick={newConv} title="Nieuw gesprek">＋</button>
              <button className="link" onClick={() => { setOpen(false); if ('speechSynthesis' in window) speechSynthesis.cancel() }} aria-label="Sluiten">✕</button>
            </span>
          </header>
          {history ? (
            <div className="von-history">
              <p className="muted small">Vorige gesprekken</p>
              {history.length === 0 && <p className="muted">Nog geen gesprekken.</p>}
              <ul>
                {history.map((c) => (
                  <li key={c.id}>
                    <button className="link" onClick={() => pick(c.id)}>{c.title ?? 'Gesprek'}</button>
                    <span className="muted small"> {new Date(c.updated_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <button className="link von-del" onClick={() => remove(c.id)} title="Wissen">🗑</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="von-list" ref={listRef}>
              {msgs.length === 0 && (
                <div className="von-empty">
                  <p>Hallo Olivier. Waarmee kan ik helpen?</p>
                  <div className="von-suggest">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={'von-msg ' + m.role + (m.error ? ' err' : '')}>
                  {m.role === 'assistant' ? <Rich text={m.text} /> : <p>{m.text}</p>}
                  {m.tools && m.tools.length > 0 && <span className="von-meta">bekeken: {[...new Set(m.tools)].map((t) => TOOL_LABEL[t] ?? t).join(', ')}{m.cost != null ? ` · ${(m.cost * 100).toFixed(1)} ct` : ''}</span>}
                </div>
              ))}
              {busy && <div className="von-msg assistant"><span className="von-dots"><i /><i /><i /></span></div>}
            </div>
          )}
          <form className="von-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
            {Rec && <button type="button" className={'von-mic' + (listening ? ' on' : '')} onClick={listen} title={listening ? 'Stop' : 'Spreek'}>🎙</button>}
            <textarea rows={1} value={input} placeholder={listening ? 'Ik luister…' : 'Vraag iets aan VON…'} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }} />
            <button type="submit" className="primary" disabled={busy || !input.trim()}>➤</button>
          </form>
        </section>
      )}
    </>
  )
}
