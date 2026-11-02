import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../../core/supabase';
import { useQuery } from '../../core/useQuery';
import { EditableTable } from '../../core/EditableTable';
import { ErrorBox, Loading, Tabs } from '../../core/ui';
import { RuleSentence } from './RuleSentence';
import { ruleTables } from './tables';
const SECTIONS = ['Bestellen', 'Platen', 'Plaatoptimalisatie', 'Kanten', 'Lades', 'Productiekosten', 'Prijzen', 'Kasten', 'Berichten'];
/** Alle rekenregels als zinnen en tabellen. Wat je hier wijzigt, geldt meteen voor alle berekeningen. */
export function RulesPage() {
    const [section, setSection] = useState(SECTIONS[0]);
    const q = useQuery(() => supabase.from('rule_settings').select('*').order('sort'), []);
    const rules = (q.data ?? []).filter((r) => r.section === section);
    const tables = ruleTables.filter((t) => t.section === section);
    return (_jsxs("section", { children: [_jsx("h1", { children: "Regels" }), _jsx("p", { className: "muted", children: "Pas een waarde aan en klik ernaast: ze wordt meteen bewaard en geldt voor alle projecten." }), _jsx(Tabs, { tabs: SECTIONS.map((s) => ({ id: s, label: s })), active: section, onChange: setSection }), _jsx(ErrorBox, { error: q.error }), q.loading ? _jsx(Loading, {}) : rules.map((r) => _jsx(RuleSentence, { rule: r }, r.key)), tables.map((t) => (_jsxs("div", { children: [_jsx("h2", { children: t.title }), _jsx("p", { className: "muted", children: t.explanation }), _jsx(EditableTable, { table: t.table, columns: t.columns, orderBy: t.orderBy, newRow: t.newRow })] }, t.table)))] }));
}
