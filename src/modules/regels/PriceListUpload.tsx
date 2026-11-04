import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { toast } from '../../core/toast'

/**
 * Rekenregels → Prijzen: prijslijst van een leverancier opladen (nu: Häfele "Artikeldaten", .zip of .txt).
 * Edge Function price-import bewaart het bestand (Storage prijslijsten/) en zet de prijzen in supplier_catalog;
 * de kostenberekening gebruikt ze na eigen prijs en Du Pont. Verloop in tabel price_imports.
 */
type Imp = { id: string; supplier_name: string; file_name: string | null; status: string; list_date: string | null; message: string | null; created_at: string }
const toB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(f) })

export function PriceListUpload() {
  const [supplier, setSupplier] = useState('Häfele Belgium')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const sq = useQuery<{ name: string }[]>(() => supabase.from('suppliers').select('name').order('name'), [])
  const iq = useQuery<Imp[]>(() => supabase.from('price_imports').select('*').order('created_at', { ascending: false }).limit(6), [])
  const run = async () => {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) return toast('Bestand te groot (max 25 MB)', 'err')
    setBusy(true)
    const data_b64 = await toB64(file)
    const { data, error } = await supabase.functions.invoke('price-import', { body: { supplier, file_name: file.name, data_b64 } })
    setBusy(false)
    const msg = error ? (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message : (data as { error?: string })?.error
    if (msg) toast(msg, 'err')
    else { const d = data as { rows: number; new: number; changed: number; no_price: number }; toast(`${d.rows} artikels ingelezen (${d.changed} andere prijs, ${d.new} nieuw)`); setFile(null); iq.reload() }
  }
  return (
    <div className="card rule">
      <p className="sentence"><b>Prijslijst opladen</b> — de prijzen gelden meteen voor nieuwe berekeningen (na je eigen prijs en Du Pont). Herbereken een ontwerpversie om ze in de kosten te zien.</p>
      <div className="toolbar">
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>{(sq.data ?? []).map((s) => <option key={s.name}>{s.name}</option>)}</select>
        <input type="file" accept=".zip,.txt,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="primary" disabled={!file || busy} onClick={run}>{busy ? 'Inlezen… (tot 1 min)' : 'Inlezen'}</button>
      </div>
      <p className="muted small">Formaat: Häfele "Artikeldaten" (zoals Häfele die mailt, .zip of .txt). Andere leveranciers: stuur mij een voorbeeld.</p>
      {(iq.data ?? []).length > 0 && (
        <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {(iq.data ?? []).map((i) => (
            <li key={i.id}>{new Date(i.created_at).toLocaleDateString('nl-BE')} · {i.supplier_name} · {i.file_name} · <span className={i.status === 'fout' ? 'bad-txt' : ''}>{i.status === 'bezig' ? 'bezig…' : i.message}</span></li>
          ))}
        </ul>
      )}
    </div>
  )
}
