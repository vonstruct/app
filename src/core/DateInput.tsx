import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from 'react'
import { dmy, parseDmy } from './dates'

/**
 * Datumvak in DD/MM/YYYY (6 nov 2026), in plaats van <input type="date"> (dat toont het formaat van de browser, vaak MM/DD/YYYY).
 * Zelfde gebruik als een gewoon invulvak: value/defaultValue en e.target.value in YYYY-MM-DD, onChange zodra de datum geldig is
 * (of leeg), onBlur bij het verlaten. Het kalenderknopje opent de kalender van het toestel.
 */
type Props = {
  value?: string | null
  defaultValue?: string | null
  onChange?(e: ChangeEvent<HTMLInputElement>): void
  onBlur?(e: FocusEvent<HTMLInputElement>): void
  className?: string
  title?: string
  disabled?: boolean
  placeholder?: string
  name?: string
  required?: boolean
  min?: string
  max?: string
}

const fake = <T,>(value: string, name?: string) => ({ target: { value, name: name ?? '' }, currentTarget: { value, name: name ?? '' } }) as unknown as T

export function DateInput({ value, defaultValue, onChange, onBlur, className, title, disabled, placeholder, name, required, min, max }: Props) {
  const controlled = value !== undefined
  const [text, setText] = useState(dmy(controlled ? value : defaultValue))
  const [iso, setIso] = useState<string>((controlled ? value : defaultValue) ?? '')
  const picker = useRef<HTMLInputElement>(null)
  // een nieuwe waarde van buiten tonen, maar niet terwijl je dezelfde datum aan het typen bent
  useEffect(() => { if (controlled) { setIso(value ?? ''); setText((t) => (parseDmy(t) === (value || null) || (!value && !t.trim()) ? t : dmy(value))) } }, [controlled, value])
  const bad = text.trim() !== '' && parseDmy(text) === null

  const emit = (v: string) => { setIso(v); onChange?.(fake<ChangeEvent<HTMLInputElement>>(v, name)) }
  const type = (raw: string) => {
    // gsm (cijferklavier zonder "/"): de schuine strepen komen er vanzelf bij tijdens het typen (07 → 07/, 07/11 → 07/11/)
    const t = raw.length > text.length && /^(\d{2}|\d{2}\/\d{2})$/.test(raw) ? raw + '/' : raw
    setText(t)
    if (t.trim() === '') return emit('')
    const v = parseDmy(t, false)
    if (v) emit(v)
  }
  const blur = () => {
    const v = text.trim() === '' ? '' : parseDmy(text)
    if (v !== null) { setText(dmy(v)); if (v !== iso) emit(v) }
    onBlur?.(fake<FocusEvent<HTMLInputElement>>(v ?? iso, name))
  }
  const fromPicker = (v: string) => {
    setText(dmy(v)); emit(v)
    onBlur?.(fake<FocusEvent<HTMLInputElement>>(v, name))
  }
  return (
    <span className={'date-in' + (bad ? ' bad' : '')}>
      <input type="text" inputMode="numeric" className={className} title={title ?? 'DD/MM/YYYY'} disabled={disabled} name={name} required={required}
        placeholder={placeholder ?? 'DD/MM/YYYY'} value={text} onChange={(e) => type(e.target.value)} onBlur={blur}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      <button type="button" className="date-in-cal" disabled={disabled} aria-label="Kalender" tabIndex={-1}
        onClick={() => { const p = picker.current; if (!p) return; p.value = iso; try { p.showPicker() } catch { p.focus(); p.click() } }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3v4M15.5 3v4" /></svg>
      </button>
      <input ref={picker} type="date" className="date-in-native" tabIndex={-1} aria-hidden="true" min={min} max={max} onChange={(e) => e.target.value && fromPicker(e.target.value)} />
    </span>
  )
}

/**
 * Datum + uur (DD/MM/YYYY en HH:MM, 24 u) in plaats van <input type="datetime-local">. value / e.target.value = 'YYYY-MM-DDTHH:MM'.
 */
export function DateTimeInput({ value, onChange, className, disabled }: { value: string; onChange?(e: ChangeEvent<HTMLInputElement>): void; className?: string; disabled?: boolean }) {
  const date = (value ?? '').slice(0, 10)
  const time = (value ?? '').slice(11, 16)
  const [t, setT] = useState(time)
  useEffect(() => { setT(time) }, [time])
  const emit = (d: string, hm: string) => onChange?.(fake<ChangeEvent<HTMLInputElement>>(d ? `${d}T${hm || '09:00'}` : '', undefined))
  const okTime = (s: string) => /^([01]?\d|2[0-3])[:.u]?([0-5]\d)$/.exec(s.trim())
  return (
    <span className="datetime-in">
      <DateInput value={date} disabled={disabled} className={className} onChange={(e) => emit(e.target.value, time)} />
      <input type="text" inputMode="numeric" className={'time-in' + (t && !okTime(t) ? ' bad' : '')} disabled={disabled} placeholder="HH:MM" value={t} aria-label="Uur"
        onChange={(e) => { setT(e.target.value); const m = okTime(e.target.value); if (m && date) emit(date, `${m[1].padStart(2, '0')}:${m[2]}`) }}
        onBlur={() => { const m = okTime(t); if (m) setT(`${m[1].padStart(2, '0')}:${m[2]}`) }} />
    </span>
  )
}
