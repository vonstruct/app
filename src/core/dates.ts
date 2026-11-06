/**
 * Datums overal in het Europese formaat DD/MM/YYYY (Olivier, 6 nov 2026), ook in het portaal (nl, en, de).
 *
 * Eén centrale regel in plaats van elke plek apart: installEuropeanDates() (main.tsx) zorgt dat elke
 * date.toLocaleDateString(...) / date.toLocaleString(...) met een dag én een maand als DD/MM/YYYY verschijnt,
 * met de weekdag ervoor als die gevraagd was ("vr 13/11/2026") en het uur erachter als dat gevraagd was ("13/11/2026 14:30").
 * Enkel maand/jaar ("november 2026"), enkel weekdag ("ma") of enkel een uur blijven zoals ze waren.
 * Niet voor 'sv-SE' / 'en-CA': die gebruikt de code om een ISO-datum (YYYY-MM-DD) te maken.
 */
type Opts = Intl.DateTimeFormatOptions | undefined

const ISO_LOCALES = /^(sv|en-CA)/i
const localeOf = (l: unknown) => (typeof l === 'string' ? l : Array.isArray(l) ? String(l[0] ?? '') : '')

const pad = (n: string | undefined) => (n ?? '').padStart(2, '0')

/** DD/MM/YYYY (+ weekdag, + uur) voor een datum, in de tijdzone van de opties als die er is. */
function european(d: Date, locale: string, o: Opts, defaultTime: boolean): string | null {
  const opts = o ?? {}
  const none = !o || Object.keys(opts).filter((k) => k !== 'timeZone').length === 0
  const hasDay = 'day' in opts || 'dateStyle' in opts || none
  const hasMonth = 'month' in opts || 'dateStyle' in opts || none
  if (!hasDay || !hasMonth) return null
  const wantTime = 'hour' in opts || 'timeStyle' in opts || (none && defaultTime)
  const wantWeekday = 'weekday' in opts
  const lang = locale && !ISO_LOCALES.test(locale) ? locale : 'nl-BE'
  const parts = new Intl.DateTimeFormat(lang, {
    timeZone: opts.timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
    ...(wantWeekday ? { weekday: 'short' as const } : {}),
    ...(wantTime ? { hour: '2-digit' as const, minute: '2-digit' as const, hourCycle: 'h23' as const } : {}),
  }).formatToParts(d)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value
  let s = `${pad(get('day'))}/${pad(get('month'))}/${get('year')}`
  if (wantWeekday) s = `${get('weekday')?.replace(/\.$/, '')} ${s}`
  if (wantTime) s += ` ${pad(get('hour'))}:${pad(get('minute'))}`
  return s
}

let installed = false
export function installEuropeanDates() {
  if (installed) return
  installed = true
  const origDate = Date.prototype.toLocaleDateString
  const origStr = Date.prototype.toLocaleString
  Date.prototype.toLocaleDateString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    const l = localeOf(locales)
    if (!ISO_LOCALES.test(l) && !isNaN(this.getTime())) { const s = european(this, l, options, false); if (s) return s }
    return origDate.call(this, locales, options)
  }
  Date.prototype.toLocaleString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    const l = localeOf(locales)
    if (!ISO_LOCALES.test(l) && !isNaN(this.getTime())) { const s = european(this, l, options, true); if (s) return s }
    return origStr.call(this, locales, options)
  }
}

/** 'YYYY-MM-DD' (of ISO-tijd) → 'DD/MM/YYYY'; leeg blijft leeg. */
export function dmy(v: string | null | undefined): string {
  if (!v) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (m && v.length === 10) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : european(d, 'nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }, false) ?? ''
}

/** 'DD/MM/YYYY' (ook D/M/YY, met - of .) → 'YYYY-MM-DD', of null als het geen geldige datum is. Tijdens het typen enkel met 4 cijfers voor het jaar. */
export function parseDmy(s: string, allowShortYear = true): string | null {
  const m = (allowShortYear ? /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s*$/ : /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/).exec(s)
  if (!m) return null
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const mo = Number(m[2]), d = Number(m[1])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
