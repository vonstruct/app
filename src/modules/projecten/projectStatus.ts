import { supabase } from '../../core/supabase'
import { useCallback, useEffect, useState } from 'react'
import type { ProjectRow } from '../../core/projects'
import type { Flag } from '../controltower/ControlTower'
import type { Gate, Timeline } from './KeyDates'

/**
 * Alle gegevens van de projectpagina in één verzoek: RPC project_page(p_code) in Supabase (6 nov 2026, snelheid).
 * Vroeger ±17 aparte views (elk opnieuw gepland); nu één plpgsql-functie met bewaarde plannen.
 * Daaruit ook: kerncijfers, de korte status bij elke stap in Ontwerp / Geld / Uitvoering en het aantal open punten per tabblad.
 */
export type Version = { id: string; version: number; received_at: string; exported_at: string | null; scene_title: string | null; n_cabinets: number; n_parts: number; n_errors: number; n_warnings: number }
export type CheckItem = { stage: string; stage_label: string; stage_sort: number; sort: number; template_id: number; label: string; automatic: boolean; done: boolean; done_at: string | null; done_by: string | null; na: boolean; skipped: boolean }
export type Template = { id: number; auto_rule: string | null; agenda_words: string | null }
export type PageOrder = { id: string; supplier: string; status: string; expected_at: string | null; delivered_at: string | null; ordered_by: string | null; urgency: string | null; auto_vervallen: boolean | null }
export type PagePartner = { id: string | null; partner: string; status: string; pickup_date: string | null; pickup_slot: string | null; pickup_answer: string | null; pickup_note: string | null; ready_at: string | null; picked_up_at: string | null }
export type PageTask = { id: string; text: string; due_date: string | null; kind: string | null }
export type Quote = { number: string | null; status: string; total_incl: number | null; margin_pct: number | null; external: boolean | null }
export type ProjectPage = {
  project: ProjectRow | null; versions: Version[]; timeline: Timeline | null; gates: Gate[]; checklist: CheckItem[]; templates: Template[]
  today: Flag[]; orders: PageOrder[]; partner: PagePartner | null; tasks: PageTask[]
  quotes: Quote[]; cost_groups: { cost: number; n_no_price: number; n_lines: number }[]; invoices: { amount_incl: number | null; paid_amount: number | null }[]
  ledger: { kind: string; amount: number }[]; jobs_ahead: number
}
export type ProjectNumbers = {
  quote: Quote | null
  cost: number; noPrice: number; nCost: number
  inv: number; paid: number; nInv: number
  orders: { n: number; toOrder: number; late: number; inside: number }
  partner: { status: string; pickup_date: string | null; ready_at: string | null; picked_up_at: string | null } | null
  jobsAhead: number
  /** open punten uit Vandaag per tabblad: { geld: { n, urgent } } */
  open: Record<string, { n: number; urgent: boolean }>
}

/** Bij welk tabblad (fase of Dossier) een punt uit Vandaag hoort (kind uit app_today). Onbekend = enkel op het Overzicht. */
const AREA: Record<string, string> = {
  survey_nieuw: 'aanvraag', survey_open: 'aanvraag',
  prijzen: 'ontwerp', kosten: 'ontwerp', stuklijst_fout: 'ontwerp', stuklijst_opm: 'ontwerp', optimalisatie: 'ontwerp',
  offerte: 'offerte', poort: 'offerte',
  factuur: 'voorbereiding', aankoopfactuur: 'voorbereiding', levertijd: 'voorbereiding', bestelling: 'voorbereiding', inkoop_docs: 'voorbereiding',
  partner: 'productie',
  opdracht: 'plaatsing', planning: 'plaatsing', oplevering: 'plaatsing', werkpunt: 'plaatsing', garantie: 'plaatsing', review: 'plaatsing', nacalculatie: 'plaatsing',
  mail_antwoord: 'dossier', mail: 'dossier',
}
const areaOf = (kind: string, title: string) =>
  kind === 'controle' ? (/^Bestelling/.test(title) ? 'voorbereiding' : 'offerte') : AREA[kind] ?? null

export function numbersOf(d: ProjectPage): ProjectNumbers {
  const rank = (s: string) => (s === 'aanvaard' ? 0 : s === 'verstuurd' ? 1 : s === 'concept' ? 2 : 3)
  const quote = [...d.quotes].sort((x, y) => rank(x.status) - rank(y.status))[0] ?? null
  const ords = d.orders.filter((x) => !x.auto_vervallen && x.urgency !== 'via partner') // wat de partner bestelt hoort bij Productie, niet bij Bestellingen
  const open: ProjectNumbers['open'] = {}
  for (const x of d.today) {
    const k = areaOf(x.kind, x.title)
    if (!k) continue
    open[k] = { n: (open[k]?.n ?? 0) + 1, urgent: (open[k]?.urgent ?? false) || x.prio === 1 }
  }
  // betaald: uit Yuki (enkel facturen die bij een offerte van het project of een factuur van de app horen), anders de facturen van de app
  const ledInv = d.ledger.filter((r) => r.kind !== 'betaling')
  return {
    quote,
    cost: d.cost_groups.reduce((s, g) => s + Number(g.cost ?? 0), 0), noPrice: d.cost_groups.reduce((s, g) => s + Number(g.n_no_price ?? 0), 0), nCost: d.cost_groups.reduce((s, g) => s + Number(g.n_lines ?? 0), 0),
    inv: ledInv.length ? ledInv.reduce((s, r) => s + Number(r.amount), 0) : d.invoices.reduce((s, i) => s + Number(i.amount_incl ?? 0), 0),
    paid: ledInv.length ? -d.ledger.filter((r) => r.kind === 'betaling').reduce((s, r) => s + Number(r.amount), 0) : d.invoices.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0),
    nInv: ledInv.length || d.invoices.length,
    orders: { n: ords.length, toOrder: ords.filter((x) => x.status === 'te bestellen').length, late: ords.filter((x) => /te laat/.test(x.urgency ?? '')).length, inside: ords.filter((x) => !!x.delivered_at).length },
    partner: d.partner,
    jobsAhead: d.jobs_ahead ?? 0,
    open,
  }
}

/**
 * Projectpagina: één verzoek (RPC project_page), onthouden per project (8/11/2026).
 * Een ander tabblad vraagt niets opnieuw op; terugkeren naar een project toont meteen wat er al was en ververst op de achtergrond
 * (als het ouder is dan VERS ms). Loopt er al een verzoek voor dit project, dan wordt dat hergebruikt (nooit twee tegelijk).
 * Vroeger: elk tabblad = nieuw verzoek; snel doorklikken gaf tot 15 zware verzoeken tegelijk en legde de database stil.
 */
type PageRes = { data: ProjectPage | null; error: { message: string } | null }
const VERS = 30_000
const pageCache = new Map<string, { data: ProjectPage; at: number }>()
const pageInflight = new Map<string, Promise<PageRes>>()
function loadPage(code: string, force: boolean): Promise<PageRes> {
  const cur = pageInflight.get(code)
  if (cur && !force) return cur
  // opnieuw laden na een wijziging terwijl er nog een verzoek loopt: daarna één keer, nooit tegelijk
  const start: Promise<unknown> = cur ? cur.then(() => undefined, () => undefined) : Promise.resolve()
  const p: Promise<PageRes> = start
    .then(() => supabase.rpc('project_page', { p_code: code }))
    .then(({ data, error }) => {
      if (data) pageCache.set(code, { data: data as ProjectPage, at: Date.now() })
      return { data: (data as ProjectPage | null) ?? null, error }
    }, (e: unknown) => ({ data: null, error: { message: String(e) } }))
    .finally(() => { if (pageInflight.get(code) === p) pageInflight.delete(code) })
  pageInflight.set(code, p)
  return p
}
export function useProjectPage(code: string) {
  const cached = pageCache.get(code)
  const [data, setData] = useState<ProjectPage | null>(cached?.data ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cached)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let alive = true
    const c = pageCache.get(code)
    setData(c?.data ?? null)
    setLoading(!c)
    if (c && tick === 0 && Date.now() - c.at < VERS) return
    loadPage(code, tick > 0).then((r) => {
      if (!alive) return
      if (r.data) setData(r.data)
      setError(r.error ? r.error.message : null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [code, tick])
  return { data, error, loading, reload }
}
