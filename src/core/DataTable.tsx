import { useMemo, useState, type ReactNode } from 'react'

export type Column<T> = {
  key: string
  label: string
  value?: (row: T) => unknown // waarde om te sorteren en te filteren
  render?: (row: T) => ReactNode // weergave (standaard: value)
  align?: 'left' | 'right'
  total?: boolean // optellen in de voetregel
}

type Props<T> = {
  rows: T[]
  columns: Column<T>[]
  filter?: boolean
  empty?: string
  rowKey?: (row: T, i: number) => string
}

/** Tabel met sorteren (klik op kop), zoekveld en optionele totalen. Wordt door elke module gebruikt. */
export function DataTable<T>({ rows, columns, filter = true, empty = 'Geen gegevens', rowKey }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [q, setQ] = useState('')
  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key])

  const shown = useMemo(() => {
    let out = rows
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      out = out.filter((r) => columns.some((c) => String(val(c, r) ?? '').toLowerCase().includes(needle)))
    }
    if (sort) {
      const c = columns.find((x) => x.key === sort.key)
      if (c)
        out = [...out].sort((a, b) => {
          const va = val(c, a), vb = val(c, b)
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sort.dir
          return String(va ?? '').localeCompare(String(vb ?? ''), 'nl', { numeric: true }) * sort.dir
        })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns])

  const hasTotals = columns.some((c) => c.total)
  return (
    <div className="table-wrap">
      {filter && rows.length > 8 && (
        <input className="search" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'num' : ''}
                onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}
              >
                {c.label}
                {sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="muted">
                {empty}
              </td>
            </tr>
          )}
          {shown.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                  {c.render ? c.render(r) : String(val(c, r) ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasTotals && shown.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((c, i) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                  {c.total
                    ? shown.reduce((s, r) => s + (Number(val(c, r)) || 0), 0).toLocaleString('nl-BE', { maximumFractionDigits: 1 })
                    : i === 0
                      ? 'Totaal'
                      : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
