import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading } from '../../../core/ui';
import { fmtNum } from '../../../core/format';
export function Kanten({ dvId }) {
    const q = useQuery(() => supabase.from('bom_edges').select('*').eq('design_version_id', dvId).order('length_mm', { ascending: false }), [dvId]);
    if (q.loading)
        return _jsx(Loading, {});
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsx("p", { className: "muted", children: "Kantbreedte = plaatdikte (zweef en bestelbreedte 23/33/43 mm volgen in Supabase)." }), _jsx(DataTable, { rows: q.data ?? [], columns: [
                    { key: 'edge_label', label: 'Kantmateriaal' },
                    { key: 'edge_thickness_mm', label: 'Dikte (mm)', align: 'right', render: (r) => fmtNum(r.edge_thickness_mm) },
                    { key: 'board_thickness_mm', label: 'Plaatdikte (mm)', align: 'right', render: (r) => fmtNum(r.board_thickness_mm) },
                    { key: 'n_edges', label: 'Kanten', align: 'right', total: true },
                    { key: 'm', label: 'Lopende meter', align: 'right', total: true, value: (r) => Number(r.raw_length_mm) / 1000, render: (r) => fmtNum(Number(r.raw_length_mm) / 1000) },
                ] })] }));
}
