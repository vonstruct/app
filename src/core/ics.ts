/** Agenda-bestand (.ics) maken en downloaden: werkt in Apple-, Google- en Outlook-agenda. Zelfde UID als de mails, dus geen dubbels. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const t = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function downloadIcs(o: { uid: string; start: string; end: string; slot?: string | null; summary: string; location?: string | null; description?: string }) {
  // meerdaagse hele dagen: één afspraak per dag
  const s = new Date(o.start), e = new Date(o.end)
  const days = o.slot === 'dag' ? Math.round((new Date(e.toDateString()).getTime() - new Date(s.toDateString()).getTime()) / 86400000) + 1 : 1
  const end = days > 1 ? new Date(s.getTime() + ((e.getTime() - s.getTime()) % 86400000)).toISOString() : o.end
  const lines = [
    'BEGIN:VCALENDAR', 'PRODID:-//Vonstruct//App//NL', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${o.uid}`, `DTSTAMP:${t(new Date().toISOString())}`, `DTSTART:${t(o.start)}`, `DTEND:${t(end)}`,
    ...(days > 1 ? [`RRULE:FREQ=DAILY;COUNT=${days}`] : []),
    `SUMMARY:${esc(o.summary)}`, ...(o.location ? [`LOCATION:${esc(o.location)}`] : []), `DESCRIPTION:${esc(o.description ?? 'https://app.vonstruct.com')}`,
    'URL:https://app.vonstruct.com/', 'END:VEVENT', 'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'vonstruct-afspraak.ics'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}
