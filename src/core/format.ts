const nl = 'nl-BE'

export const fmtInt = (v: unknown) => (v == null || v === '' ? '' : Math.round(Number(v)).toLocaleString(nl))
export const fmtNum = (v: unknown, d = 1) =>
  v == null || v === '' ? '' : Number(v).toLocaleString(nl, { minimumFractionDigits: 0, maximumFractionDigits: d })
export const fmtMm = (v: unknown) => (v == null || v === '' ? '' : `${fmtNum(v, 1)}`)
export const fmtM = (mm: unknown) => (mm == null ? '' : `${fmtNum(Number(mm) / 1000, 1)} m`)
export const fmtEur = (v: unknown) =>
  v == null || v === '' ? '' : Number(v).toLocaleString(nl, { style: 'currency', currency: 'EUR' })
export const fmtDate = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString(nl, { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const fmtYesNo = (v: unknown) => (v === true ? 'ja' : v === false ? 'nee' : '')

/**
 * Getal uit wat iemand typt (8/11/2026): komma óf punt als decimaalteken (een gsm-toetsenbord geeft soms enkel een punt),
 * spaties en € weg. Staan er beide tekens (1.234,56 of 1,234.56), dan is het laatste het decimaalteken; komt één teken
 * meer dan één keer voor (1.250.000), dan is het een duizendtal. Leeg = null, ongeldig = NaN.
 */
export function parseAmount(v: unknown): number | null {
  let s = String(v ?? '').replace(/[\s€]/g, '')
  if (s === '') return null
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.')
  if (lc >= 0 && ld >= 0) {
    const dec = lc > ld ? ',' : '.'
    s = s.split(dec === ',' ? '.' : ',').join('').replace(dec, '.')
  } else if (lc >= 0) {
    s = s.split(',').length > 2 ? s.split(',').join('') : s.replace(',', '.')
  } else if (ld >= 0 && s.split('.').length > 2) {
    s = s.split('.').join('')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
