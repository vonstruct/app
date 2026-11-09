import { useState } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { OwnArticleEditor } from '../../../core/OwnArticle'
import { ItemWhere } from '../../../core/ItemWhere'

type Row = {
  id: string; level: string; code: string; message: string; cabinet: string | null; part: string | null; resolved: boolean; resolution: string | null
  normal?: boolean; code_label?: string | null
}

/** Meldingen uit PaletteCAD. "Beslag zonder artikelnummer" los je hier op door het een eigen artikel te maken. */
export function Controle({ dvId, compact }: { dvId: string; compact?: boolean }) {
  const q = useQuery<Row[]>(() => supabase.from('app_checks').select('*').eq('design_version_id', dvId).order('level'), [dvId])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // een soort melding normaal maken (of terug melden): geldt voor alle projecten, ook in Rekenregels → Meldingen
  const setNormal = async (r: Row, normal: boolean) => {
    setBusy(r.code)
    const { error } = await supabase.from('check_settings').upsert({ code: r.code, normal }, { onConflict: 'code' })
    setBusy(null)
    const what = r.code_label || r.code
    setMsg(error ? 'Bewaren mislukt: ' + error.message
      : normal ? `"${what}" is normaal: telt niet meer mee als opmerking (alle projecten). Terugzetten: "toch melden" of Rekenregels → Meldingen.`
      : `"${what}" telt weer mee als opmerking.`)
    q.reload()
  }
  if (q.loading && !q.data) return <Loading />
  const rows = q.data ?? []
  const open = rows.filter((r) => !r.resolved)
  // op het Overzicht van de versie: enkel tonen als er meldingen zijn
  if (compact && rows.length === 0) return null
  return (
    <>
      {compact && <h2 className="vt-h">Meldingen uit PaletteCAD {open.length > 0 && <span className="warn-text">{open.length} open</span>}</h2>}
      <ErrorBox error={q.error} />
      <p className="muted">
        {open.length === 0 ? 'Alle meldingen zijn opgelost.' : `${open.length} open melding${open.length === 1 ? '' : 'en'}.`} Beslag zonder
        artikelnummer hoef je niet in PaletteCAD aan te vullen: kies hier de herkomst en de prijs, dan wordt het op naam herkend.
      </p>
      {msg && <p className="notice">{msg}</p>}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        filter={false}
        empty="Geen meldingen"
        columns={[
          { key: 'level', label: 'Niveau', render: (r) => r.resolved ? <span className="badge ok">{r.normal && r.code !== 'GEEN_ARTIKELNR' ? 'normaal' : 'opgelost'}</span> : <span className={r.level === 'fout' ? 'badge bad' : 'badge warn'}>{r.level}</span> },
          { key: 'part', label: 'Onderdeel', render: (r) => r.part ? <>{r.part} {r.code === 'GEEN_ARTIKELNR' && <ItemWhere dvId={dvId} name={r.part} />}</> : null },
          { key: 'cabinet', label: 'Kast' },
          { key: 'message', label: 'Melding', render: (r) => <span className={r.resolved ? 'muted' : undefined}>{r.message}</span> },
          {
            key: 'fix', label: 'Oplossen', render: (r) =>
              r.resolved ? (
                <>
                  <span className="ok-text">{r.resolution}</span>
                  {r.normal && r.code !== 'GEEN_ARTIKELNR' && (
                    <><span className="muted"> · </span><button className="link small" disabled={busy === r.code} onClick={() => setNormal(r, false)} title="Deze soort melding weer als opmerking tellen (alle projecten)">toch melden</button></>
                  )}
                </>
              ) : r.code === 'GEEN_ARTIKELNR' && r.part ? (
                <OwnArticleEditor articleNo={null} description={r.part} supplier={null} onSaved={(m) => { setMsg(m); q.reload() }} />
              ) : (
                <button className="link" disabled={busy === r.code} onClick={() => setNormal(r, true)} title="Deze soort melding is normaal: blijft zichtbaar, telt niet meer mee als opmerking (alle projecten)">
                  Is normaal, niet meer tellen
                </button>
              ),
          },
        ]}
      />
    </>
  )
}
