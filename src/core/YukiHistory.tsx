import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fmtEur } from './format'
import { toast } from './toast'

/** Pdf uit het Yuki-archief openen (tijdelijke link van 15 min via Edge Function yuki, actie doc_url). */
export async function openYukiPdf(documentId: string) {
  const w = window.open('', '_blank')
  const { data, error } = await supabase.functions.invoke('yuki', { body: { action: 'doc_url', document_id: documentId } })
  if (error || !data?.url) { w?.close(); toast('Pdf niet gevonden in Yuki', 'err'); return }
  if (w) w.location.href = data.url; else window.location.href = data.url
}

/** Facturen en betalingen van een klant uit Yuki (klantenrekening, view app_client_ledger; elke nacht bijgewerkt), met pdf uit het archief. Offertes uit Yuki zijn niet op te halen (niet in het archief).
 *  Enkel facturen die horen bij een offerte (offertenummer in de omschrijving) of een factuur van de app (+ hun betalingen); met `project` enkel die van dat project (6 nov 2026). */
type L = { client_id: string; project_code: string | null; yuki_id: string; entry_date: string; kind: 'factuur' | 'creditnota' | 'betaling'; invoice_no: string | null; description: string | null; amount: number; paid: boolean | null; client_balance: number; document_id: string | null }
const d = (v: string) => new Date(v + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })
const clean = (s: string | null) => (s ?? '').replace(/^Binnenlandse overschrijvingen - SEPA credit transfers : /, '').replace(/\s*\|.*$/, '').replace(/Netto bedrag: [\d,.]+ : /, '').slice(0, 90)

// Alle klantenrekeningen in één verzoek, gedeeld door alle kaarten (Relaties toonde er één per klant: 89 zware verzoeken tegelijk
// legden de database plat, 6 nov 2026). Een minuut bewaard; per project blijft het een eigen, klein verzoek.
let allLedger: { at: number; p: Promise<L[]> } | null = null
const ledgerAll = () => {
  if (!allLedger || Date.now() - allLedger.at > 60000)
    allLedger = { at: Date.now(), p: Promise.resolve(supabase.from('app_client_ledger').select('*').order('entry_date')).then(({ data }) => (data as L[]) ?? []) }
  return allLedger.p
}

export function useClientLedger(clientId: string | null | undefined, project?: string) {
  const [rows, setRows] = useState<L[] | null>(null)
  useEffect(() => {
    if (!clientId && !project) return setRows([])
    let alive = true
    if (project) supabase.from('app_client_ledger').select('*').eq('project_code', project).order('entry_date').then(({ data }) => alive && setRows((data as L[]) ?? []))
    else ledgerAll().then((all) => alive && setRows(all.filter((r) => r.client_id === clientId)))
    return () => { alive = false }
  }, [clientId, project])
  return rows
}

export function ledgerSummary(rows: L[] | null) {
  if (!rows?.length) return null
  const inv = rows.filter((r) => r.kind === 'factuur')
  const total = inv.reduce((a, r) => a + Number(r.amount), 0)
  const open = Math.max(0, rows.reduce((a, r) => a + Number(r.amount), 0))
  return { n: inv.length, total, open }
}

export function YukiHistory({ clientId, project, compact = false }: { clientId: string | null | undefined; project?: string; compact?: boolean }) {
  const rows = useClientLedger(clientId, project)
  const [open, setOpen] = useState(!compact)
  const s = ledgerSummary(rows)
  if (!rows || !s) return null
  return (
    <div className="yuki-hist">
      <button className="link small" onClick={() => setOpen((x) => !x)}>
        Yuki: {s.n} factu{s.n === 1 ? 'ur' : 'ren'} · {fmtEur(s.total)} · {s.open > 0.01 ? <span className="bad-txt">{fmtEur(s.open)} open</span> : 'alles betaald'} {open ? '▴' : '▾'}
      </button>
      {open && (
        <ul>
          {rows.map((r) => (
            <li key={r.yuki_id} className={'yh-' + r.kind}>
              <span className="yh-d">{d(r.entry_date)}</span>
              <span className="yh-t">{r.kind === 'factuur' ? <b>{r.invoice_no ?? 'Factuur'}</b> : r.kind === 'creditnota' ? <b>Creditnota</b> : 'Betaling'} <span className="muted">{clean(r.description)}</span></span>
              <span className="yh-a">{r.document_id && <button className="link small yh-pdf" onClick={() => openYukiPdf(r.document_id!)} title="Factuur openen (pdf uit Yuki)">pdf</button>}{fmtEur(r.kind === 'factuur' ? r.amount : -r.amount)}{r.kind === 'factuur' && (r.paid ? <span className="ok-txt"> ✓</span> : <span className="bad-txt"> open</span>)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
