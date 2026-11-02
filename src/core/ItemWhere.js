import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { fmtNum } from './format';
/** Knopje "Waar?" bij een artikel: in welke kast(en) het zit, hoeveel, uit welke bibliotheek. */
export function ItemWhere({ dvId, name }) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState(null);
    const ref = useRef(null);
    useEffect(() => {
        if (!open || rows)
            return;
        supabase.from('app_item_locations').select('*').eq('design_version_id', dvId).eq('name', name).order('cabinet')
            .then(({ data }) => setRows(data ?? []));
    }, [open, rows, dvId, name]);
    useEffect(() => {
        if (!open)
            return;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);
    const total = (rows ?? []).reduce((s, r) => s + Number(r.qty), 0);
    const first = rows?.[0];
    return (_jsxs("span", { className: "where", ref: ref, children: [_jsx("button", { type: "button", className: "where-btn", title: "Waar zit dit?", onClick: () => setOpen(!open), children: "Waar?" }), open && (_jsxs("div", { className: "where-pop", children: [_jsx("strong", { children: name }), rows === null ? (_jsx("p", { className: "muted", children: "Laden\u2026" })) : rows.length === 0 ? (_jsx("p", { className: "muted", children: "Niet als los artikel in de stuklijst gevonden (komt uit een regel, bv. bij de lades)." })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "muted", children: [[first?.manufacturer, first?.article_no].filter(Boolean).join(' · '), first?.size_x_mm != null && ` · ${fmtNum(first.size_x_mm)} × ${fmtNum(first.size_y_mm)} × ${fmtNum(first.size_z_mm)} mm`] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Kast" }), _jsx("th", { className: "num", children: "Aantal" })] }) }), _jsx("tbody", { children: rows.map((r) => (_jsxs("tr", { children: [_jsx("td", { children: r.cabinet }), _jsx("td", { className: "num", children: fmtNum(r.qty, 2) })] }, r.cabinet))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsxs("td", { children: [rows.length, " kast", rows.length === 1 ? '' : 'en'] }), _jsx("td", { className: "num", children: fmtNum(total, 2) })] }) })] }), [...new Set(rows.map((r) => r.cabinet_library).filter(Boolean))].map((l) => (_jsxs("p", { className: "muted small", children: ["Bibliotheek: ", l] }, l)))] }))] }))] }));
}
