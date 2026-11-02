import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { fmtNum } from './format'

type Loc = { cabinet: string; cabinet_library: string | null; qty: number; manufacturer: string | null; article_no: string | null; size_x_mm: number | null; size_y_mm: number | null; size_z_mm: number | null }

/** Knopje "Waar?" bij een artikel: in welke kast(en) het zit, hoeveel, uit welke bibliotheek. */
export function ItemWhere({ dvId, name }: { dvId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Loc[] | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open || rows) return
    supabase.from('app_item_locations').select('*').eq('design_version_id', dvId).eq('name', name).order('cabinet')
      .then(({ data }) => setRows((data as Loc[]) ?? []))
  }, [open, rows, dvId, name])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const total = (rows ?? []).reduce((s, r) => s + Number(r.qty), 0)
  const first = rows?.[0]
  return (
    <span className="where" ref={ref}>
      <button type="button" className="where-btn" title="Waar zit dit?" onClick={() => setOpen(!open)}>Waar?</button>
      {open && (
        <div className="where-pop">
          <strong>{name}</strong>
          {rows === null ? (
            <p className="muted">Laden…</p>
          ) : rows.length === 0 ? (
            <p className="muted">Niet als los artikel in de stuklijst gevonden (komt uit een regel, bv. bij de lades).</p>
          ) : (
            <>
              <p className="muted">
                {[first?.manufacturer, first?.article_no].filter(Boolean).join(' · ')}
                {first?.size_x_mm != null && ` · ${fmtNum(first.size_x_mm)} × ${fmtNum(first.size_y_mm)} × ${fmtNum(first.size_z_mm)} mm`}
              </p>
              <table>
                <thead><tr><th>Kast</th><th className="num">Aantal</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cabinet}><td>{r.cabinet}</td><td className="num">{fmtNum(r.qty, 2)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td>{rows.length} kast{rows.length === 1 ? '' : 'en'}</td><td className="num">{fmtNum(total, 2)}</td></tr></tfoot>
              </table>
              {[...new Set(rows.map((r) => r.cabinet_library).filter(Boolean))].map((l) => (
                <p key={l} className="muted small">Bibliotheek: {l}</p>
              ))}
            </>
          )}
        </div>
      )}
    </span>
  )
}
