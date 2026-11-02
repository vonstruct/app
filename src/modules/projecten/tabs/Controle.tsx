import { useState } from 'react'
import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'
import { OwnArticleEditor } from '../../../core/OwnArticle'

type Row = { id: string; level: string; code: string; message: string; cabinet: string | null; part: string | null; resolved: boolean; resolution: string | null }

/** Meldingen uit PaletteCAD. "Beslag zonder artikelnummer" los je hier op door het een eigen artikel te maken. */
export function Controle({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('app_checks').select('*').eq('design_version_id', dvId).order('level'), [dvId])
  const [msg, setMsg] = useState<string | null>(null)
  if (q.loading && !q.data) return <Loading />
  const rows = q.data ?? []
  const open = rows.filter((r) => !r.resolved)
  return (
    <>
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
          { key: 'level', label: 'Niveau', render: (r) => r.resolved ? <span className="badge ok">opgelost</span> : <span className={r.level === 'fout' ? 'badge bad' : 'badge warn'}>{r.level}</span> },
          { key: 'part', label: 'Onderdeel' },
          { key: 'cabinet', label: 'Kast' },
          { key: 'message', label: 'Melding', render: (r) => <span className={r.resolved ? 'muted' : undefined}>{r.message}</span> },
          {
            key: 'fix', label: 'Oplossen', render: (r) =>
              r.resolved ? <span className="ok-text">{r.resolution}</span>
              : r.code === 'GEEN_ARTIKELNR' && r.part ? (
                <OwnArticleEditor articleNo={null} description={r.part} supplier={null} onSaved={(m) => { setMsg(m); q.reload() }} />
              ) : r.code === 'LOSSE_PLAAT' ? <span className="muted">In PaletteCAD in een kast zetten, of laten zo (komt onder "zonder kast")</span> : null,
          },
        ]}
      />
    </>
  )
}
