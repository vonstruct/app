import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../core/supabase';
/** Nieuwe aanvraag met de hand (de Bookings-koppeling doet hetzelfde automatisch). */
export function NewLead({ onClose }) {
    const nav = useNavigate();
    const [f, setF] = useState({ name: '', email: '', phone: '', source: '', intro: '', notes: '' });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        const { data, error } = await supabase.rpc('create_lead', {
            p_name: f.name, p_email: f.email || null, p_phone: f.phone || null, p_source: f.source || null,
            p_intro_at: f.intro ? new Date(f.intro).toISOString() : null, p_notes: f.notes || null,
        });
        setBusy(false);
        if (error)
            return setErr(error.message);
        nav(`/projecten/${encodeURIComponent(String(data))}`);
    };
    return (_jsx("div", { className: "survey-overlay", onClick: onClose, children: _jsxs("form", { className: "panel new-lead", onClick: (e) => e.stopPropagation(), onSubmit: save, children: [_jsx("h2", { children: "Nieuwe aanvraag" }), _jsx("p", { className: "muted", children: "Maakt de klant en het project aan, met een nieuwe projectcode. Gebruik die code ook in PaletteCAD (veld \"Project\")." }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "wide", children: ["Naam", _jsx("input", { required: true, value: f.name, onChange: set('name') })] }), _jsxs("label", { children: ["E-mail", _jsx("input", { type: "email", value: f.email, onChange: set('email') })] }), _jsxs("label", { children: ["Telefoon", _jsx("input", { type: "tel", value: f.phone, onChange: set('phone') })] }), _jsxs("label", { children: ["Bron", _jsxs("select", { value: f.source, onChange: set('source'), children: [_jsx("option", { value: "" }), ['WhatsApp', 'Bookings', 'Telefoon', 'Website', 'Aanbeveling', 'Instagram', 'Andere'].map((x) => _jsx("option", { children: x }, x))] })] }), _jsxs("label", { children: ["Kennismaking", _jsx("input", { type: "datetime-local", value: f.intro, onChange: set('intro') })] }), _jsxs("label", { className: "wide", children: ["Notitie", _jsx("textarea", { rows: 2, value: f.notes, onChange: set('notes') })] })] }), err && _jsx("p", { className: "error", children: err }), _jsxs("div", { className: "survey-nav", children: [_jsx("button", { type: "button", onClick: onClose, children: "Annuleren" }), _jsx("button", { className: "primary", disabled: busy, children: "Aanmaken" })] })] }) }));
}
