import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { fmtEur } from '../../core/format'
import { PROJECTEN, Section } from '../../core/Section'

/**
 * Cijfers (rapportering): omzet, offertes, pijplijn, marge en doorlooptijd per fase.
 * Eén verzoek: RPC `report_page(p_year)`. De database rekent alles (ook percentages); deze pagina toont enkel.
 * Bronnen: Yuki-boekhouding (bedragen incl. btw), offertes en nacalculatie van de app (excl. btw), fasewissels (events 'fase').
 */
type Report = {
  year: number
  money: { invoiced_incl: number; received: number; open_incl: number; n_invoices: number; last_sync: string | null }
  quotes: { sent: number; signed: number; declined: number; signed_excl: number; open_excl: number; open_n: number; win_pct: number | null }
  months: { month: number; invoiced_incl: number; received: number; signed_excl: number }[]
  pipeline: { stage: string; label: string; n: number; n_quote: number; value_excl: number }[]
  margins: { code: string; title: string | null; client: string | null; revenue_excl: number; margin_planned: number | null; margin_planned_pct: number | null; margin_actual: number | null; margin_actual_pct: number | null }[]
  margin_totals: { n: number; revenue_excl: number; margin_planned: number | null; margin_planned_pct: number | null; margin_actual: number | null; margin_actual_pct: number | null }
  durations: { stage: string; n_done: number; median_done: number | null; n_now: number; avg_now: number | null }[]
  durations_since: string | null
}

const eur0 = (v: number | null | undefined) => (v == null ? '—' : Number(v).toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }))
const pct = (v: number | null | undefined) => (v == null ? '' : ` · ${String(v).replace('.', ',')} %`)
const days = (v: number | null | undefined) => (v == null ? '—' : `${String(v).replace('.', ',')} ${v === 1 ? 'dag' : 'dagen'}`)
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export function Cijfers() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const q = useQuery<Report>(async () => {
    const { data, error } = await supabase.rpc('report_page', { p_year: year })
    return { data: data as Report, error }
  }, [year])
  const r = q.data
  const top = r ? Math.max(1, ...r.months.map((m) => Math.max(m.invoiced_incl, m.signed_excl))) : 1

  return (
    <Section title="Projecten" tabs={PROJECTEN}>
      <div className="cf">
        <div className="cf-year" role="group" aria-label="Jaar">
          <button className="btn-plain" onClick={() => setYear(year - 1)} aria-label="Vorig jaar">‹</button>
          <b>{year}</b>
          <button className="btn-plain" onClick={() => setYear(year + 1)} disabled={year >= thisYear} aria-label="Volgend jaar">›</button>
        </div>
        <ErrorBox error={q.error} />
        {!r ? (q.error ? null : <Loading />) : (
          <>
            <div className="cf-kpis">
              <div className="cf-kpi"><span className="cf-v">{eur0(r.money.invoiced_incl)}</span><span className="cf-l">Gefactureerd <small>incl. btw · {r.money.n_invoices} facturen</small></span></div>
              <div className="cf-kpi"><span className="cf-v">{eur0(r.money.received)}</span><span className="cf-l">Ontvangen <small>nog open: {eur0(r.money.open_incl)}</small></span></div>
              <div className="cf-kpi"><span className="cf-v">{eur0(r.quotes.signed_excl)}</span><span className="cf-l">Getekend <small>excl. btw · {r.quotes.signed} {r.quotes.signed === 1 ? 'offerte' : 'offertes'}</small></span></div>
              <div className="cf-kpi"><span className="cf-v">{r.quotes.win_pct == null ? '—' : `${r.quotes.win_pct} %`}</span><span className="cf-l">Slaagkans offertes <small>{r.quotes.signed} getekend · {r.quotes.declined} niet</small></span></div>
            </div>

            <section className="panel cf-card">
              <h2>Pijplijn <small>lopende projecten per stap · waarde = laatste offerte excl. btw</small></h2>
              <ol className="cf-pipe">
                {r.pipeline.map((s) => (
                  <li key={s.stage} className={s.n ? '' : 'empty'}>
                    <span className="cf-pn">{s.n}</span>
                    <span className="cf-pl">{s.label}</span>
                    <span className="cf-pv">{s.n_quote ? eur0(s.value_excl) : s.n ? 'nog geen offerte' : ''}</span>
                  </li>
                ))}
              </ol>
              {r.quotes.open_n > 0 && <p className="muted cf-note">Verstuurde offertes zonder antwoord: {r.quotes.open_n} · {eur0(r.quotes.open_excl)} excl. btw</p>}
            </section>

            <div className="cf-two">
              <section className="panel cf-card">
                <h2>Per maand <small><span className="cf-sw inv" /> gefactureerd incl. btw · <span className="cf-sw sig" /> getekend excl. btw</small></h2>
                <div className="cf-months">
                  {r.months.map((m) => (
                    <div key={m.month} className="cf-m">
                      <span className="cf-ml">{MONTHS[m.month - 1]}</span>
                      <span className="cf-bars">
                        {m.invoiced_incl > 0 && <span className="cf-bar inv" style={{ width: `${(m.invoiced_incl / top) * 100}%` }} title={`Gefactureerd ${fmtEur(m.invoiced_incl)}`} />}
                        {m.signed_excl > 0 && <span className="cf-bar sig" style={{ width: `${(m.signed_excl / top) * 100}%` }} title={`Getekend ${fmtEur(m.signed_excl)}`} />}
                      </span>
                      <span className="cf-mv">{m.invoiced_incl ? eur0(m.invoiced_incl) : ''}{m.signed_excl ? <small> · {eur0(m.signed_excl)}</small> : ''}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel cf-card">
                <h2>Doorlooptijd per stap <small>{r.durations_since ? `gemeten sinds ${new Date(r.durations_since).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'nog geen fasewissels'}</small></h2>
                <div className="cf-scroll"><table className="cf-table">
                  <thead><tr><th>Stap</th><th>Afgerond <small>mediaan</small></th><th>Nu bezig <small>gemiddeld</small></th></tr></thead>
                  <tbody>
                    {r.pipeline.map((s) => {
                      const d = r.durations.find((x) => x.stage === s.stage)
                      return (
                        <tr key={s.stage}>
                          <td>{s.label}</td>
                          <td>{d?.n_done ? <>{days(d.median_done)} <small className="muted">({d.n_done})</small></> : <span className="muted">—</span>}</td>
                          <td>{d?.n_now ? <>{days(d.avg_now)} <small className="muted">({d.n_now})</small></> : <span className="muted">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table></div>
              </section>
            </div>

            <section className="panel cf-card">
              <h2>Marge per project <small>uit de nacalculatie · excl. btw</small></h2>
              {r.margins.length === 0 ? <p className="muted">Nog geen project met een getekende offerte.</p> : (
                <div className="cf-scroll">
                  <table className="cf-table">
                    <thead><tr><th>Project</th><th className="num">Omzet</th><th className="num">Geplande marge</th><th className="num">Werkelijke marge</th></tr></thead>
                    <tbody>
                      {r.margins.map((m) => (
                        <tr key={m.code}>
                          <td><Link to={`/projecten/${encodeURIComponent(m.code)}?tab=nacalculatie`}>{m.code}</Link> {m.client ?? m.title ?? ''}</td>
                          <td className="num">{eur0(m.revenue_excl)}</td>
                          <td className="num">{eur0(m.margin_planned)}<small className="muted">{pct(m.margin_planned_pct)}</small></td>
                          <td className="num">{m.margin_actual == null ? <span className="muted">nog niet</span> : <>{eur0(m.margin_actual)}<small className="muted">{pct(m.margin_actual_pct)}</small></>}</td>
                        </tr>
                      ))}
                    </tbody>
                    {r.margins.length > 1 && (
                      <tfoot><tr><th>Totaal</th><th className="num">{eur0(r.margin_totals.revenue_excl)}</th><th className="num">{eur0(r.margin_totals.margin_planned)}<small>{pct(r.margin_totals.margin_planned_pct)}</small></th><th className="num">{eur0(r.margin_totals.margin_actual)}<small>{pct(r.margin_totals.margin_actual_pct)}</small></th></tr></tfoot>
                    )}
                  </table>
                </div>
              )}
            </section>
            <p className="muted cf-note">Bronnen: Yuki (bedragen incl. btw{r.money.last_sync ? `, opgehaald ${new Date(r.money.last_sync).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}), offertes en nacalculatie uit de app (excl. btw).</p>
          </>
        )}
      </div>
    </Section>
  )
}
