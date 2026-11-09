import { useSearchParams } from 'react-router'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { EditableTable } from '../../core/EditableTable'
import { ErrorBox, Loading, Tabs } from '../../core/ui'
import { toast } from '../../core/toast'
import { RuleSentence, type Rule } from './RuleSentence'
import { ruleTables } from './tables'
import { PriceListUpload } from './PriceListUpload'
import { PriceLists } from './PriceLists'
import { PlateFamilies } from './PlateFamilies'

const SECTIONS = ['Bestellen', 'Platen', 'Plaatoptimalisatie', 'Kanten', 'Lades', 'Productiekosten', 'Prijzen', 'Kasten', 'Offerte', 'Facturen', 'Oplevering', 'Nacalculatie', 'Brochure', 'Capaciteit', 'Productie', 'Meldingen', 'Berichten', 'Checklist']
const REVIEW = 'Na te kijken'

/**
 * Alle rekenregels als zinnen en tabellen. Wat je hier wijzigt, geldt meteen voor alle berekeningen.
 * `?sectie=<naam>` opent meteen die sectie (links vanuit de rest van de app). Tab "Na te kijken" = regels met een
 * voorlopige waarde (kolom `confirmed_at` leeg): Olivier zet ze juist of klikt "Klopt". Een waarde wijzigen = nagekeken (trigger).
 */
export function RulesPage() {
  const [params, setParams] = useSearchParams()
  const q = useQuery<(Rule & { confirmed_at?: string | null })[]>(() => supabase.from('rule_settings').select('*').order('sort'), [])
  // confirmed_at === null = voorlopige waarde (undefined = kolom bestaat nog niet → niets tonen)
  const todo = (q.data ?? []).filter((r) => r.confirmed_at === null)
  const wanted = params.get('sectie')
  const section = wanted && (SECTIONS.includes(wanted) || (wanted === REVIEW && todo.length)) ? wanted : todo.length && !wanted ? REVIEW : SECTIONS[0]
  const setSection = (s: string) => setParams({ sectie: s }, { replace: true })
  const rules = section === REVIEW ? todo : (q.data ?? []).filter((r) => r.section === section)
  const tables = ruleTables.filter((t) => t.section === section)
  const confirm = async (key: string) => {
    const { error } = await supabase.from('rule_settings').update({ confirmed_at: new Date().toISOString() }).eq('key', key)
    if (error) toast(error.message, 'err'); else { toast('Nagekeken'); q.reload() }
  }
  const tabs = [...(todo.length ? [{ id: REVIEW, label: `${REVIEW} (${todo.length})` }] : []), ...SECTIONS.map((s) => ({ id: s, label: s }))]
  return (
    <section>
      <h1>Regels</h1>
      <p className="muted">Pas een waarde aan en klik ernaast: ze wordt meteen bewaard en geldt voor alle projecten.</p>
      <Tabs tabs={tabs} active={section} onChange={setSection} />
      <ErrorBox error={q.error} />
      {section === REVIEW && (
        <p className="notice">
          Deze waarden zijn voorlopig ingevuld (niet door jou). Zet ze juist, of klik <b>Klopt</b> als de waarde goed is. Een waarde wijzigen telt ook als nagekeken.
        </p>
      )}
      {section === 'Prijzen' && <><PriceLists /><PriceListUpload /></>}
      {q.loading ? <Loading /> : rules.map((r) => (
        <div key={r.key} className="rule-wrap">
          {section === REVIEW && <div className="small muted rule-sec">{r.section}</div>}
          <RuleSentence rule={r} />
          {r.confirmed_at === null && (
            <div className="rule-review small">
              <span className="muted">voorlopige waarde</span>
              <button className="link small" onClick={() => confirm(r.key)}>Klopt</button>
            </div>
          )}
        </div>
      ))}
      {section === 'Plaatoptimalisatie' && <PlateFamilies />}
      {tables.map((t) => (
        <div key={t.table}>
          <h2>{t.title}</h2>
          <p className="muted">{t.explanation}</p>
          <EditableTable table={t.table} columns={t.columns} orderBy={t.orderBy} newRow={t.newRow} keyField={t.keyField} canAdd={t.canAdd} canDelete={t.canDelete} empty={t.table === 'stock_articles' ? 'Nog niets op voorraad gezet.' : undefined} />
        </div>
      ))}
    </section>
  )
}
