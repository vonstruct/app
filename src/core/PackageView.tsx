import { fmtEur, fmtNum } from './format'

/**
 * Inhoud van een productiepakket zoals de partner (partner) het ziet: opmerkingen, restplaten/kantenband meegeven, bestanden,
 * kasten waarbij de nerf moet doorlopen, platen en kantenband (zonder prijs), productiekost met bedragen. Gedeeld door het partnerportaal en het voorbeeld voor de beheerder.
 * Gegevens = package_json() in Supabase.
 */
export type PkgFile = { id: string; kind: string; name: string; size: number | null; storage: string; downloaded_at: string | null; downloads: number }
export type Pkg = {
  id: string; project_code: string; version: number; status: string; sent_at: string | null; note: string | null; return_sheets: boolean; return_edges: boolean
  title: string | null; client: string | null
  sheets: { material: string; article_no: string | null; thickness: number | null; length: number | null; width: number | null; qty: number; supplier: string | null; ordered_by: string | null }[] | null
  edges: { description: string; product: string | null; article_no: string | null; qty: number; unit: string | null; supplier: string | null; ordered_by: string | null }[] | null
  production: { description: string; qty: number | null; unit: string | null; unit_price: number | null; total: number }[] | null
  files: PkgFile[] | null
  grain: { name: string; width: number | null; height: number | null; depth: number | null }[] | null; grain_note: string | null
}
const KIND: Record<string, string> = { palettecad: 'PaletteCAD-bestand', zaagplan: 'Zaagplan', tekening: 'Tekening', andere: 'Bestand' }
export const fileSize = (n: number | null) => (n == null ? '' : n > 1e6 ? `${fmtNum(n / 1e6, 0)} MB` : `${fmtNum(n / 1e3, 0)} kB`)
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

export function PackageView({ p, onDownload, admin }: { p: Pkg; onDownload: (f: PkgFile) => void; admin?: boolean }) {
  const prodTotal = (p.production ?? []).reduce((a, l) => a + Number(l.total), 0)
  return (
    <div className="pkg">
      {p.note && <div className="pkg-note"><b>Opmerkingen</b><p>{p.note}</p></div>}
      <div className="pkg-flags">
        <span className={p.return_sheets ? 'on' : ''}>{p.return_sheets ? '✓' : '–'} Restplaten meegeven</span>
        <span className={p.return_edges ? 'on' : ''}>{p.return_edges ? '✓' : '–'} Rest kantenband meegeven (behalve wit)</span>
      </div>
      {(p.grain ?? []).length > 0 && (
        <div className="pkg-grain"><b>Nerf laten doorlopen</b> <span className="small muted">bij deze kasten</span>
          {p.grain_note && <p>{p.grain_note}</p>}
          <ul>{(p.grain ?? []).map((c, i) => <li key={i}>{c.name}{c.width && c.height ? <small className="muted"> · {fmtNum(c.width, 0)} × {fmtNum(c.height, 0)}{c.depth ? ` × ${fmtNum(c.depth, 0)}` : ''} mm</small> : null}</li>)}</ul>
        </div>
      )}
      <h3>Bestanden</h3>
      {(p.files ?? []).length === 0 ? <p className="muted small">Nog geen bestanden.</p> : (
        <ul className="pkg-files">
          {(p.files ?? []).map((f) => (
            <li key={f.id}>
              <span className="pkg-kind">{KIND[f.kind] ?? f.kind}</span>
              <span className="pkg-fname">{f.name} <small className="muted">{fileSize(f.size)}</small></span>
              <span className="small muted">{f.downloaded_at ? `${admin ? 'gedownload door partner' : 'gedownload'} ${day(f.downloaded_at)}` : admin ? 'nog niet gedownload' : ''}</span>
              <button className="small" onClick={() => onDownload(f)}>Downloaden</button>
            </li>
          ))}
        </ul>
      )}
      <h3>Platen</h3>
      {(p.sheets ?? []).length === 0 ? <p className="muted small">Geen platen in de stuklijst.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Materiaal</th><th className="num">Dikte</th><th className="num">Formaat (mm)</th><th className="num">Aantal</th><th>Leverancier</th><th>Besteld door</th></tr></thead>
          <tbody>{(p.sheets ?? []).map((s, i) => (
            <tr key={i}><td>{s.material}{s.article_no && <div className="small muted">{s.article_no}</div>}</td><td className="num">{s.thickness ? `${fmtNum(s.thickness, 0)} mm` : ''}</td>
              <td className="num">{s.length && s.width ? `${fmtNum(s.length, 0)} × ${fmtNum(s.width, 0)}` : ''}</td><td className="num">{fmtNum(s.qty, 0)}</td><td>{s.supplier}</td><td>{s.ordered_by}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <h3>Kantenband</h3>
      {(p.edges ?? []).length === 0 ? <p className="muted small">Geen kantenband.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Kantenband</th><th className="num">Meter</th><th>Leverancier</th><th>Besteld door</th></tr></thead>
          <tbody>{(p.edges ?? []).map((e, i) => (
            <tr key={i}><td>{e.description}{(e.product || e.article_no) && <div className="small muted">{[e.product, e.article_no].filter(Boolean).join(' · ')}</div>}</td>
              <td className="num">{fmtNum(e.qty, 0)} {e.unit === 'm' ? '' : e.unit}</td><td>{e.supplier}</td><td>{e.ordered_by}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <h3>Productie: zagen, afkanten, verlijmen</h3>
      {(p.production ?? []).length === 0 ? <p className="muted small">Geen productiekost berekend.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Wat</th><th className="num">Aantal</th><th className="num">Per eenheid</th><th className="num">Bedrag</th></tr></thead>
          <tbody>{(p.production ?? []).map((l, i) => (
            <tr key={i}><td>{l.description}</td><td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, 2)} ${l.unit ?? ''}`}</td><td className="num">{l.unit_price == null ? '' : fmtEur(l.unit_price)}</td><td className="num">{fmtEur(l.total)}</td></tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={3}>Totaal excl. btw</td><td className="num">{fmtEur(prodTotal)}</td></tr></tfoot>
        </table></div>
      )}
    </div>
  )
}
