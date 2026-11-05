import { useState } from 'react'
import { supabase } from './supabase'
import { toast } from './toast'
import { useQuery } from './useQuery'
import { ErrorBox, Loading } from './ui'

export type EditCol = {
  key: string
  label: string
  type?: 'text' | 'number' | 'bool' | 'select' | 'textarea'
  options?: string[]
  width?: number
  placeholder?: string
}

type Props = {
  table: string // Supabase-tabel met kolom id
  columns: EditCol[]
  orderBy?: string
  newRow?: Record<string, unknown>
  empty?: string
  focus?: { id: string; key: string } // cel die meteen geselecteerd wordt (bv. vanuit de control tower)
  canAdd?: boolean
  canDelete?: boolean
}

/** Tabel die je bewerkt als in Excel: klik in een cel, wijzig, klaar. Elke wijziging wordt meteen bewaard. */
export function EditableTable({ table, columns, orderBy = 'id', newRow = {}, empty = 'Nog niets ingevuld', focus, canAdd = true, canDelete = true }: Props) {
  const q = useQuery<Record<string, unknown>[]>(() => supabase.from(table).select('*').order(orderBy), [table])
  const [msg, setMsg] = useState<string | null>(null)
  // bewaarde waarden meteen tonen (bv. vinkje Actief), zonder de hele tabel opnieuw te laden
  const [local, setLocal] = useState<Record<string, unknown>>({})

  const save = async (id: unknown, key: string, value: unknown) => {
    const k = `${String(id)}:${key}`
    setLocal((l) => ({ ...l, [k]: value }))
    const { error } = await supabase.from(table).update({ [key]: value }).eq('id', id)
    if (error) setLocal((l) => { const n = { ...l }; delete n[k]; return n })
    setMsg(error ? error.message : 'Bewaard')
    toast(error ? 'Niet bewaard: ' + error.message : 'Bewaard', error ? 'err' : 'ok')
    if (error) q.reload()
  }
  const add = async () => {
    const { error } = await supabase.from(table).insert(newRow)
    if (error) setMsg(error.message)
    q.reload()
  }
  const remove = async (id: unknown) => {
    if (!window.confirm('Deze regel verwijderen?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) setMsg(error.message)
    q.reload()
  }

  if (q.loading) return <Loading />
  const rows = q.data ?? []
  return (
    <div className="table-wrap editable">
      <ErrorBox error={q.error} />
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
            ))}
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="muted">{empty}</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={String(r.id)} className={focus && String(r.id) === focus.id ? 'focus-row' : undefined}>
              {columns.map((c) => (
                <td key={c.key}>
                  <Cell col={c} value={`${String(r.id)}:${c.key}` in local ? local[`${String(r.id)}:${c.key}`] : r[c.key]} onSave={(v) => save(r.id, c.key, v)} autoFocus={!!focus && String(r.id) === focus.id && c.key === focus.key} />
                </td>
              ))}
              <td>
                {canDelete && <button className="link danger" title="Verwijderen" onClick={() => remove(r.id)}>✕</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar pad">
        {canAdd && <button onClick={add}>+ Regel toevoegen</button>}
        {msg && <span className="muted">{msg}</span>}
      </div>
    </div>
  )
}

function Cell({ col, value, onSave, autoFocus }: { col: EditCol; value: unknown; onSave: (v: unknown) => void; autoFocus?: boolean }) {
  const [v, setV] = useState(value == null ? '' : String(value))
  if (col.type === 'bool')
    return <input type="checkbox" checked={value === true} onChange={(e) => onSave(e.target.checked)} />
  if (col.type === 'select')
    return (
      <select value={v} onChange={(e) => { setV(e.target.value); onSave(e.target.value === '' ? null : e.target.value) }}>
        {(col.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  if (col.type === 'textarea')
    return (
      <textarea className="cell" rows={4} autoFocus={autoFocus} value={v} placeholder={col.placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const orig = value == null ? '' : String(value); if (v !== orig) onSave(v.trim() === '' ? null : v) }} />
    )
  const commit = () => {
    const orig = value == null ? '' : String(value)
    if (v === orig) return
    if (col.type === 'number') {
      const n = v.trim() === '' ? null : Number(v.replace(',', '.'))
      if (n !== null && Number.isNaN(n)) return setV(orig)
      onSave(n)
    } else onSave(v.trim() === '' ? null : v)
  }
  return (
    <input
      className="cell"
      autoFocus={autoFocus}
      ref={autoFocus ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined}
      inputMode={col.type === 'number' ? 'decimal' : undefined}
      value={col.type === 'number' ? v.replace('.', ',') : v}
      placeholder={col.placeholder}
      onChange={(e) => setV(col.type === 'number' ? e.target.value.replace(',', '.') : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}
