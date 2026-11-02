import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../core/supabase';
import { useQuery } from '../../core/useQuery';
const FIELDS = [
    { key: 'first_name', label: 'Voornaam' },
    { key: 'last_name', label: 'Naam' },
    { key: 'email', label: 'E-mail', type: 'email', placeholder: 'naam@voorbeeld.be', wide: true },
    { key: 'phone', label: 'Telefoon', type: 'tel' },
    { key: 'company', label: 'Bedrijf' },
    { key: 'street', label: 'Straat', wide: true },
    { key: 'postal_code', label: 'Postcode' },
    { key: 'city', label: 'Gemeente' },
];
/** Klantgegevens bij een project; elk veld wordt bewaard zodra je het verlaat. */
export function ClientPanel({ project, focus, onSaved }) {
    const q = useQuery(() => supabase.from('clients').select('id, first_name, last_name, company, email, phone, street, postal_code, city, language').eq('id', project.client_id).single(), [project.client_id]);
    const [msg, setMsg] = useState(null);
    const box = useRef(null);
    useEffect(() => { if (focus && q.data)
        box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [focus, q.data]);
    if (!q.data)
        return null;
    const c = q.data;
    const save = async (key, value) => {
        const v = value.trim() === '' ? null : value.trim();
        if (v === (c[key] ?? null))
            return;
        const { error } = await supabase.from('clients').update({ [key]: v }).eq('id', c.id);
        setMsg(error ? 'Niet bewaard: ' + error.message : 'Bewaard');
        q.reload();
        onSaved();
    };
    return (_jsxs("div", { ref: box, className: 'panel client-panel' + (focus ? ' focus' : ''), children: [_jsxs("h2", { children: ["Klant ", project.client_number != null && _jsxs("span", { className: "muted", children: ["nr. ", project.client_number] })] }), focus === 'email' && !c.email && _jsx("p", { className: "notice", children: "Vul het e-mailadres van de klant in. Daarmee kan je de klant later uitnodigen voor het klantenportaal." }), _jsxs("div", { className: "form-grid", children: [FIELDS.map((f) => (_jsxs("label", { className: f.wide ? 'wide' : undefined, children: [f.label, _jsx("input", { type: f.type ?? 'text', defaultValue: c[f.key] ?? '', placeholder: f.placeholder, autoFocus: focus === f.key, className: focus === f.key && !c[f.key] ? 'focus-input' : undefined, onBlur: (e) => save(f.key, e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                                    e.target.blur(); } })] }, f.key))), _jsxs("label", { children: ["Taal van de klant", _jsxs("select", { value: c.language ?? 'nl', onChange: (e) => save('language', e.target.value), children: [_jsx("option", { value: "nl", children: "Nederlands" }), _jsx("option", { value: "en", children: "Engels" }), _jsx("option", { value: "de", children: "Duits" })] })] })] }), _jsx("p", { className: "muted small", children: "De taal bepaalt de mails, de berichten en het klantenportaal (de klant kan daar zelf ook wisselen)." }), msg && _jsx("p", { className: "muted small", children: msg })] }));
}
