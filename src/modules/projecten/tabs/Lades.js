import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading } from '../../../core/ui';
import { fmtMm } from '../../../core/format';
export function Lades({ dvId }) {
    const q = useQuery(() => supabase.from('app_drawers').select('*').eq('design_version_id', dvId).order('cabinet_name'), [dvId]);
    if (q.loading)
        return _jsx(Loading, {});
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsx("p", { className: "muted", children: "Bestellengte (NL): diepte \u2212 7 mm (Movento \u2212 26 mm), afgerond naar de standaardlengte eronder. Zijkant leeg = M bij hoogte D en C." }), _jsx(DataTable, { rows: q.data ?? [], rowKey: (r) => r.id, columns: [
                    { key: 'cabinet_name', label: 'Kast' },
                    { key: 'base_name', label: 'Lade' },
                    { key: 'soort', label: 'Soort' },
                    { key: 'hoogte', label: 'Hoogte' },
                    { key: 'zijkant', label: 'Zijkant' },
                    { key: 'tip_on', label: 'Tip-On' },
                    { key: 'inlegmat', label: 'Inlegmat' },
                    { key: 'size_x_mm', label: 'Breedte (mm)', align: 'right', render: (r) => fmtMm(r.size_x_mm) },
                    { key: 'nl_order', label: 'NL', align: 'right' },
                    { key: 'n_opvul', label: 'Opvullijsten', align: 'right', total: true },
                    { key: 'article_no', label: 'Artikel', render: (r) => r.article_no ?? (r.is_movento ? 'Du Pont-regels' : '') },
                ] })] }));
}
