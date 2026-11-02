import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { ErrorBox, Loading } from '../../../core/ui';
import { fmtEur, fmtNum } from '../../../core/format';
import { OwnArticleEditor } from '../../../core/OwnArticle';
import { ItemWhere } from '../../../core/ItemWhere';
export const COST_ORDER = ['Platen', 'Kanten', 'Lades', 'Werkbladen', 'Sanitair', 'Elektriciteit', 'Toestellen', 'Grepen', 'Verbinders & Beslagen', 'Varia', 'Zelf maken', 'Productiekosten'];
/** Regels waarvan je de prijs zelf kan invullen (beslag, rubrieken, losse Du Pont-onderdelen van lades). */
const editable = (l) => !['Platen', 'Kanten', 'Productiekosten'].includes(l.category) && (l.category !== 'Lades' || l.subgroup === 'Du Pont (apart bestellen)');
/** Eenheidsprijs die je aanklikt en wijzigt. Bewaard als eigen prijs: geldt ook voor alle volgende projecten. */
function PriceCell({ line, onSaved }) {
    const [edit, setEdit] = useState(false);
    const [val, setVal] = useState('');
    const missing = line.note?.startsWith('prijs ontbreekt');
    const start = () => {
        setVal(missing || line.unit_price == null ? '' : String(line.unit_price).replace('.', ','));
        setEdit(true);
    };
    const save = async () => {
        setEdit(false);
        const v = val.trim().replace(',', '.');
        if (v === '' || isNaN(Number(v)))
            return;
        if (!missing && Number(v) === Number(line.unit_price))
            return;
        const { error } = await supabase.rpc('set_manual_price', {
            p_article_no: line.article_no ?? '', p_description: line.description, p_supplier: line.supplier, p_price: Number(v),
        });
        onSaved(error ? error.message : `Prijs voor "${line.description}" bewaard. Geldt ook voor volgende projecten.`);
    };
    if (edit)
        return (_jsx("input", { autoFocus: true, className: "price-input", inputMode: "decimal", value: val, placeholder: "\u20AC per stuk", onChange: (e) => setVal(e.target.value), onBlur: save, onKeyDown: (e) => { if (e.key === 'Enter')
                e.target.blur(); if (e.key === 'Escape')
                setEdit(false); } }));
    return (_jsx("button", { type: "button", className: missing ? 'price-btn missing' : 'price-btn', onClick: start, title: "Prijs aanpassen", children: missing ? 'prijs invullen' : line.unit_price == null ? '' : fmtEur(line.unit_price) }));
}
/** Kostprijs per regel, zoals de tabbladen van de stuklijst. Berekend in Supabase/GitHub, hier alleen getoond. */
export function Kosten({ dvId }) {
    const q = useQuery(() => supabase.from('cost_lines').select('*').eq('design_version_id', dvId).order('sort'), [dvId]);
    const st = useQuery(() => supabase.from('design_versions').select('cost_status, cost_at').eq('id', dvId).single(), [dvId]);
    const [msg, setMsg] = useState(null);
    const [params] = useSearchParams();
    const focus = params.get('focus') === 'prijzen';
    const box = useRef(null);
    useEffect(() => { if (focus && q.data)
        box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [focus, q.data]);
    if (q.loading && !q.data)
        return _jsx(Loading, {});
    const lines = q.data ?? [];
    const cats = COST_ORDER.filter((c) => lines.some((l) => l.category === c));
    const total = lines.reduce((s, l) => s + Number(l.total), 0);
    const onSaved = (m) => { setMsg(m); q.reload(); };
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsxs("p", { className: "muted", children: ["Kostprijsberekening: ", st.data?.cost_status ?? 'nog niet berekend', ". Klik op een eenheidsprijs bij beslag om ze aan te passen."] }), msg && _jsx("p", { className: "notice", children: msg }), lines.some((l) => l.note?.startsWith('prijs ontbreekt')) && (_jsxs("div", { ref: box, className: 'todo-box' + (focus ? ' focus' : ''), children: [_jsxs("h2", { children: ["Zonder prijs ", _jsx("span", { className: "muted", children: lines.filter((l) => l.note?.startsWith('prijs ontbreekt')).length })] }), _jsxs("p", { className: "muted", children: ["Kies per artikel de herkomst en vul de prijs per stuk in. ", _jsx("strong", { children: "Bestellen" }), " = bij een leverancier,", ' ', _jsx("strong", { children: "Zelf maken" }), " = komt in de rubriek \"Zelf maken\" en niet op bestellijsten, ", _jsx("strong", { children: "Negeren" }), " = telt nergens mee. Het artikel wordt herkend op artikelnummer, of op naam als er geen nummer is, ook in volgende projecten."] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Omschrijving" }), _jsx("th", { children: "Leverancier" }), _jsx("th", { children: "Artikel" }), _jsx("th", { className: "num", children: "Aantal" }), _jsx("th", { children: "Herkomst en prijs per stuk" })] }) }), _jsx("tbody", { children: lines.filter((l) => l.note?.startsWith('prijs ontbreekt')).map((l) => (_jsxs("tr", { children: [_jsxs("td", { children: [l.description, " ", _jsx(ItemWhere, { dvId: dvId, name: l.description })] }), _jsx("td", { children: l.supplier }), _jsx("td", { children: l.article_no }), _jsx("td", { className: "num", children: l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}` }), _jsx("td", { children: _jsx(OwnArticleEditor, { articleNo: l.article_no, description: l.description, supplier: l.supplier, onSaved: onSaved }) })] }, l.id))) })] })] })), cats.map((c) => {
                const ls = lines.filter((l) => l.category === c);
                const subs = [...new Set(ls.map((l) => l.subgroup ?? ''))];
                const sum = ls.reduce((s, l) => s + Number(l.total), 0);
                return (_jsxs("div", { children: [_jsxs("h2", { children: [c, " ", _jsx("span", { className: "muted", children: fmtEur(sum) })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Omschrijving" }), _jsx("th", { children: "Leverancier" }), _jsx("th", { children: "Artikel" }), _jsx("th", { className: "num", children: "Aantal" }), _jsx("th", { className: "num", children: "Eenheidsprijs" }), _jsx("th", { className: "num", children: "Totaal" }), _jsx("th", { children: "Besteld door" }), _jsx("th", { children: "Opmerking" })] }) }), _jsx("tbody", { children: subs.map((s) => (_jsxs(Fragment, { children: [s && (_jsx("tr", { className: "subhead", children: _jsx("td", { colSpan: 8, children: s }) })), ls.filter((l) => (l.subgroup ?? '') === s).map((l) => (_jsxs("tr", { children: [_jsxs("td", { children: [l.description, !['Platen', 'Kanten', 'Productiekosten'].includes(l.category) && _jsxs(_Fragment, { children: [" ", _jsx(ItemWhere, { dvId: dvId, name: l.description })] })] }), _jsx("td", { children: l.supplier }), _jsx("td", { children: l.article_no }), _jsx("td", { className: "num", children: l.qty == null ? '' : `${fmtNum(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}` }), _jsx("td", { className: "num", children: editable(l) ? _jsx(PriceCell, { line: l, onSaved: onSaved }) : l.unit_price == null ? '' : fmtEur(l.unit_price) }), _jsx("td", { className: "num", children: fmtEur(l.total) }), _jsx("td", { children: l.ordered_by }), _jsx("td", { className: l.note?.startsWith('prijs ontbreekt') ? 'warn-text' : l.note === 'eigen prijs' || l.note === 'zelf maken' ? 'ok-text' : 'muted', children: l.note })] }, l.id)))] }, s))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsxs("td", { colSpan: 5, children: ["Totaal ", c] }), _jsx("td", { className: "num", children: fmtEur(sum) }), _jsx("td", { colSpan: 2 })] }) })] }) })] }, c));
            }), lines.length > 0 && _jsxs("h2", { children: ["Projecttotaal (kostprijs) ", _jsx("span", { children: fmtEur(total) })] })] }));
}
