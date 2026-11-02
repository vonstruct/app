import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading } from '../../../core/ui';
export function DuPont({ dvId }) {
    const q = useQuery(() => supabase.from('bom_drawer_dupont_lines').select('*').eq('design_version_id', dvId), [dvId]);
    if (q.loading)
        return _jsx(Loading, {});
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsx("p", { className: "muted", children: "Lade-onderdelen die apart bij Du Pont besteld worden (Movento-tabletlades). Regels: menu Regels." }), _jsx(DataTable, { rows: q.data ?? [], filter: false, empty: "Geen Du Pont-regels voor lades in deze versie", columns: [
                    { key: 'description', label: 'Omschrijving' },
                    { key: 'article_no', label: 'Artikelnummer' },
                    { key: 'qty', label: 'Aantal', align: 'right', total: true },
                ] })] }));
}
