import logo from '../assets/vonstruct-logo.webp'

/**
 * De offerte zoals de klant ze ziet (zelfde opbouw als OFF00): zwarte kop met logo en bedrijfsgegevens,
 * referentie/datums/klant, regels (omschrijving, aantal, prijs excl., korting, bedrag), totalen per btw-tarief.
 * Gedeeld door de beheer-app (voorbeeld/afdrukken) en het klantenportaal. Toont nooit kostprijs of marge.
 */
export type QLang = 'nl' | 'en' | 'de'
export type QLine = { title: string; description: string | null; qty: number; unit_price: number; discount_pct: number; vat_rate: number; kind?: string | null }
export type QDoc = {
  number: string | null; title: string | null; doc_date: string | null; valid_until: string | null; client_name: string | null; client_address: string | null
  intro?: string | null; closing?: string | null; included?: string | null; excluded?: string | null; planning?: string | null; payment?: string | null; warranty?: string | null
  show_groups?: boolean | null; project_code?: string | null; project_title?: string | null; site?: string | null; status?: string | null; accepted_at?: string | null; accepted_name?: string | null
}
export type Company = { naam?: string; adres?: string; kbo?: string; btw?: string; bank?: string; web?: string; telefoon?: string; email?: string }

export const QT = {
  nl: { doc: 'Offerte', ref: 'Referentie', date: 'Documentdatum', valid: 'Vervaldatum', to: 'Aan', desc: 'Omschrijving', qty: 'Aantal', price: 'Prijs excl. btw', disc: 'Korting', amount: 'Bedrag excl. btw', excl: 'Totaal excl. btw', vat: (r: number) => `${r}% Btw`, total: 'Totaal', page: 'Pagina', bank: 'Bank', vatNo: 'Btw' , project: 'Project', site: 'Werfadres', subtotal: 'Subtotaal', know: 'Goed om te weten', inc: 'Inbegrepen', exc: 'Niet inbegrepen', plan: 'Planning', pay: 'Betaling', war: 'Garantie', vat6: 'Btw 6 %', sign: 'Voor akkoord', signName: 'Naam', signDate: 'Datum', signSig: 'Handtekening', signedOnline: (n: string, d: string) => `Online aanvaard door ${n} op ${d}`, groups: { maatwerk: 'Maatwerk', toestel: 'Toestellen', sanitair: 'Sanitair', dienst: 'Ontwerp, plaatsing en transport', vrij: 'Overige' } as Record<string, string> },
  en: { doc: 'Quotation', ref: 'Reference', date: 'Date', valid: 'Valid until', to: 'To', desc: 'Description', qty: 'Qty', price: 'Price excl. VAT', disc: 'Discount', amount: 'Amount excl. VAT', excl: 'Total excl. VAT', vat: (r: number) => `${r}% VAT`, total: 'Total', page: 'Page', bank: 'Bank', vatNo: 'VAT' , project: 'Project', site: 'Site address', subtotal: 'Subtotal', know: 'Good to know', inc: 'Included', exc: 'Not included', plan: 'Planning', pay: 'Payment', war: 'Warranty', vat6: 'VAT 6 %', sign: 'For approval', signName: 'Name', signDate: 'Date', signSig: 'Signature', signedOnline: (n: string, d: string) => `Accepted online by ${n} on ${d}`, groups: { maatwerk: 'Custom furniture', toestel: 'Appliances', sanitair: 'Sanitary', dienst: 'Design, installation and transport', vrij: 'Other' } as Record<string, string> },
  de: { doc: 'Angebot', ref: 'Referenz', date: 'Datum', valid: 'Gültig bis', to: 'An', desc: 'Beschreibung', qty: 'Menge', price: 'Preis exkl. MwSt.', disc: 'Rabatt', amount: 'Betrag exkl. MwSt.', excl: 'Summe exkl. MwSt.', vat: (r: number) => `${r}% MwSt.`, total: 'Gesamt', page: 'Seite', bank: 'Bank', vatNo: 'USt-IdNr.' , project: 'Projekt', site: 'Baustelle', subtotal: 'Zwischensumme', know: 'Gut zu wissen', inc: 'Inbegriffen', exc: 'Nicht inbegriffen', plan: 'Planung', pay: 'Zahlung', war: 'Garantie', vat6: 'MwSt. 6 %', sign: 'Einverstanden', signName: 'Name', signDate: 'Datum', signSig: 'Unterschrift', signedOnline: (n: string, d: string) => `Online angenommen von ${n} am ${d}`, groups: { maatwerk: 'Maßanfertigung', toestel: 'Geräte', sanitair: 'Sanitär', dienst: 'Entwurf, Montage und Transport', vrij: 'Sonstiges' } as Record<string, string> },
}
const loc = (l: QLang) => (l === 'de' ? 'de-DE' : l === 'en' ? 'en-GB' : 'nl-BE')
const num = (v: number, l: QLang) => Number(v).toLocaleString(loc(l), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eur = (v: number, l: QLang) => '€ ' + num(v, l)
const day = (d: string | null) => (d ? d.split('-').reverse().join('-') : '—')
export const lineAmount = (l: QLine) => Math.round(Number(l.qty) * Number(l.unit_price) * (1 - Number(l.discount_pct) / 100) * 100) / 100

export function quoteTotals(lines: QLine[]) {
  const by = new Map<number, number>()
  for (const l of lines) by.set(Number(l.vat_rate), (by.get(Number(l.vat_rate)) ?? 0) + lineAmount(l))
  const excl = [...by.values()].reduce((a, b) => a + b, 0)
  const vats = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([rate, base]) => ({ rate, base, vat: Math.round(base * rate) / 100 }))
  const vat = vats.reduce((a, v) => a + v.vat, 0)
  return { excl, vats, vat, incl: excl + vat }
}

const GROUP: Record<string, string> = { kasten: 'maatwerk', lades: 'maatwerk', werkblad: 'maatwerk', maatwerk: 'maatwerk', toestel: 'toestel', sanitair: 'sanitair', dienst: 'dienst' }
const ORDER = ['maatwerk', 'toestel', 'sanitair', 'vrij', 'dienst']
const groupOf = (l: QLine) => GROUP[l.kind ?? ''] ?? 'vrij'

export function QuoteDoc({ q, lines, company, lang = 'nl', btw6 }: { q: QDoc; lines: QLine[]; company: Company; lang?: QLang; btw6?: string | null }) {
  const t = QT[lang]
  const tot = quoteTotals(lines)
  // per rubriek (enkel als er meer dan één rubriek is)
  const groups = ORDER.map((g) => ({ g, ls: lines.filter((l) => groupOf(l) === g) })).filter((x) => x.ls.length)
  const grouped = q.show_groups !== false && groups.length > 1
  const blocks: [string, string | null | undefined][] = [[t.inc, q.included], [t.exc, q.excluded], [t.plan, q.planning], [t.pay, q.payment], [t.war, q.warranty]]
  const has6 = lines.some((l) => Number(l.vat_rate) === 6) && !!btw6
  const row = (l: QLine, i: number) => (
    <tr key={i}>
      <td><div className="qdoc-lt">{l.title}</div>{l.description && <div className="qdoc-ld">{l.description}</div>}</td>
      <td className="n">{num(l.qty, lang)}</td>
      <td className="n">{num(l.unit_price, lang)}</td>
      <td className="n">{Number(l.discount_pct) ? num(l.discount_pct, lang) + '%' : ''}</td>
      <td className="n">{num(lineAmount(l), lang)}</td>
    </tr>
  )
  return (
    <article className="qdoc">
      <header className="qdoc-head">
        <div>
          <img src={logo} alt="Vonstruct" className="qdoc-logo" />
          <h1>{t.doc.toUpperCase()}</h1>
        </div>
        <dl className="qdoc-co">
          <dt className="qdoc-co-name">{company.naam ?? 'Vonstruct Commv'}</dt>
          {company.kbo && <><dt>KBO:</dt><dd>{company.kbo}</dd></>}
          {company.btw && <><dt>{t.vatNo}:</dt><dd>{company.btw}</dd></>}
          {company.bank && <><dt>{t.bank}:</dt><dd>{company.bank}</dd></>}
          <span className="qdoc-print">
            {company.adres && <dd className="qdoc-co-wide">{company.adres}</dd>}
            {(company.telefoon || company.email) && <dd className="qdoc-co-wide">{[company.telefoon, company.email, company.web].filter(Boolean).join(' · ')}</dd>}
          </span>
        </dl>
      </header>
      <section className="qdoc-meta">
        <dl>
          <dt>{t.ref}</dt><dd>{q.number ?? '—'}</dd>
          <dt>{t.date}</dt><dd>{day(q.doc_date)}</dd>
          <dt>{t.valid}</dt><dd>{day(q.valid_until)}</dd>
        </dl>
        <div className="qdoc-to">
          <small>{t.to}</small>
          <b>{q.client_name}</b>
          {(q.client_address ?? '').split('\n').map((r, i) => <span key={i}>{r}</span>)}
        </div>
      </section>
      {q.title && <h2 className="qdoc-title">{q.title}</h2>}
      {(q.project_code || q.site) && <p className="qdoc-proj">{q.project_code && <>{t.project} {q.project_code}{q.project_title ? ' · ' + q.project_title : ''}</>}{q.site && <>{q.project_code ? ' · ' : ''}{t.site}: {q.site}</>}</p>}
      {q.intro && <p className="qdoc-text">{q.intro}</p>}
      <table className="qdoc-lines">
        <thead><tr><th>{t.desc}</th><th className="n">{t.qty}</th><th className="n">{t.price}</th><th className="n">{t.disc}</th><th className="n">{t.amount}</th></tr></thead>
        {grouped ? groups.map(({ g, ls }) => (
          <tbody key={g} className="qdoc-group">
            <tr className="qdoc-gh"><td colSpan={5}>{t.groups[g]}</td></tr>
            {ls.map(row)}
            <tr className="qdoc-sub"><td colSpan={4}>{t.subtotal} {t.groups[g].toLowerCase()}</td><td className="n">{num(ls.reduce((a, l) => a + lineAmount(l), 0), lang)}</td></tr>
          </tbody>
        )) : <tbody>{lines.map(row)}</tbody>}
      </table>
      <table className="qdoc-tot">
        <tbody>
          <tr><td>{t.excl}</td><td>{eur(tot.excl, lang)}</td></tr>
          {tot.vats.map((v) => <tr key={v.rate}><td>{t.vat(v.rate)}</td><td>{eur(v.vat, lang)}</td></tr>)}
          <tr className="qdoc-grand"><td>{t.total}</td><td>{eur(tot.incl, lang)}</td></tr>
        </tbody>
      </table>
      {q.closing && <p className="qdoc-text">{q.closing}</p>}
      {(blocks.some(([, v]) => v) || has6) && (
        <section className="qdoc-know">
          <h3>{t.know}</h3>
          <div className="qdoc-know-grid">
            {blocks.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><b>{k}</b>{k === t.inc || k === t.exc ? <ul>{(v ?? '').split('\n').filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>{v}</p>}</div>
            ))}
            {has6 && <div><b>{t.vat6}</b><p>{btw6}</p></div>}
          </div>
        </section>
      )}
      <section className="qdoc-sign">
        {q.status === 'aanvaard' && q.accepted_name
          ? <p className="qdoc-signed">✓ {t.signedOnline(q.accepted_name, day(q.accepted_at?.slice(0, 10) ?? null))}</p>
          : <><b>{t.sign}</b><div className="qdoc-sign-row"><span>{t.signName}</span><span>{t.signDate}</span><span>{t.signSig}</span></div></>}
      </section>
      <footer className="qdoc-foot">
        <span>{company.adres}</span><span>{company.web}</span><span>{company.telefoon}</span><span>{company.email}</span>
      </footer>
    </article>
  )
}

/** Offerte afdrukken of als PDF bewaren: zet de offerte alleen op het blad en opent het printvenster. */
export function printQuote() {
  document.body.classList.add('printing-quote')
  const done = () => { document.body.classList.remove('printing-quote'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  setTimeout(() => window.print(), 50)
}
