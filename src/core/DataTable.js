import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
/** Tabel met sorteren (klik op kop), zoekveld en optionele totalen. Wordt door elke module gebruikt. */
export function DataTable({ rows, columns, filter = true, empty = 'Geen gegevens', rowKey }) {
    const [sort, setSort] = useState(null);
    const [q, setQ] = useState('');
    const val = (c, r) => (c.value ? c.value(r) : r[c.key]);
    const shown = useMemo(() => {
        let out = rows;
        if (q.trim()) {
            const needle = q.trim().toLowerCase();
            out = out.filter((r) => columns.some((c) => String(val(c, r) ?? '').toLowerCase().includes(needle)));
        }
        if (sort) {
            const c = columns.find((x) => x.key === sort.key);
            if (c)
                out = [...out].sort((a, b) => {
                    const va = val(c, a), vb = val(c, b);
                    if (typeof va === 'number' && typeof vb === 'number')
                        return (va - vb) * sort.dir;
                    return String(va ?? '').localeCompare(String(vb ?? ''), 'nl', { numeric: true }) * sort.dir;
                });
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, q, sort, columns]);
    const hasTotals = columns.some((c) => c.total);
    return (_jsxs("div", { className: "table-wrap", children: [filter && rows.length > 8 && (_jsx("input", { className: "search", placeholder: "Zoeken\u2026", value: q, onChange: (e) => setQ(e.target.value) })), _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => (_jsxs("th", { className: c.align === 'right' ? 'num' : '', onClick: () => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) } : { key: c.key, dir: 1 })), children: [c.label, sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''] }, c.key))) }) }), _jsxs("tbody", { children: [shown.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "muted", children: empty }) })), shown.map((r, i) => (_jsx("tr", { children: columns.map((c) => (_jsx("td", { className: c.align === 'right' ? 'num' : '', children: c.render ? c.render(r) : String(val(c, r) ?? '') }, c.key))) }, rowKey ? rowKey(r, i) : i)))] }), hasTotals && shown.length > 0 && (_jsx("tfoot", { children: _jsx("tr", { children: columns.map((c, i) => (_jsx("td", { className: c.align === 'right' ? 'num' : '', children: c.total
                                    ? shown.reduce((s, r) => s + (Number(val(c, r)) || 0), 0).toLocaleString('nl-BE', { maximumFractionDigits: 1 })
                                    : i === 0
                                        ? 'Totaal'
                                        : '' }, c.key))) }) }))] })] }));
}
