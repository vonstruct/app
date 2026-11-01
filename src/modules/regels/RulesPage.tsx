import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'

type Rule = { key: string; value: unknown; note: string | null }

/** Rekenregels die als gegevens in Supabase staan. Hier aanpassen = meteen geldig voor alle versies. */
export function RulesPage() {
  const q = useQuery<Rule[]>(() => supabase.from('drawer_rules').select('*').order('key'), [])
  return (
    <section>
      <h1>Regels</h1>
      <p className="muted">Lades: bestellengtes, standaard zijkant en Du Pont-artikels voor Movento-tabletlades. Productietarieven en plaatformaten volgen hier.</p>
      <ErrorBox error={q.error} />
      {q.loading ? <Loading /> : (q.data ?? []).map((r) => <RuleCard key={r.key} rule={r} onSaved={q.reload} />)}
    </section>
  )
}

function RuleCard({ rule, onSaved }: { rule: Rule; onSaved: () => void }) {
  const [text, setText] = useState(JSON.stringify(rule.value, null, 2))
  const [msg, setMsg] = useState<string | null>(null)
  const dirty = text !== JSON.stringify(rule.value, null, 2)

  const save = async () => {
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      return setMsg('Geen geldige invoer (JSON). Niets bewaard.')
    }
    const { error } = await supabase.from('drawer_rules').update({ value }).eq('key', rule.key)
    setMsg(error ? error.message : 'Bewaard.')
    if (!error) onSaved()
  }

  return (
    <div className="card rule">
      <div className="rule-head">
        <strong>{rule.key}</strong>
        <span className="muted">{rule.note}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(14, text.split('\n').length + 1)} spellCheck={false} />
      <div className="toolbar">
        <button className="primary" disabled={!dirty} onClick={save}>Bewaren</button>
        {dirty && <button onClick={() => setText(JSON.stringify(rule.value, null, 2))}>Annuleren</button>}
        {msg && <span className="muted">{msg}</span>}
      </div>
    </div>
  )
}
