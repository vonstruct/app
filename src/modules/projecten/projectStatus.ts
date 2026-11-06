import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'

/**
 * Cijfers en status van één project, één keer opgehaald voor de projectpagina: kerncijfers op het Overzicht,
 * de korte status bij elke stap in Ontwerp / Geld / Uitvoering, en het aantal open punten per tabblad (uit app_today).
 */
export type Quote = { number: string | null; status: string; total_incl: number | null; margin_pct: number | null; external: boolean | null }
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

/** Bij welk tabblad een punt uit Vandaag hoort (kind uit app_today). Onbekend = enkel op het Overzicht. */
const AREA: Record<string, string> = {
  prijzen: 'geld', kosten: 'geld', offerte: 'geld', factuur: 'geld', nacalculatie: 'geld', aankoopfactuur: 'geld',
  levertijd: 'uitvoering', bestelling: 'uitvoering', partner: 'uitvoering', opdracht: 'uitvoering', inkoop_docs: 'uitvoering',
  oplevering: 'uitvoering', werkpunt: 'uitvoering', garantie: 'uitvoering', review: 'uitvoering', planning: 'uitvoering',
  stuklijst_fout: 'ontwerp', stuklijst_opm: 'ontwerp', optimalisatie: 'ontwerp', survey_nieuw: 'ontwerp', survey_open: 'ontwerp',
  mail_antwoord: 'dossier', mail: 'dossier',
}
const areaOf = (kind: string, title: string) =>
  kind === 'controle' ? (/^Bestelling/.test(title) ? 'uitvoering' : 'geld') : AREA[kind] ?? null

export function useProjectNumbers(code: string, rev: unknown = null) {
  return useQuery<ProjectNumbers>(async () => {
    const [a, b, c, o, p, j, f, y] = await Promise.all([
      supabase.from('app_quotes').select('number,status,total_incl,margin_pct,external,created_at').eq('project_code', code).order('created_at', { ascending: false }),
      supabase.from('app_project_cost_groups').select('cost,n_no_price,n_lines').eq('project_code', code),
      supabase.from('app_invoices').select('amount_incl,paid_amount').eq('project_code', code),
      supabase.from('app_orders').select('status,urgency,delivered_at,auto_vervallen').eq('project_code', code).neq('status', 'geannuleerd'),
      supabase.from('app_partner_orders').select('status,pickup_date,ready_at,picked_up_at').eq('project_code', code).limit(1),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('project_code', code).neq('status', 'geannuleerd').gt('end_at', new Date().toISOString()),
      supabase.from('app_today').select('kind,title,prio,category').eq('project_code', code).neq('category', 'systeem'),
      supabase.from('app_client_ledger').select('kind,amount').eq('project_code', code),
    ])
    const rank = (s: string) => (s === 'aanvaard' ? 0 : s === 'verstuurd' ? 1 : s === 'concept' ? 2 : 3)
    const quote = [...((a.data ?? []) as Quote[])].sort((x, y) => rank(x.status) - rank(y.status))[0] ?? null
    const groups = (b.data ?? []) as { cost: number; n_no_price: number; n_lines: number }[]
    const inv = (c.data ?? []) as { amount_incl: number | null; paid_amount: number | null }[]
    // betaald: uit Yuki (enkel facturen die bij een opgeladen offerte of een factuur van de app horen, app_client_ledger), anders de facturen van de app
    const led = (y.data ?? []) as { kind: string; amount: number }[]
    const ledInv = led.filter((r) => r.kind !== 'betaling')
    const ords = ((o.data ?? []) as { status: string; urgency: string | null; delivered_at: string | null; auto_vervallen: boolean | null }[]).filter((x) => !x.auto_vervallen)
    const open: ProjectNumbers['open'] = {}
    for (const x of (f.data ?? []) as { kind: string; title: string; prio: number }[]) {
      const k = areaOf(x.kind, x.title)
      if (!k) continue
      open[k] = { n: (open[k]?.n ?? 0) + 1, urgent: (open[k]?.urgent ?? false) || x.prio === 1 }
    }
    return {
      data: {
        quote,
        cost: groups.reduce((s, g) => s + Number(g.cost ?? 0), 0), noPrice: groups.reduce((s, g) => s + Number(g.n_no_price ?? 0), 0), nCost: groups.reduce((s, g) => s + Number(g.n_lines ?? 0), 0),
        inv: ledInv.length ? ledInv.reduce((s, r) => s + Number(r.amount), 0) : inv.reduce((s, i) => s + Number(i.amount_incl ?? 0), 0),
        paid: ledInv.length ? -led.filter((r) => r.kind === 'betaling').reduce((s, r) => s + Number(r.amount), 0) : inv.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0),
        nInv: ledInv.length || inv.length,
        orders: { n: ords.length, toOrder: ords.filter((x) => x.status === 'te bestellen').length, late: ords.filter((x) => /te laat/.test(x.urgency ?? '')).length, inside: ords.filter((x) => !!x.delivered_at).length },
        partner: ((p.data ?? []) as ProjectNumbers['partner'][])[0] ?? null,
        jobsAhead: j.count ?? 0,
        open,
      },
      error: a.error ?? b.error ?? c.error ?? o.error ?? p.error ?? f.error,
    }
  }, [code, rev])
}
