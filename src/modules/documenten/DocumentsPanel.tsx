import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { toast } from '../../core/toast'

/** Tab "Documenten": plannen, renders, attesten … per project (Storage project-uploads/<code>/documenten/), per document zichtbaar voor de klant of niet. */
type Doc = { id: string; kind: string; title: string; path: string; size_bytes: number | null; mime: string | null; show_client: boolean; archived: boolean; created_at: string }
const KINDS = ['Plan', 'Render', 'Technische tekening', 'Attest', 'Foto', 'Contract', 'Andere']
const size = (b: number | null) => (b == null ? '' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' kB')

export function DocumentsPanel({ project }: { project: string }) {
  const q = useQuery<Doc[]>(() => supabase.from('project_documents').select('*').eq('project_code', project).eq('archived', false).order('kind').order('created_at', { ascending: false }), [project])
  const [kind, setKind] = useState('Plan')
  const [client, setClient] = useState(false)
  const [busy, setBusy] = useState(false)
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    for (const f of Array.from(files)) {
      const path = `${project}/documenten/${crypto.randomUUID()}-${f.name.replace(/[^\w.\- ]/g, '_')}`
      const { error } = await supabase.storage.from('project-uploads').upload(path, f, { contentType: f.type || undefined })
      if (error) { toast(error.message, 'err'); continue }
      await supabase.from('project_documents').insert({ project_code: project, kind, title: f.name.replace(/\.[^.]+$/, ''), path, size_bytes: f.size, mime: f.type || null, show_client: client })
    }
    setBusy(false); toast('Opgeladen'); q.reload()
  }
  const open = async (d: Doc) => { const { data } = await supabase.storage.from('project-uploads').createSignedUrl(d.path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  const save = async (d: Doc, patch: Partial<Doc>) => { const { error } = await supabase.from('project_documents').update(patch).eq('id', d.id); if (error) toast(error.message, 'err'); else q.reload() }
  if (q.loading) return <Loading />
  return (
    <div>
      <div className="ho-new doc-new">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        <label className="qcheck"><input type="checkbox" checked={client} onChange={(e) => setClient(e.target.checked)} /> klant mag het zien</label>
        <input type="file" multiple disabled={busy} onChange={(e) => upload(e.target.files)} />
        {busy && <span className="muted">Bezig met opladen…</span>}
      </div>
      <ErrorBox error={q.error} />
      {!(q.data ?? []).length && <p className="muted">Nog geen documenten.</p>}
      {(q.data ?? []).map((d) => (
        <div key={d.id} className="doc-row">
          <span className="jo-pill">{d.kind}</span>
          <input className="doc-title" defaultValue={d.title} onBlur={(e) => e.target.value !== d.title && save(d, { title: e.target.value })} />
          <span className="muted small">{size(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString('nl-BE')}</span>
          <label className="qcheck"><input type="checkbox" checked={d.show_client} onChange={(e) => save(d, { show_client: e.target.checked })} /> klant</label>
          <button onClick={() => open(d)}>Openen</button>
          <button title="Archiveren" onClick={() => confirm(`"${d.title}" archiveren?`) && save(d, { archived: true })}>×</button>
        </div>
      ))}
    </div>
  )
}
