import logo from '../assets/vonstruct-logo.webp'

/** Pagina na een klik op "Bevestigen" in een mail (zonder inloggen). URL: #/actie?r=ok|al|oud|geannuleerd|fout&l=nl|en|de&p=sub|client */
const T = {
  nl: { ok: ['Bedankt, bevestigd!', 'We hebben je bevestiging goed ontvangen. Vonstruct en de andere betrokkenen krijgen een bericht.'], al: ['Al bevestigd', 'Dit moment had je al bevestigd. Je hoeft niets meer te doen.'], oud: ['Deze link is niet meer geldig', 'Het moment is intussen gewijzigd. Bekijk het nieuwe moment in de recentste mail of in je portaal.'], geannuleerd: ['Afspraak geannuleerd', 'Deze afspraak gaat niet door. Vonstruct neemt contact met je op.'], fout: ['Er ging iets mis', 'Deze link werkt niet. Log in op je portaal om te bevestigen.'], btn: 'Open mijn portaal', cal: 'Zet de afspraak in je agenda:', google: '📅 Google Agenda', apple: '📅 Apple / Outlook' },
  en: { ok: ['Thank you, confirmed!', 'We have received your confirmation. Vonstruct and the others involved will be notified.'], al: ['Already confirmed', 'You had already confirmed this time. Nothing else to do.'], oud: ['This link is no longer valid', 'The time has been changed in the meantime. Check the new time in the latest email or in your portal.'], geannuleerd: ['Appointment cancelled', 'This appointment is cancelled. Vonstruct will contact you.'], fout: ['Something went wrong', 'This link does not work. Sign in to your portal to confirm.'], btn: 'Open my portal', cal: 'Add the appointment to your calendar:', google: '📅 Google Calendar', apple: '📅 Apple / Outlook' },
  de: { ok: ['Danke, bestätigt!', 'Wir haben Ihre Bestätigung erhalten. Vonstruct und die anderen Beteiligten werden benachrichtigt.'], al: ['Bereits bestätigt', 'Sie hatten diesen Termin bereits bestätigt. Sie müssen nichts mehr tun.'], oud: ['Dieser Link ist nicht mehr gültig', 'Der Termin wurde inzwischen geändert. Den neuen Termin finden Sie in der letzten E-Mail oder in Ihrem Portal.'], geannuleerd: ['Termin abgesagt', 'Dieser Termin findet nicht statt. Vonstruct meldet sich bei Ihnen.'], fout: ['Etwas ist schiefgelaufen', 'Dieser Link funktioniert nicht. Melden Sie sich in Ihrem Portal an, um zu bestätigen.'], btn: 'Mein Portal öffnen', cal: 'Termin in Ihren Kalender eintragen:', google: '📅 Google Kalender', apple: '📅 Apple / Outlook' },
}

export function ActionResult() {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const l = (['nl', 'en', 'de'].includes(q.get('l') ?? '') ? q.get('l') : 'nl') as keyof typeof T
  const r = (['ok', 'al', 'oud', 'geannuleerd', 'fout'].includes(q.get('r') ?? '') ? q.get('r') : 'fout') as 'ok' | 'al' | 'oud' | 'geannuleerd' | 'fout'
  const [title, text] = T[l][r]
  const g = q.get('g'), ics = q.get('ics')
  const safe = (u: string | null, host: string) => { try { return u && new URL(u).hostname.endsWith(host) ? u : null } catch { return null } }
  const gUrl = safe(g, 'calendar.google.com'), icsUrl = safe(ics, 'supabase.co')
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-hero-top">
          <img className="auth-logo" src={logo} alt="Vonstruct" />
          <span className="auth-tagline">Custom interiors</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <header>
            <h2>{r === 'ok' || r === 'al' ? '✓ ' : ''}{title}</h2>
            <p className="muted">{text}</p>
          </header>
          {(gUrl || icsUrl) && (
            <div className="action-cal">
              <p className="muted small">{T[l].cal}</p>
              <div className="action-cal-btns">
                {gUrl && <a className="auth-alt action-btn" href={gUrl} target="_blank" rel="noreferrer">{T[l].google}</a>}
                {icsUrl && <a className="auth-alt action-btn" href={icsUrl}>{T[l].apple}</a>}
              </div>
            </div>
          )}
          <a className="primary auth-submit action-btn" href="#/" onClick={() => { window.location.hash = '#/'; window.location.reload() }}>{T[l].btn}</a>
        </div>
      </main>
    </div>
  )
}
