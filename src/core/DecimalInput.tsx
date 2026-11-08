import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { parseAmount } from './format'

const show = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','))

/**
 * Getalveld dat op de gsm komma én punt aanvaardt (geen type="number": dat weigert op sommige toestellen de komma).
 * Tekst blijft vrij tijdens het typen; bij verlaten (of Enter) wordt het getal bewaard via onCommit (leeg = null).
 */
export function DecimalInput({ value, onCommit, onBlur, onKeyDown, ...rest }: { value: number | null | undefined; onCommit: (v: number | null) => void }
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'>) {
  const [t, setT] = useState(show(value))
  useEffect(() => setT(show(value)), [value])
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={t}
      onChange={(e) => setT(e.target.value)}
      onBlur={(e) => {
        const n = parseAmount(t)
        if (n !== null && Number.isNaN(n)) setT(show(value))
        else if (n !== (value ?? null)) onCommit(n)
        onBlur?.(e)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); onKeyDown?.(e) }}
    />
  )
}
