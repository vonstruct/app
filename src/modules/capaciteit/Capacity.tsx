import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'

/** Planning → Capaciteit: 16 weken vooruit, ingeplande dagen (eigen opdrachten, plaatsingsweken) tegenover beschikbare dagen. View app_capacity_weeks. */
type W = { week_start: string; iso_week: string; my_job_days: number; sub_job_days: number; installs: number; install_projects: { code: string; title: string | null }[]; jobs: { title: string; code: string | null; days: number; me: boolean }[]; capacity_days: number; planned_days: number }

export function Capacity() {
  const q = useQuery<W[]>(() => supabase.from('app_capacity_weeks').select('*').order('week_start'), [])
  const free = useQuery<string | null>(() => supabase.rpc('next_free_install_week') as never, [])
  if (q.loading) return <Loading />
  return (
    <div className="cap">
      <ErrorBox error={q.error} />
      <div className="quote-intern">
        <span><small>Eerstvolgende vrije plaatsingsweek</small><b>{free.data ? 'week ' + free.data.split('-W')[1] : '—'}</b></span>
        <span><small>Ingepland, komende 8 weken</small><b>{(q.data ?? []).slice(0, 8).reduce((a, w) => a + Number(w.planned_days), 0)} dagen</b></span>
        <span><small>Beschikbaar, komende 8 weken</small><b>{(q.data ?? []).slice(0, 8).reduce((a, w) => a + Number(w.capacity_days), 0)} dagen</b></span>
      </div>
      {(q.data ?? []).map((w) => {
        const pct = Math.min(100, (Number(w.planned_days) / Number(w.capacity_days || 5)) * 100)
        const over = Number(w.planned_days) > Number(w.capacity_days)
        return (
          <div key={w.week_start} className="cap-row">
            <div className="cap-wk"><b>Week {w.iso_week.split('-W')[1]}</b><small>{new Date(w.week_start + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}</small></div>
            <div className="cap-bar"><span className={over ? 'over' : pct >= 80 ? 'full' : ''} style={{ width: pct + '%' }} /></div>
            <div className="cap-num">{w.planned_days} / {w.capacity_days} d</div>
            <div className="cap-what small">
              {w.install_projects.map((p) => <Link key={p.code} to={`/projecten/${p.code}?tab=planning`} className="jo-pill warn">Plaatsing {p.code}</Link>)}
              {w.jobs.map((j, i) => <span key={i} className={'jo-pill ' + (j.me ? '' : 'muted')}>{j.me ? '' : '👷 '}{j.title} · {j.days} d</span>)}
              {!w.install_projects.length && !w.jobs.length && <span className="muted">vrij</span>}
            </div>
          </div>
        )
      })}
      <p className="muted small">Beschikbare dagen, dagen per plaatsing en het maximum aantal plaatsingen per week: Rekenregels → Capaciteit.</p>
    </div>
  )
}
