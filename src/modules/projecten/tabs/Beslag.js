import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading } from '../../../core/ui';
const CAT = { LA: 'Lades', WB: 'Werkblad', SA: 'Sanitair', EL: 'Elektriciteit', TO: 'Toestellen', GR: 'Grepen', VA: 'Varia' };
export function Beslag({ dvId }) {
    const q = useQuery(() => supabase.from('app_items_summary').select('*').eq('design_version_id', dvId).neq('category', 'LA').order('qty', { ascending: false }), [dvId]);
    const q2 = useQuery(() => supabase.from('app_items_summary').select('*').eq('design_version_id', dvId).is('category', null).order('qty', { ascending: false }), [dvId]);
    if (q.loading || q2.loading)
        return _jsx(Loading, {});
    const rows = [...(q2.data ?? []), ...(q.data ?? [])];
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error || q2.error }), _jsx(DataTable, { rows: rows, columns: [
                    { key: 'category', label: 'Rubriek', value: (r) => (r.category ? CAT[r.category] ?? r.category : 'Beslag') },
                    { key: 'name', label: 'Artikel' },
                    { key: 'manufacturer', label: 'Fabrikant' },
                    { key: 'article_no', label: 'Artikelnummer', render: (r) => r.article_no ?? _jsx("span", { className: "badge warn", children: "ontbreekt" }) },
                    { key: 'qty', label: 'Aantal', align: 'right', total: true },
                ] })] }));
}
