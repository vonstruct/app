import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../../core/supabase';
/** Eén regel als zin met invulvelden. Wijzigen = meteen bewaren in Supabase. */
export function RuleSentence({ rule }) {
    const [value, setValue] = useState(rule.value);
    const [state, setState] = useState('idle');
    const [err, setErr] = useState(null);
    const setField = async (name, v) => {
        const next = { ...value, [name]: v };
        setValue(next);
        const { error } = await supabase.from('rule_settings').update({ value: next }).eq('key', rule.key);
        setState(error ? 'error' : 'saved');
        setErr(error ? error.message : null);
    };
    // zin opsplitsen in tekst en {velden}
    const parts = rule.sentence.split(/(\{[a-z_0-9]+\})/g);
    const maps = Object.entries(rule.fields).filter(([, f]) => f.type === 'map');
    return (_jsxs("div", { className: "card rule", children: [_jsx("p", { className: "sentence", children: parts.map((p, i) => {
                    const m = p.match(/^\{([a-z_0-9]+)\}$/);
                    if (!m)
                        return _jsx("span", { children: p }, i);
                    const name = m[1];
                    const f = rule.fields[name];
                    if (!f)
                        return _jsx("span", { children: p }, i);
                    if (f.type === 'map')
                        return _jsx("span", {}, i);
                    return _jsx(FieldInput, { field: f, value: value[name], onChange: (v) => setField(name, v) }, i);
                }) }), maps.map(([name, f]) => (_jsx(MapEditor, { field: f, value: value[name] ?? {}, onChange: (v) => setField(name, v) }, name))), _jsxs("div", { className: "rule-foot", children: [rule.explanation && _jsx("span", { className: "muted", children: rule.explanation }), state === 'saved' && _jsx("span", { className: "ok", children: "Bewaard" }), state === 'error' && _jsx("span", { className: "error", children: err })] })] }));
}
const fmt = (n) => (n == null ? '' : String(n).replace('.', ','));
const parseNum = (s) => {
    const n = Number(s.replace(',', '.'));
    return Number.isNaN(n) ? null : n;
};
function FieldInput({ field, value, onChange }) {
    const [text, setText] = useState(field.type === 'list_number' || field.type === 'list_text' ? (value ?? []).map(fmt).join(', ') : fmt(value));
    const commitScalar = () => {
        if (field.type === 'text')
            return text !== value && onChange(text);
        const n = parseNum(text);
        if (n === null)
            return setText(fmt(value));
        if (n !== value)
            onChange(n);
    };
    const commitList = () => {
        const items = text.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        if (field.type === 'list_number') {
            const nums = items.map((s) => parseNum(s));
            if (nums.some((n) => n === null))
                return setText((value ?? []).map(fmt).join(', '));
            onChange(nums.sort((a, b) => a - b));
        }
        else
            onChange(items);
    };
    const unit = field.type === 'money' ? '€' : field.type === 'percent' ? '%' : field.unit;
    if (field.type === 'bool')
        return (_jsxs("select", { className: "inline", value: value ? 'ja' : 'nee', onChange: (e) => onChange(e.target.value === 'ja'), children: [_jsx("option", { value: "ja", children: "ja" }), _jsx("option", { value: "nee", children: "nee" })] }));
    if (field.type === 'select')
        return (_jsx("select", { className: "inline", value: String(value ?? ''), onChange: (e) => onChange(e.target.value), children: (field.options ?? []).map((o) => _jsx("option", { value: o, children: o }, o)) }));
    const isList = field.type === 'list_number' || field.type === 'list_text';
    const isNum = ['number', 'money', 'percent'].includes(field.type);
    return (_jsxs("span", { className: "inline-field", children: [field.type === 'money' && _jsx("span", { className: "unit", children: "\u20AC" }), _jsx("input", { className: isList ? 'inline wide' : isNum ? 'inline num' : 'inline', value: text, inputMode: isNum ? 'decimal' : undefined, onChange: (e) => setText(e.target.value), onBlur: isList ? commitList : commitScalar, onKeyDown: (e) => { if (e.key === 'Enter')
                    e.target.blur(); }, title: isList ? 'Gescheiden door komma’s' : undefined }), unit && field.type !== 'money' && _jsx("span", { className: "unit", children: unit })] }));
}
function MapEditor({ field, value, onChange }) {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'nl', { numeric: true }));
    const [nk, setNk] = useState('');
    const [nv, setNv] = useState('');
    return (_jsxs("table", { className: "map", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: field.key_label ?? 'Sleutel' }), _jsx("th", { children: field.value_label ?? 'Waarde' }), _jsx("th", {})] }) }), _jsxs("tbody", { children: [entries.map(([k, v]) => (_jsxs("tr", { children: [_jsx("td", { children: k }), _jsx("td", { children: _jsx("input", { className: "cell", defaultValue: v, onBlur: (e) => e.target.value !== v && onChange({ ...value, [k]: e.target.value }) }) }), _jsx("td", { children: _jsx("button", { className: "link danger", onClick: () => { const c = { ...value }; delete c[k]; onChange(c); }, children: "\u2715" }) })] }, k))), _jsxs("tr", { children: [_jsx("td", { children: _jsx("input", { className: "cell", placeholder: "nieuw", value: nk, onChange: (e) => setNk(e.target.value) }) }), _jsx("td", { children: _jsx("input", { className: "cell", value: nv, onChange: (e) => setNv(e.target.value) }) }), _jsx("td", { children: _jsx("button", { className: "link", disabled: !nk.trim(), onClick: () => { onChange({ ...value, [nk.trim()]: nv }); setNk(''); setNv(''); }, children: "+" }) })] })] })] }));
}
