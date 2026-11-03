import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { EditableTable } from '../../core/EditableTable'
import { ErrorBox, Loading, Tabs } from '../../core/ui'
import { RuleSentence, type Rule } from './RuleSentence'
import { ruleTables } from './tables'

const SECTIONS = ['Bestellen', 'Platen', 'Plaatoptimalisatie', 'Kanten', 'Lades', 'Productiekosten', 'Prijzen', 'Kasten', 'Offerte', 'Facturen', 'Berichten', 'Checklist']

/** Alle rekenregels als zinnen en tabellen. Wat je hier wijzigt, geldt meteen voor alle berekeningen. */
export function RulesPage() {
  const [section, setSection] = useState(SECTIONS[0])
  const q = useQuery<Rule[]>(() => supabase.from('rule_settings').select('*').order('sort'), [])
  const rules = (q.data ?? []).filter((r) => r.section === section)
  const tables = ruleTables.filter((t) => t.section === section)
  return (
    <section>
      <h1>Regels</h1>
      <p className="muted">Pas een waarde aan en klik ernaast: ze wordt meteen bewaard en geldt voor alle projecten.</p>
      <Tabs tabs={SECTIONS.map((s) => ({ id: s, label: s }))} active={section} onChange={setSection} />
      <ErrorBox error={q.error} />
      {q.loading ? <Loading /> : rules.map((r) => <RuleSentence key={r.key} rule={r} />)}
      {tables.map((t) => (
        <div key={t.table}>
          <h2>{t.title}</h2>
          <p className="muted">{t.explanation}</p>
          <EditableTable table={t.table} columns={t.columns} orderBy={t.orderBy} newRow={t.newRow} />
        </div>
      ))}
    </section>
  )
}
