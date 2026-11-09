import { supabase } from '../../core/supabase'

/**
 * Zoeken in eigen artikels, prijslijsten en mails (RPC cost_search2). Eerst op artikelnummer (exact, of het begin vanaf 5 tekens;
 * punten, spaties en voorloopnullen tellen niet); niets gevonden = op tekst (elk getypt woord in naam of artikelnummer).
 * 9/11/2026, Olivier: "laten we default zoeken op het artikelnummer. en als 2de criteria als je niets vind, dan is het op basis van tekst".
 */
export const artNorm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+/, '')

export type SearchHow = 'artikel' | 'tekst'

export async function searchPrices<T extends { article_no: string | null }>(q: string, limit: number) {
  const { data, error } = await supabase.rpc('cost_search2', { p_q: q, p_limit: limit })
  const hits = (data ?? []) as T[]
  const a = artNorm(q)
  const how: SearchHow = a.length >= 3 && /[0-9]/.test(a) && hits.some((h) => artNorm(h.article_no).startsWith(a)) ? 'artikel' : 'tekst'
  return { hits, how, error }
}

/** korte uitleg onder de resultaten */
export function howText(how: SearchHow, q: string, n: number) {
  const a = artNorm(q)
  const looksLikeArticle = a.length >= 3 && /[0-9]/.test(a)
  if (how === 'artikel') return 'Gevonden op artikelnummer.'
  if (!n) return looksLikeArticle ? 'Niets gevonden op artikelnummer of tekst.' : 'Niets gevonden op tekst.'
  return looksLikeArticle ? 'Geen artikelnummer gevonden: gezocht op tekst.' : 'Gezocht op tekst.'
}
