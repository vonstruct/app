import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { supabase } from '../../core/supabase';
import { useQuery } from '../../core/useQuery';
import { DataTable } from '../../core/DataTable';
import { ErrorBox, Loading } from '../../core/ui';
import { fmtNum } from '../../core/format';
/** Verschillen tussen twee versies: kasten, platen, kanten en beslag (alleen wat veranderde). */
export function Compare({ from, to }) {
    const ids = [from.id, to.id];
    const q = useQuery(async () => {
        const [cab, parts, edges, items] = await Promise.all([
            supabase.from('bom_cabinets').select('design_version_id, name').in('design_version_id', ids),
            supabase.from('app_parts_summary').select('design_version_id, material_label, thickness_mm, n_parts').in('design_version_id', ids),
            supabase.from('bom_edges').select('design_version_id, edge_label, edge_thickness_mm, board_thickness_mm, length_mm').in('design_version_id', ids),
            supabase.from('app_items_summary').select('design_version_id, name, article_no, qty').in('design_version_id', ids),
        ]);
        const err = cab.error || parts.error || edges.error || items.error;
        if (err)
            return { data: null, error: err };
        const map = new Map();
        const add = (group, item, unit, dv, n) => {
            const k = group + '|' + item;
            const l = map.get(k) ?? { group, item, unit, from: 0, to: 0 };
            if (dv === from.id)
                l.from += n;
            if (dv === to.id)
                l.to += n;
            map.set(k, l);
        };
        for (const r of cab.data ?? [])
            add('Kasten', r.name ?? '?', 'stuks', r.design_version_id, 1);
        for (const r of parts.data ?? [])
            add('Platen', `${r.material_label ?? '?'} ${fmtNum(r.thickness_mm)} mm`, 'onderdelen', r.design_version_id, Number(r.n_parts));
        for (const r of edges.data ?? [])
            add('Kanten', `${r.edge_label ?? '?'} ${fmtNum(r.edge_thickness_mm)} mm, plaat ${fmtNum(r.board_thickness_mm)} mm`, 'm', r.design_version_id, Number(r.length_mm) / 1000);
        for (const r of items.data ?? [])
            add('Beslag', `${r.name ?? '?'}${r.article_no ? ' (' + r.article_no + ')' : ''}`, 'stuks', r.design_version_id, Number(r.qty));
        const lines = [...map.values()].filter((l) => Math.abs(l.to - l.from) > 0.05);
        return { data: lines, error: null };
    }, [from.id, to.id]);
    if (q.loading)
        return _jsx(Loading, {});
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsx(DataTable, { rows: q.data ?? [], empty: `Geen verschillen tussen v${from.version} en v${to.version}`, columns: [
                    { key: 'group', label: 'Soort' },
                    { key: 'item', label: 'Wat' },
                    { key: 'from', label: `v${from.version}`, align: 'right', render: (r) => fmtNum(r.from) },
                    { key: 'to', label: `v${to.version}`, align: 'right', render: (r) => fmtNum(r.to) },
                    {
                        key: 'diff',
                        label: 'Verschil',
                        align: 'right',
                        value: (r) => r.to - r.from,
                        render: (r) => _jsxs("span", { className: r.to > r.from ? 'up' : 'down', children: [(r.to > r.from ? '+' : '') + fmtNum(r.to - r.from), " ", r.unit] }),
                    },
                ] })] }));
}
