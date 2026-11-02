import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from './supabase';
import { useQuery } from './useQuery';
import { ErrorBox, Loading } from './ui';
/** Tabel die je bewerkt als in Excel: klik in een cel, wijzig, klaar. Elke wijziging wordt meteen bewaard. */
export function EditableTable({ table, columns, orderBy = 'id', newRow = {}, empty = 'Nog niets ingevuld', focus, canAdd = true, canDelete = true }) {
    const q = useQuery(() => supabase.from(table).select('*').order(orderBy), [table]);
    const [msg, setMsg] = useState(null);
    const save = async (id, key, value) => {
        const { error } = await supabase.from(table).update({ [key]: value }).eq('id', id);
        setMsg(error ? error.message : 'Bewaard');
        if (error)
            q.reload();
    };
    const add = async () => {
        const { error } = await supabase.from(table).insert(newRow);
        if (error)
            setMsg(error.message);
        q.reload();
    };
    const remove = async (id) => {
        if (!window.confirm('Deze regel verwijderen?'))
            return;
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error)
            setMsg(error.message);
        q.reload();
    };
    if (q.loading)
        return _jsx(Loading, {});
    const rows = q.data ?? [];
    return (_jsxs("div", { className: "table-wrap editable", children: [_jsx(ErrorBox, { error: q.error }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [columns.map((c) => (_jsx("th", { style: c.width ? { width: c.width } : undefined, children: c.label }, c.key))), _jsx("th", { style: { width: 40 } })] }) }), _jsxs("tbody", { children: [rows.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: columns.length + 1, className: "muted", children: empty }) })), rows.map((r) => (_jsxs("tr", { className: focus && String(r.id) === focus.id ? 'focus-row' : undefined, children: [columns.map((c) => (_jsx("td", { children: _jsx(Cell, { col: c, value: r[c.key], onSave: (v) => save(r.id, c.key, v), autoFocus: !!focus && String(r.id) === focus.id && c.key === focus.key }) }, c.key))), _jsx("td", { children: canDelete && _jsx("button", { className: "link danger", title: "Verwijderen", onClick: () => remove(r.id), children: "\u2715" }) })] }, String(r.id))))] })] }), _jsxs("div", { className: "toolbar pad", children: [canAdd && _jsx("button", { onClick: add, children: "+ Regel toevoegen" }), msg && _jsx("span", { className: "muted", children: msg })] })] }));
}
function Cell({ col, value, onSave, autoFocus }) {
    const [v, setV] = useState(value == null ? '' : String(value));
    if (col.type === 'bool')
        return _jsx("input", { type: "checkbox", checked: value === true, onChange: (e) => onSave(e.target.checked) });
    if (col.type === 'select')
        return (_jsx("select", { value: v, onChange: (e) => { setV(e.target.value); onSave(e.target.value === '' ? null : e.target.value); }, children: (col.options ?? []).map((o) => _jsx("option", { value: o, children: o }, o)) }));
    if (col.type === 'textarea')
        return (_jsx("textarea", { className: "cell", rows: 4, autoFocus: autoFocus, value: v, placeholder: col.placeholder, onChange: (e) => setV(e.target.value), onBlur: () => { const orig = value == null ? '' : String(value); if (v !== orig)
                onSave(v.trim() === '' ? null : v); } }));
    const commit = () => {
        const orig = value == null ? '' : String(value);
        if (v === orig)
            return;
        if (col.type === 'number') {
            const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
            if (n !== null && Number.isNaN(n))
                return setV(orig);
            onSave(n);
        }
        else
            onSave(v.trim() === '' ? null : v);
    };
    return (_jsx("input", { className: "cell", autoFocus: autoFocus, ref: autoFocus ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined, inputMode: col.type === 'number' ? 'decimal' : undefined, value: col.type === 'number' ? v.replace('.', ',') : v, placeholder: col.placeholder, onChange: (e) => setV(col.type === 'number' ? e.target.value.replace(',', '.') : e.target.value), onBlur: commit, onKeyDown: (e) => { if (e.key === 'Enter')
            e.target.blur(); } }));
}
