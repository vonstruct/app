import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from './supabase';
export const ORIGINS = ['Bestellen', 'Zelf maken', 'Negeren'];
/**
 * Artikel opnemen in Eigen artikels: prijs per stuk + herkomst.
 * Herkenning op artikelnummer, of op naam als er geen nummer is. Geldt voor alle projecten.
 */
export function OwnArticleEditor({ articleNo, description, supplier, price, origin = 'Bestellen', onSaved, }) {
    const [p, setP] = useState(price ? String(price).replace('.', ',') : '');
    const [o, setO] = useState(origin);
    const [busy, setBusy] = useState(false);
    const save = async () => {
        const v = p.trim().replace(',', '.');
        if (o !== 'Negeren' && (v === '' || isNaN(Number(v))))
            return onSaved('Vul eerst een prijs per stuk in.');
        setBusy(true);
        const { error } = await supabase.rpc('set_manual_item', {
            p_article_no: articleNo ?? '', p_description: description, p_supplier: supplier, p_price: o === 'Negeren' ? 0 : Number(v), p_origin: o,
        });
        setBusy(false);
        onSaved(error ? 'Niet bewaard: ' + error.message
            : o === 'Negeren' ? `"${description}" wordt voortaan genegeerd.`
                : `"${description}" bewaard (${o.toLowerCase()}, € ${v.replace('.', ',')} per stuk). Geldt ook voor volgende projecten.`);
    };
    return (_jsxs("span", { className: "own-editor", children: [_jsx("select", { value: o, onChange: (e) => setO(e.target.value), title: "Herkomst", children: ORIGINS.map((x) => _jsx("option", { children: x }, x)) }), o !== 'Negeren' && (_jsx("input", { className: "price-input", inputMode: "decimal", placeholder: "\u20AC per stuk", value: p, onChange: (e) => setP(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                    save(); } })), _jsx("button", { className: "primary", disabled: busy, onClick: save, children: "Bewaren" })] }));
}
