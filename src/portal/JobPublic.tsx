import { useEffect, useState } from 'react'
import logo from '../assets/vonstruct-logo.webp'
import { SUPABASE_URL } from '../core/supabase'
import { mapsUrl, wazeUrl } from '../core/address'

/**
 * Pagina "Details en plannen" voor de onderaannemer/partner, zonder inloggen (link in de Outlook-uitnodiging).
 * URL: #/opdracht?j=<opdracht>&t=<persoonlijke link>. Gegevens via Edge Function job-action?info=1 (controleert de link;
 * ongeldig na een wijziging van het moment: dan staat de nieuwe link in de bijgewerkte uitnodiging).
 */
type Info = {
  id: string; title: string; job_type: string | null; project_code: string | null; project_title: string | null; client: string | null
  start: string; end: string; slot: string | null; address: string | null; contact_name: string | null; contact_phone: string | null
  instructions: string | null; status: string; confirmed: boolean; who: string | null; teams_url: string | null
  files: { name: string; url: string; kind?: string; mime?: string | null }[]; confirm_url: string
}
const PHONE = '+32 493 47 27 51'
const SLOT: Record<string, string> = { dag: 'hele dag (8:00–16:30)', voormiddag: 'voormiddag (8:00–12:00)', namiddag: 'namiddag (12:30–16:30)' }

type F = Info['files'][number]
const ext = (n: string) => (n.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? '').toUpperCase()
const isImg = (f: F) => /^image\//.test(f.mime ?? '') || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)
const isPdf = (f: F) => f.mime === 'application/pdf' || /\.pdf$/i.test(f.name)

function when(i: Info) {
  const o: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Brussels' }
  const d = (x: string) => new Date(x).toLocaleDateString('nl-BE', { ...o, weekday: 'long', day: 'numeric', month: 'long' })
  const t = (x: string) => new Date(x).toLocaleTimeString('nl-BE', { ...o, hour: '2-digit', minute: '2-digit' })
  if (i.slot) return d(i.end) !== d(i.start) ? `${d(i.start)} t.e.m. ${d(i.end)}` : `${d(i.start)}, ${SLOT[i.slot] ?? i.slot}`
  return `${d(i.start)}, ${t(i.start)}–${t(i.end)}`
}

export function JobPublic() {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    const j = q.get('j') ?? '', t = q.get('t') ?? ''
    fetch(`${SUPABASE_URL}/functions/v1/job-action?j=${encodeURIComponent(j)}&p=sub&t=${encodeURIComponent(t)}&info=1`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (r.ok) setInfo(d as Info)
        else setErr(d?.error === 'oud' ? 'oud' : 'fout')
      })
      .catch(() => setErr('fout'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="jp">
      <header className="jp-head"><img src={logo} alt="Vonstruct" /><span>Custom interiors</span></header>
      <main className="jp-main">
        {!info && !err && <p className="muted">Laden…</p>}
        {err && (
          <div className="jp-card">
            <h1>{err === 'oud' ? 'Deze link is niet meer geldig' : 'Deze link werkt niet'}</h1>
            <p className="muted">{err === 'oud' ? 'Het moment of de onderaannemer is intussen gewijzigd. Open de recentste uitnodiging in je agenda voor de nieuwe link.' : 'Open de link opnieuw vanuit de uitnodiging in je agenda.'} Vragen? Bel Olivier: <a href={`tel:${PHONE.replace(/\s/g, '')}`}>{PHONE}</a>.</p>
          </div>
        )}
        {info && (
          <div className="jp-card">
            <div className="jp-kicker">Opdracht van Vonstruct{info.job_type ? ` · ${info.job_type}` : ''}</div>
            <h1>{info.title}</h1>
            {info.status === 'geannuleerd' ? <p className="jp-state bad">Deze opdracht gaat niet door.</p>
              : info.confirmed ? <p className="jp-state ok">✓ Bevestigd{info.status === 'klaar' ? ' · klaar' : ''}</p>
                : <p className="jp-state">Nog niet bevestigd</p>}
            <dl className="jp-dl">
              <dt>Wanneer</dt><dd><b>{when(info)}</b></dd>
              {info.address && <><dt>Waar</dt><dd>{info.address}<div className="jp-route"><a href={mapsUrl(info.address)} target="_blank" rel="noreferrer">Google Maps</a><a href={wazeUrl(info.address)} target="_blank" rel="noreferrer">Waze</a></div></dd></>}
              {(info.contact_name || info.contact_phone) && <><dt>Ter plaatse</dt><dd>{info.contact_name}{info.contact_phone && <> · <a href={`tel:${info.contact_phone.replace(/\s/g, '')}`}>{info.contact_phone}</a></>}</dd></>}
              {info.project_code && <><dt>Project</dt><dd>{[info.project_code, info.client, info.project_title].filter(Boolean).join(' · ')}</dd></>}
              {info.who && <><dt>Voor</dt><dd>{info.who}</dd></>}
            </dl>
            {info.instructions && <><h2>Wat</h2><p className="jp-text">{info.instructions}</p></>}
            <h2>Plannen en documenten</h2>
            {info.files.length ? (
              <ul className="jp-docs">
                {info.files.map((f) => {
                  const img = isImg(f)
                  return (
                    <li key={f.url}>
                      <a href={f.url} target="_blank" rel="noreferrer" className="jp-doc">
                        {img ? <img src={f.url} alt="" loading="lazy" /> : <span className="jp-ico">{isPdf(f) ? 'PDF' : ext(f.name) || 'DOC'}</span>}
                        <span className="jp-doc-t"><b>{f.name}</b>{f.kind && <small>{f.kind}</small>}</span>
                        <span className="jp-open">Openen</span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="muted small">Nog geen plannen of documenten toegevoegd. Heb je iets nodig? Bel Olivier.</p>}
            <div className="jp-actions">
              {!info.confirmed && info.status !== 'geannuleerd' && <a className="action-btn primary" href={info.confirm_url}>✓ Bevestigen</a>}
              {info.teams_url && <a className="action-btn" href={info.teams_url} target="_blank" rel="noreferrer">Overleg via Teams</a>}
            </div>
            <p className="muted small">Je kan ook gewoon op <b>Accepteren</b> klikken in de uitnodiging in je agenda. Past het moment niet? Kies daar <b>Nieuwe tijd voorstellen</b> of bel Olivier: <a href={`tel:${PHONE.replace(/\s/g, '')}`}>{PHONE}</a>.</p>
            <p className="muted small">Foto’s van de werf doorsturen of het werk klaar melden: <a href="#/" onClick={() => { window.location.hash = '#/'; window.location.reload() }}>inloggen in je portaal</a>.</p>
          </div>
        )}
      </main>
    </div>
  )
}
