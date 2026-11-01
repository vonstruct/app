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
