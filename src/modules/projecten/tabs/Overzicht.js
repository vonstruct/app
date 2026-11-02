import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading, Stat } from '../../../core/ui';
import { fmtEur, fmtInt, fmtNum } from '../../../core/format';
/** Hoog niveau van een versie. De kostenposten (zoals Projectkosten in de stuklijst) komen hier zodra Supabase ze berekent. */
export function Overzicht({ dvId }) {
    const s = useQuery(() => supabase.from('app_version_summary').select('*').eq('design_version_id', dvId).single(), [dvId]);
    const c = useQuery(() => supabase.from('app_cost_summary').select('*').eq('design_version_id', dvId), [dvId]);
    const k = useQuery(() => supabase.from('app_cabinets').select('kind_label, kind_prio, name').eq('design_version_id', dvId), [dvId]);
    if (s.loading || k.loading)
        return _jsx(Loading, {});
    const d = s.data;
    const groups = new Map();
    for (const r of k.data ?? []) {
        const g = groups.get(r.kind_label) ?? { label: r.kind_label, prio: r.kind_prio, n: 0 };
        g.n++;
        groups.set(r.kind_label, g);
    }
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: s.error || k.error }), d && (_jsxs("div", { className: "stats", children: [_jsx(Stat, { label: "kasten", value: fmtInt(d.n_kasten) }), _jsx(Stat, { label: "lades", value: fmtInt(d.n_lades) }), _jsx(Stat, { label: "plaatonderdelen", value: fmtInt(d.n_platen_onderdelen) }), _jsx(Stat, { label: "m\u00B2 plaat (netto)", value: fmtNum(d.plaat_m2) }), _jsx(Stat, { label: "m kantenband", value: fmtNum(d.kant_m) }), _jsx(Stat, { label: "beslagartikelen", value: fmtInt(d.n_beslag) }), _jsx(Stat, { label: "werkbladdelen", value: fmtInt(d.n_werkbladen) })] })), _jsx("h2", { children: "Objecten in de tekening" }), _jsx(DataTable, { rows: [...groups.values()].sort((a, b) => a.prio - b.prio), filter: false, columns: [
                    { key: 'label', label: 'Soort' },
                    { key: 'n', label: 'Aantal', align: 'right', total: true },
                ] }), _jsx("h2", { children: "Projectkosten (kostprijs)" }), _jsx(DataTable, { rows: (c.data ?? []).sort((a, b) => a.sort - b.sort), filter: false, empty: "Nog niet berekend", columns: [
                    { key: 'category', label: 'Rubriek' },
                    { key: 'total', label: 'Totaal', align: 'right', total: true, value: (r) => Number(r.total), render: (r) => fmtEur(r.total) },
                    { key: 'n_missing', label: 'Opmerking', render: (r) => (r.n_missing ? _jsxs("span", { className: "warn-text", children: [r.n_missing, " zonder prijs"] }) : '') },
                ] })] }));
}
