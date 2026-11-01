import { supabase } from '../../../core/supabase'
import { useQuery } from '../../../core/useQuery'
import { DataTable } from '../../../core/DataTable'
import { ErrorBox, Loading } from '../../../core/ui'

type Row = { id: string; level: string; code: string; message: string; cabinet: string | null; part: string | null }

export function Controle({ dvId }: { dvId: string }) {
  const q = useQuery<Row[]>(() => supabase.from('bom_checks').select('*').eq('design_version_id', dvId).order('level'), [dvId])
  if (q.loading) return <Loading />
  return (
    <>
      <ErrorBox error={q.error} />
      <DataTable
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        filter={false}
        empty="Geen meldingen"
        columns={[
          { key: 'level', label: 'Niveau', render: (r) => <span className={r.level === 'fout' ? 'badge bad' : 'badge warn'}>{r.level}</span> },
          { key: 'cabinet', label: 'Kast' },
          { key: 'part', label: 'Onderdeel' },
          { key: 'message', label: 'Melding' },
        ]}
      />
    </>
  )
}
