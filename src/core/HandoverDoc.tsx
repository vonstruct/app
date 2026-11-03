import logo from '../assets/vonstruct-logo.webp'
import type { Company } from './QuoteDoc'

/** Proces-verbaal van oplevering (zelfde huisstijl als de offerte). Gedeeld door beheer-app en klantenportaal. */
export type HLang = 'nl' | 'en' | 'de'
export type HDoc = { project_code: string; project_title?: string | null; client_name?: string | null; site?: string | null; date: string | null; text: string | null; notes?: string | null; warranty_months?: number | null }
export type HItem = { title: string; description?: string | null; due?: string | null }
export type HSig = { name: string; at: string; hash: string; png?: string | null; method?: string | null }

const T = {
  nl: { doc: 'Proces-verbaal van oplevering', project: 'Project', client: 'Klant', site: 'Werfadres', date: 'Datum van oplevering', warranty: 'Garantie', months: (n: number) => `${n} maanden vanaf de oplevering`, notes: 'Opmerkingen', items: 'Nog af te werken (werkpunten)', none: 'Geen werkpunten: alles is opgeleverd.', due: 'tegen', sign: 'Voor akkoord (klant)', name: 'Naam', signDate: 'Datum', sig: 'Handtekening', signed: (n: string, d: string, m?: string | null) => `${m === 'ter plaatse' ? 'Ter plaatse' : 'Digitaal'} ondertekend door ${n} op ${d}`, proof: 'Vingerafdruk SHA-256' },
  en: { doc: 'Handover report', project: 'Project', client: 'Client', site: 'Site address', date: 'Handover date', warranty: 'Warranty', months: (n: number) => `${n} months from handover`, notes: 'Remarks', items: 'Still to be finished', none: 'No open items: everything has been handed over.', due: 'by', sign: 'Approved by the client', name: 'Name', signDate: 'Date', sig: 'Signature', signed: (n: string, d: string, m?: string | null) => `${m === 'ter plaatse' ? 'Signed on site' : 'Signed digitally'} by ${n} on ${d}`, proof: 'Fingerprint SHA-256' },
  de: { doc: 'Abnahmeprotokoll', project: 'Projekt', client: 'Kunde', site: 'Baustelle', date: 'Abnahmedatum', warranty: 'Garantie', months: (n: number) => `${n} Monate ab der Abnahme`, notes: 'Bemerkungen', items: 'Noch zu erledigen', none: 'Keine offenen Punkte: alles wurde übergeben.', due: 'bis', sign: 'Einverstanden (Kunde)', name: 'Name', signDate: 'Datum', sig: 'Unterschrift', signed: (n: string, d: string, m?: string | null) => `${m === 'ter plaatse' ? 'Vor Ort' : 'Digital'} unterschrieben von ${n} am ${d}`, proof: 'Fingerabdruck SHA-256' },
}
const loc = (l: HLang) => (l === 'de' ? 'de-DE' : l === 'en' ? 'en-GB' : 'nl-BE')
const day = (d: string | null | undefined, l: HLang) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString(loc(l), { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

export function HandoverDoc({ h, items, company, lang = 'nl', signature }: { h: HDoc; items: HItem[]; company: Company; lang?: HLang; signature?: HSig | null }) {
  const t = T[lang]
  return (
    <article className="qdoc">
      <header className="qdoc-head">
        <div><img src={logo} alt="Vonstruct" className="qdoc-logo" /><h1>{t.doc.toUpperCase()}</h1></div>
        <dl className="qdoc-co">
          <dt className="qdoc-co-name">{company.naam ?? 'Vonstruct Commv'}</dt>
          {company.kbo && <><dt>KBO:</dt><dd>{company.kbo}</dd></>}
          {company.btw && <><dt>Btw:</dt><dd>{company.btw}</dd></>}
          <span className="qdoc-print">{company.adres && <dd className="qdoc-co-wide">{company.adres}</dd>}{(company.telefoon || company.email) && <dd className="qdoc-co-wide">{[company.telefoon, company.email].filter(Boolean).join(' · ')}</dd>}</span>
        </dl>
      </header>
      <section className="qdoc-meta">
        <dl>
          <dt>{t.project}</dt><dd>{h.project_code}{h.project_title ? ' · ' + h.project_title : ''}</dd>
          <dt>{t.client}</dt><dd>{h.client_name ?? '—'}</dd>
          {h.site && <><dt>{t.site}</dt><dd>{h.site}</dd></>}
          <dt>{t.date}</dt><dd>{day(h.date, lang)}</dd>
          <dt>{t.warranty}</dt><dd>{t.months(h.warranty_months ?? 24)}</dd>
        </dl>
      </section>
      {h.text && <p className="qdoc-text">{h.text}</p>}
      {h.notes && <><h2 className="qdoc-title">{t.notes}</h2><p className="qdoc-text">{h.notes}</p></>}
      <h2 className="qdoc-title">{t.items}</h2>
      {items.length ? (
        <ol className="hdoc-items">{items.map((i, k) => <li key={k}><b>{i.title}</b>{i.description && <span> — {i.description}</span>}{i.due && <small> ({t.due} {day(i.due, lang)})</small>}</li>)}</ol>
      ) : <p className="qdoc-text">{t.none}</p>}
      <section className="qdoc-sign">
        {signature
          ? <div className="qdoc-sigbox">{signature.png && <img src={signature.png} alt="" />}<div><b>{t.signed(signature.name, new Date(signature.at).toLocaleString(loc(lang), { timeZone: 'Europe/Brussels', dateStyle: 'long', timeStyle: 'short' }), signature.method)}</b><small>{t.proof}: {signature.hash}</small></div></div>
          : <><b>{t.sign}</b><div className="qdoc-sign-row"><span>{t.name}</span><span>{t.signDate}</span><span>{t.sig}</span></div></>}
      </section>
      <footer className="qdoc-foot"><span>{company.adres}</span><span>{company.web}</span><span>{company.telefoon}</span><span>{company.email}</span></footer>
    </article>
  )
}
