import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading } from '../../../core/ui';
import { fmtMm } from '../../../core/format';
/** Kasten (catalogus ...\Kasten) en daaronder de andere objecten (plinten, paslatten, greeplijsten ...). Soort = regel in Supabase. */
export function Kasten({ dvId }) {
    const [all, setAll] = useState(false);
    const q = useQuery(() => supabase.from('app_cabinets').select('*').eq('design_version_id', dvId).order('name'), [dvId]);
    if (q.loading)
        return _jsx(Loading, {});
    const rows = q.data ?? [];
    const kasten = rows.filter((r) => r.kind === 'kast');
    const other = rows.filter((r) => r.kind !== 'kast');
    const cols = (withKind) => [
        ...(withKind ? [{ key: 'kind_label', label: 'Soort' }] : []),
        { key: 'name', label: withKind ? 'Object' : 'Kast' },
        { key: 'catalog_file', label: 'Catalogus' },
        { key: 'width_mm', label: 'Breedte (mm)', align: 'right', render: (r) => fmtMm(r.width_mm) },
        { key: 'depth_mm', label: 'Diepte (mm)', align: 'right', render: (r) => fmtMm(r.depth_mm) },
        { key: 'height_mm', label: 'Hoogte (mm)', align: 'right', render: (r) => fmtMm(r.height_mm) },
        { key: 'n_parts', label: 'Platen', align: 'right', total: true },
        { key: 'n_drawers', label: 'Lades', align: 'right', total: true },
        { key: 'n_items', label: 'Beslag', align: 'right', total: true },
    ];
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsx(DataTable, { rows: kasten, rowKey: (r) => r.id, columns: cols(false) }), _jsx("button", { className: "link", onClick: () => setAll(!all), children: all ? 'Andere objecten verbergen' : `Andere objecten tonen (${other.length}: plinten, paslatten, greeplijsten …)` }), all && _jsx(DataTable, { rows: other, rowKey: (r) => r.id, columns: cols(true) })] }));
}
