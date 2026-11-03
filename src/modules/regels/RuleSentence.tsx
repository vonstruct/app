import { useState } from 'react'
import { supabase } from '../../core/supabase'

export type Field = {
  type: 'number' | 'money' | 'percent' | 'text' | 'select' | 'bool' | 'list_number' | 'list_text' | 'map'
  unit?: string
  options?: string[]
  key_label?: string
  value_label?: string
}
export type Rule = { key: string; section: string; sort: number; sentence: string; explanation: string | null; fields: Record<string, Field>; value: Record<string, unknown>; updated_at: string }

/** Eén regel als zin met invulvelden. Wijzigen = meteen bewaren in Supabase. */
export function RuleSentence({ rule }: { rule: Rule }) {
  const [value, setValue] = useState<Record<string, unknown>>(rule.value)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)

  const setField = async (name: string, v: unknown) => {
    const next = { ...value, [name]: v }
    setValue(next)
    const { error } = await supabase.from('rule_settings').update({ value: next }).eq('key', rule.key)
    setState(error ? 'error' : 'saved')
    setErr(error ? error.message : null)
  }

  // zin opsplitsen in tekst en {velden}
  const parts = rule.sentence.split(/(\{[a-z_0-9]+\})/g)
  const maps = Object.entries(rule.fields).filter(([, f]) => f.type === 'map')
  // lange teksten (bv. standaardteksten van de offerte) als blokken onder de zin
  const texts = Object.entries(rule.fields).filter(([, f]) => (f.type as string) === 'textarea')
  const LABELS: Record<string, string> = { inleiding: 'Inleiding', inbegrepen: 'Inbegrepen (één per regel)', niet_inbegrepen: 'Niet inbegrepen (één per regel)', planning: 'Planning', betaling: 'Betaling', garantie: 'Garantie', btw6: 'Uitleg 6 % btw' }
  return (
    <div className="card rule">
      <p className="sentence">
        {parts.map((p, i) => {
          const m = p.match(/^\{([a-z_0-9]+)\}$/)
          if (!m) return <span key={i}>{p}</span>
          const name = m[1]
          const f = rule.fields[name]
          if (!f) return <span key={i}>{p}</span>
          if (f.type === 'map') return <span key={i} />
          return <FieldInput key={i} field={f} value={value[name]} onChange={(v) => setField(name, v)} />
        })}
      </p>
      {texts.map(([name]) => (
        <label key={name} className="rule-text">
          <span>{LABELS[name] ?? name}</span>
          <textarea rows={Math.max(2, String(value[name] ?? '').split('\n').length + 1)} defaultValue={String(value[name] ?? '')} onBlur={(e) => e.target.value !== String(value[name] ?? '') && setField(name, e.target.value)} />
        </label>
      ))}
      {maps.map(([name, f]) => (
        <MapEditor key={name} field={f} value={(value[name] as Record<string, string>) ?? {}} onChange={(v) => setField(name, v)} />
      ))}
      <div className="rule-foot">
        {rule.explanation && <span className="muted">{rule.explanation}</span>}
        {state === 'saved' && <span className="ok">Bewaard</span>}
        {state === 'error' && <span className="error">{err}</span>}
      </div>
    </div>
  )
}

const fmt = (n: unknown) => (n == null ? '' : String(n).replace('.', ','))
const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(
    field.type === 'list_number' || field.type === 'list_text' ? ((value as unknown[]) ?? []).map(fmt).join(', ') : fmt(value),
  )
  const commitScalar = () => {
    if (field.type === 'text') return text !== value && onChange(text)
    const n = parseNum(text)
    if (n === null) return setText(fmt(value))
    if (n !== value) onChange(n)
  }
  const commitList = () => {
    const items = text.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
    if (field.type === 'list_number') {
      const nums = items.map((s) => parseNum(s))
      if (nums.some((n) => n === null)) return setText(((value as unknown[]) ?? []).map(fmt).join(', '))
      onChange((nums as number[]).sort((a, b) => a - b))
    } else onChange(items)
  }
  const unit = field.type === 'money' ? '€' : field.type === 'percent' ? '%' : field.unit

  if (field.type === 'bool')
    return (
      <select className="inline" value={value ? 'ja' : 'nee'} onChange={(e) => onChange(e.target.value === 'ja')}>
        <option value="ja">ja</option>
        <option value="nee">nee</option>
      </select>
    )
  if (field.type === 'select')
    return (
      <select className="inline" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  const isList = field.type === 'list_number' || field.type === 'list_text'
  const isNum = ['number', 'money', 'percent'].includes(field.type)
  return (
    <span className="inline-field">
      {field.type === 'money' && <span className="unit">€</span>}
      <input
        className={isList ? 'inline wide' : isNum ? 'inline num' : 'inline'}
        value={text}
        inputMode={isNum ? 'decimal' : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={isList ? commitList : commitScalar}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        title={isList ? 'Gescheiden door komma’s' : undefined}
      />
      {unit && field.type !== 'money' && <span className="unit">{unit}</span>}
    </span>
  )
}

function MapEditor({ field, value, onChange }: { field: Field; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'nl', { numeric: true }))
  const [nk, setNk] = useState('')
  const [nv, setNv] = useState('')
  return (
    <table className="map">
      <thead>
        <tr><th>{field.key_label ?? 'Sleutel'}</th><th>{field.value_label ?? 'Waarde'}</th><th /></tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>
              <input className="cell" defaultValue={v} onBlur={(e) => e.target.value !== v && onChange({ ...value, [k]: e.target.value })} />
            </td>
            <td>
              <button className="link danger" onClick={() => { const c = { ...value }; delete c[k]; onChange(c) }}>✕</button>
            </td>
          </tr>
        ))}
        <tr>
          <td><input className="cell" placeholder="nieuw" value={nk} onChange={(e) => setNk(e.target.value)} /></td>
          <td><input className="cell" value={nv} onChange={(e) => setNv(e.target.value)} /></td>
          <td>
            <button className="link" disabled={!nk.trim()} onClick={() => { onChange({ ...value, [nk.trim()]: nv }); setNk(''); setNv('') }}>+</button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
