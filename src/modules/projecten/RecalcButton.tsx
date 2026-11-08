import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../core/supabase'

type St = { optimizer_status: string | null; cost_status: string | null; cost_at: string | null }
const busy = (s: St | null) => !!s && (s.optimizer_status === 'wacht' || s.optimizer_status === 'bezig' || (s.cost_status == null && !String(s.optimizer_status ?? '').startsWith('fout')))

/**
 * Knop "Herberekenen": plaatoptimalisatie + kosten opnieuw (Edge Function recalc → GitHub).
 * Toont de status en ververst de tabbladen (onDone) zodra de berekening klaar is.
 */
export function RecalcButton({ dvId, onDone }: { dvId: string; onDone: () => void }) {
  const [st, setSt] = useState<St | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [started, setStarted] = useState<number | null>(null)
  const wasBusy = useRef(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('design_versions').select('optimizer_status, cost_status, cost_at').eq('id', dvId).single()
    setSt(data as St)
    return data as St
  }, [dvId])

  useEffect(() => { load() }, [load])
  // ook gestart vanuit een ander onderdeel (bv. een andere keuze bij Platen)
  useEffect(() => {
    const on = () => { setStarted(Date.now()); load() }
    window.addEventListener('vonstruct:recalc', on)
    return () => window.removeEventListener('vonstruct:recalc', on)
  }, [load])

  useEffect(() => {
    if (!busy(st)) {
      if (wasBusy.current) { wasBusy.current = false; setStarted(null); onDone() }
      return
    }
    wasBusy.current = true
    const t = setTimeout(load, 4000)
    return () => clearTimeout(t)
  }, [st, load, onDone])

  const start = async () => {
    if (!confirm('Platen en kosten opnieuw berekenen met de huidige prijzen en regels? Dit duurt ongeveer een minuut.')) return
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('recalc', { body: { design_version_id: dvId } })
    const err = (data as { error?: string } | null)?.error ?? (error ? 'De herberekening kon niet gestart worden.' : null)
    if (err) { setMsg(err); return }
    setStarted(Date.now())
    await load()
  }

  const running = busy(st)
  const secs = started ? Math.round((Date.now() - started) / 1000) : null
  const fail = [st?.optimizer_status, st?.cost_status].find((s) => String(s ?? '').startsWith('fout'))
  return (
    <div className="recalc">
      <button onClick={start} disabled={running}>{running ? 'Bezig met herberekenen…' : '↻ Herberekenen'}</button>
      <span className="muted small">
        {running
          ? st?.optimizer_status === 'wacht' ? 'In de wachtrij bij GitHub…' : st?.optimizer_status === 'bezig' ? 'Platen optimaliseren…' : 'Kosten berekenen…'
          : fail ? <span className="bad-text">Mislukt: {fail}</span>
          : st?.cost_at ? `Laatst berekend ${new Date(st.cost_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
        {running && secs != null && secs > 5 ? ` (${secs} s)` : ''}
      </span>
      {msg && <span className="bad-text small">{msg}</span>}
    </div>
  )
}
