import { useEffect } from 'react'
import { supabase } from '../core/supabase'
import { useQuery } from '../core/useQuery'
import { PartnerOrderView, type PartnerOrder } from '../core/PartnerOrderView'
import type { ViewAs } from './Jobs'

/** Partnerportaal (productiepartner): bestellingen en ophalingen per project (platen bestellen, ophaaldatum bevestigen, paletten, klaar). */
export function PartnerOrders({ preview, viewAs, onCount }: { preview?: boolean; viewAs?: ViewAs | null; onCount?: (n: number) => void }) {
  const q = useQuery<PartnerOrder[]>(async () => {
    if (viewAs?.kind === 'partner') {
      const { data, error } = await supabase.rpc('admin_partner_orders', { p_partner: viewAs.id })
      return { data: (data ?? []) as PartnerOrder[], error }
    }
    if (preview) return { data: [], error: null }
    const { data, error } = await supabase.rpc('portal_my_partner_orders')
    return { data: (data ?? []) as PartnerOrder[], error }
  }, [preview, viewAs?.id])
  useEffect(() => { if (!q.loading) onCount?.((q.data ?? []).length) }, [q.loading, q.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const all = q.data ?? []
  if (!all.length) return null
  return (
    <section className="portal-pkgs">
      <h2 className="portal-h">Bestellen en ophalen</h2>
      {all.map((o) => (
        <article key={o.id} className="portal-card pkg-card">
          <header className="pkg-head">
            <div><b>{o.project_code} · {o.title ?? ''}</b>{o.client && <span className="muted"> · {o.client}</span>}</div>
            <div className="small muted">doorgegeven {o.sent_at ? new Date(o.sent_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long' }) : ''}{o.sent_count > 1 && <span className="pkg-new">aangepast</span>}</div>
          </header>
          {o.note && <div className="pkg-note"><b>Opmerking</b><p>{o.note}</p></div>}
          <PartnerOrderView o={o} act={!preview && !viewAs} onChange={q.reload} />
        </article>
      ))}
    </section>
  )
}
