import { useEffect, useRef, useState } from 'react'

/** Handtekening met vinger, pen of muis. onChange geeft een PNG (data-URL) of null als het vak leeg is. */
export function SignaturePad({ onChange, clearLabel = 'Wissen', hint = 'Teken hier je handtekening' }: { onChange: (png: string | null) => void; clearLabel?: string; hint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const points = useRef(0)
  const [empty, setEmpty] = useState(true)
  useEffect(() => {
    const c = ref.current!
    const fit = () => {
      const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
      c.width = r.width * dpr; c.height = r.height * dpr
      const ctx = c.getContext('2d')!
      ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0d1626'
    }
    fit()
    const ro = new ResizeObserver(() => { if (points.current === 0) fit() })
    ro.observe(c)
    return () => ro.disconnect()
  }, [])
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = (e: React.PointerEvent) => {
    e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); drawing.current = true
    const ctx = ref.current!.getContext('2d')!, [x, y] = pos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = ref.current!.getContext('2d')!, [x, y] = pos(e)
    ctx.lineTo(x, y); ctx.stroke(); points.current++
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    const ok = points.current > 15
    setEmpty(!ok)
    onChange(ok ? ref.current!.toDataURL('image/png') : null)
  }
  const clear = () => {
    const c = ref.current!, ctx = c.getContext('2d')!
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore()
    points.current = 0; setEmpty(true); onChange(null)
  }
  return (
    <div className="sigpad">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      {empty && <span className="sigpad-hint">{hint}</span>}
      <button type="button" className="sigpad-clear" onClick={clear}>{clearLabel}</button>
    </div>
  )
}
