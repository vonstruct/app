import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { VonSiri } from '../../core/VonSiri'

/** Instellingen: overzicht van VON, systemen (back-up, sleutels) en snelkoppelingen naar regels, mails en portaal. */
type Backup = { started_at: string; finished_at: string | null; ok: boolean | null; message: string | null }
type Secret = { name: string; expires_on: string; used_by: string | null }
type Agent = { model: string; enabled: boolean; max_runs_per_day: number }

export function Settings() {
  const [backup, setBackup] = useState<Backup | null>(null)
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [agent, setAgent] = useState<Agent | null>(null)
  const [cost, setCost] = useState<number | null>(null)
  useEffect(() => {
    supabase.from('backup_runs').select('started_at,finished_at,ok,message').order('started_at', { ascending: false }).limit(1).then(({ data }) => setBackup((data?.[0] as Backup) ?? null))
    supabase.from('secret_expiry').select('name,expires_on,used_by').order('expires_on').then(({ data }) => setSecrets((data as Secret[]) ?? []))
    supabase.from('agents').select('model,enabled,max_runs_per_day').eq('id', 'von').single().then(({ data }) => setAgent(data as Agent))
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0)
    supabase.from('agent_runs').select('cost_usd').gt('created_at', month.toISOString()).then(({ data }) => setCost((data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)))
  }, [])
  const d = (s: string) => new Date(s).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className="settings-grid">
      <div className="panel">
        <h2>VON</h2>
        {agent && <p className="small">{agent.enabled ? '🟢 aan' : '⚪ uit'} · model {agent.model} · max. {agent.max_runs_per_day} vragen per dag{cost != null ? ` · deze maand ± $ ${cost.toFixed(2)}` : ''}</p>}
        <p className="small muted">Briefing om 7u15 en 18u (mail, melding en in VON). Voorstellen van VON wachten op je goedkeuring in <Link to="/von">VON</Link>.</p>
        <VonSiri />
      </div>
      <div className="panel">
        <h2>Systemen</h2>
        <p className="small"><b>Back-up naar OneDrive</b>: {backup ? (backup.ok ? `✓ gelukt op ${new Date(backup.finished_at ?? backup.started_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : backup.ok === false ? `⚠ mislukt: ${backup.message ?? ''}` : 'bezig…') : 'nog geen'}</p>
        <p className="small"><b>Sleutels en vervaldata</b></p>
        <ul className="mini">{secrets.map((s) => <li key={s.name}><span>{s.name}</span><span className="muted right">{d(s.expires_on)}</span></li>)}</ul>
      </div>
      <div className="panel">
        <h2>Meer</h2>
        <ul className="settings-links">
          <li><Link to="/regels">Rekenregels</Link><span className="muted small"> tarieven, platen, kanten, lades, productiekosten, berichten</span></li>
          <li><Link to="/mails">Mails</Link><span className="muted small"> wat de app verstuurde en of het aankwam</span></li>
          <li><Link to="/portaal">Portaal (voorbeeld)</Link><span className="muted small"> zo zien klanten, onderaannemers en partners het</span></li>
        </ul>
      </div>
    </div>
  )
}
