import { fmtNum } from './format'

/**
 * Inhoud van een productiepakket zoals de productiepartner het ziet: opmerkingen, restplaten/kantenband meegeven, bestanden,
 * opmerkingen per kast, platen en kantenband die de partner bestelt (zonder prijs; wat Vonstruct zelf bestelt niet), productie in aantallen (geen prijzen, geen bestelkost of vracht). Gedeeld door het partnerportaal en het voorbeeld voor de beheerder.
 * Gegevens = package_json() in Supabase.
 */
export type PkgFile = { id: string; kind: string; name: string; size: number | null; storage: string; downloaded_at: string | null; downloads: number }
export type Pkg = {
  id: string; project_code: string; version: number; status: string; sent_at: string | null; note: string | null; return_sheets: boolean; return_edges: boolean
  title: string | null; client: string | null
  sheets: { material: string; article_no: string | null; thickness: number | null; length: number | null; width: number | null; qty: number; supplier: string | null; ordered_by: string | null }[] | null
  edges: { description: string; product: string | null; article_no: string | null; qty: number; unit: string | null; supplier: string | null; ordered_by: string | null }[] | null
  production: { description: string; qty: number | null; unit: string | null }[] | null
  files: PkgFile[] | null
  cabinets: { name: string; tags: string[]; note: string | null; width: number | null; height: number | null; depth: number | null }[] | null
}
const KIND: Record<string, string> = { palettecad: 'PaletteCAD-bestand', zaagplan: 'Zaagplan', tekening: 'Tekening', andere: 'Bestand' }
export const fileSize = (n: number | null) => (n == null ? '' : n > 1e6 ? `${fmtNum(n / 1e6, 0)} MB` : `${fmtNum(n / 1e3, 0)} kB`)
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

export function PackageView({ p, onDownload, admin }: { p: Pkg; onDownload: (f: PkgFile) => void; admin?: boolean }) {
  return (
    <div className="pkg">
      {(p.note || (p.cabinets ?? []).length > 0) && (
        <div className="pkg-note"><b>Opmerkingen</b>
          {p.note && <><div className="pkg-sub">Algemeen</div><p>{p.note}</p></>}
          {(p.cabinets ?? []).length > 0 && <>
            <div className="pkg-sub">Per kast</div>
            <ul className="pkg-cabs">{(p.cabinets ?? []).map((c, i) => (
              <li key={i}><b>{c.name}</b>{c.width && c.height ? <small className="muted"> {fmtNum(c.width, 0)} × {fmtNum(c.height, 0)}{c.depth ? ` × ${fmtNum(c.depth, 0)}` : ''} mm</small> : null}
                <div>{c.tags.map((t) => <span key={t} className="chip gold">{t}</span>)}{c.note && <span className="pkg-cab-note">{c.note}</span>}</div></li>
            ))}</ul>
          </>}
        </div>
      )}
      <div className="pkg-flags">
        <span className={p.return_sheets ? 'on' : ''}>{p.return_sheets ? '✓' : '–'} Restplaten meegeven</span>
        <span className={p.return_edges ? 'on' : ''}>{p.return_edges ? '✓' : '–'} Rest kantenband meegeven (behalve wit)</span>
      </div>
      <h3>Bestanden</h3>
      {(p.files ?? []).length === 0 ? <p className="muted small">Nog geen bestanden.</p> : (
        <ul className="pkg-files">
          {(p.files ?? []).map((f) => (
            <li key={f.id}>
              <span className="pkg-kind">{KIND[f.kind] ?? f.kind}</span>
              <span className="pkg-fname">{f.name} <small className="muted">{fileSize(f.size)}</small></span>
              <span className="small muted">{f.downloaded_at ? `${admin ? 'gedownload door de partner' : 'gedownload'} ${day(f.downloaded_at)}` : admin ? 'nog niet gedownload' : ''}</span>
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
      {(p.production ?? []).length === 0 ? <p className="muted small">Niets berekend.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Wat</th><th className="num">Aantal</th></tr></thead>
          <tbody>{(p.production ?? []).map((l, i) => (
            <tr key={i}><td>{l.description}</td><td className="num">{l.qty == null ? '' : `${fmtNum(l.qty, l.unit === 'm' ? 1 : 0)} ${l.unit ?? ''}`}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  )
}
