import { useState } from 'react'
import { supabase } from '../core/supabase'
import { useQuery } from '../core/useQuery'
import { PackageView, type Pkg, type PkgFile } from '../core/PackageView'
import type { ViewAs } from './Jobs'

/** Partnerportaal (partner): productiepakketten die Olivier verstuurde. Nieuwste versie per project bovenaan; downloads worden bijgehouden. */
export function Packages({ preview, viewAs }: { preview?: boolean; viewAs?: ViewAs | null }) {
  const q = useQuery<Pkg[]>(async () => {
    // beheerder bekijkt het portaal van de partner: zijn verstuurde pakketten
    if (viewAs?.kind === 'partner') {
      const { data, error } = await supabase.rpc('admin_partner_packages', { p_partner: viewAs.id })
      return { data: (data ?? []) as Pkg[], error }
    }
    if (preview) return { data: [], error: null }
    const { data, error } = await supabase.rpc('portal_my_packages')
    return { data: (data ?? []) as Pkg[], error }
  }, [preview, viewAs?.id])
  const [busy, setBusy] = useState<string | null>(null)
  const [old, setOld] = useState(false)
  const all = q.data ?? []
  if (!all.length) return null
  const current = all.filter((p) => p.status === 'verstuurd')
  const replaced = all.filter((p) => p.status === 'vervangen')
  const download = async (f: PkgFile) => {
    setBusy(f.id)
    const w = window.open('', '_blank')
    const { data, error } = await supabase.functions.invoke('productie', { body: { action: 'file_url', file_id: f.id } })
    setBusy(null)
    if (error || !data?.url) { w?.close(); alert('Downloaden lukte niet. Probeer opnieuw of laat het Olivier weten.'); return }
    if (w) w.location.href = data.url; else window.location.href = data.url
    q.reload()
  }
  return (
    <section className="portal-pkgs">
      <h2 className="portal-h">Productiepakketten</h2>
      {current.map((p) => (
        <article key={p.id} className="portal-card pkg-card">
          <header className="pkg-head">
            <div><b>{p.project_code} · {p.title ?? ''}</b>{p.client && <span className="muted"> · {p.client}</span>}</div>
            <div className="small muted">versie {p.version}{p.sent_at ? ` · ${new Date(p.sent_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long' })}` : ''}{p.version > 1 && <span className="pkg-new">nieuwe versie</span>}</div>
          </header>
          {busy && <p className="small muted">Link wordt gemaakt…</p>}
          <PackageView p={p} onDownload={download} />
        </article>
      ))}
      {replaced.length > 0 && (
        <p className="small"><button className="link" onClick={() => setOld((x) => !x)}>{old ? 'Oudere versies verbergen' : `Oudere versies (${replaced.length})`}</button></p>
      )}
      {old && replaced.map((p) => (
        <article key={p.id} className="portal-card pkg-card pkg-old">
          <header className="pkg-head"><div><b>{p.project_code} · {p.title ?? ''}</b> <span className="muted">versie {p.version} · vervangen</span></div></header>
          <PackageView p={p} onDownload={download} />
        </article>
      ))}
    </section>
  )
}
