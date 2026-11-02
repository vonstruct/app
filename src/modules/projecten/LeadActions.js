import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
const LANG_NAME = { nl: 'Nederlands', en: 'Engels', de: 'Duits' };
const LINK = 'https://app.vonstruct.com';
/** Belgisch gsm-nummer naar het formaat van wa.me (32…). */
const waNumber = (phone) => {
    let d = (phone ?? '').replace(/[^\d+]/g, '');
    if (d.startsWith('+'))
        d = d.slice(1);
    else if (d.startsWith('00'))
        d = d.slice(2);
    else if (d.startsWith('0'))
        d = '32' + d.slice(1);
    return d;
};
const fill = (body, p) => {
    const first = (p.client_name ?? '').split(' ')[0];
    return body
        .replaceAll('{voornaam}', first || 'klant')
        .replaceAll('{naam}', p.client_name ?? '')
        .replaceAll('{projectcode}', p.project_code)
        .replaceAll('{link}', LINK)
        .replaceAll('{email}', p.client_email ?? '');
};
/** Na de kennismaking: Go (klant uitnodigen + welkomstbericht) of Niet doorgaan. */
export function LeadActions({ p, onDone }) {
    const [tpls, setTpls] = useState([]);
    const [msg, setMsg] = useState(null);
    const [show, setShow] = useState(p.phase === 'intake' ? 'welkom' : null);
    const [busy, setBusy] = useState(false);
    const [lang, setLang] = useState('nl');
    useEffect(() => { supabase.from('message_templates').select('key,lang,label,body').then(({ data }) => setTpls(data ?? [])); }, []);
    // taal van de klant (instelbaar bij Klant); bepaalt de mail en het bericht
    useEffect(() => {
        if (p.client_id)
            supabase.from('clients').select('language').eq('id', p.client_id).single().then(({ data }) => setLang(data?.language ?? 'nl'));
    }, [p]);
    if (!['lead', 'intake', 'survey'].includes(p.phase))
        return null;
    const go = async () => {
        if (!p.client_email)
            return setMsg({ kind: 'err', text: 'Vul eerst het e-mailadres van de klant in (hiernaast bij Klant).' });
        setBusy(true);
        const { data, error } = await supabase.functions.invoke('invite-client', { body: { project_code: p.project_code } });
        setBusy(false);
        const e = error ? (await error.context?.json?.().catch(() => null))?.error ?? error.message : data?.error;
        if (e)
            return setMsg({ kind: 'err', text: e });
        setMsg({ kind: 'ok', text: data.mode === 'invited'
                ? `Uitnodiging verstuurd naar ${p.client_email}. Stuur nu ook het welkomstbericht via WhatsApp.`
                : `${p.client_email} had al toegang: er is een nieuwe inloglink verstuurd.` });
        setShow('welkom');
        onDone();
    };
    const decline = async () => {
        if (!window.confirm('Dit project op "Niet doorgegaan" zetten?'))
            return;
        await supabase.from('projects').update({ phase: 'declined' }).eq('id', p.project_id);
        setShow('niet_doorgaan');
        onDone();
    };
    const tpl = tpls.find((t) => t.key === show && t.lang === lang) ?? tpls.find((t) => t.key === show && t.lang === 'nl');
    const text = tpl ? fill(tpl.body, p) : '';
    const wa = waNumber(p.client_phone);
    return (_jsxs("div", { className: "panel lead-actions", children: [_jsx("h2", { children: "Na de kennismaking" }), p.phase === 'lead' && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "muted", children: ["Gaat het project door? ", _jsx("strong", { children: "Go" }), " stuurt de klant een uitnodiging per mail (in het ", LANG_NAME[lang] ?? lang, ", te wijzigen bij Klant) om in te loggen op het klantenportaal en de vragenlijst in te vullen."] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { className: "primary", disabled: busy, onClick: go, children: busy ? 'Versturen…' : 'Go: klant uitnodigen' }), _jsx("button", { onClick: decline, children: "Niet doorgaan" })] })] })), p.phase !== 'lead' && (_jsxs("div", { className: "toolbar", children: [_jsx("span", { className: "chip ok", children: "Klant uitgenodigd" }), _jsx("button", { className: "link", disabled: busy, onClick: go, children: "Uitnodiging opnieuw sturen" }), p.survey_status !== 'submitted' && _jsx("button", { className: "link", onClick: () => setShow('vragenlijst_herinnering'), children: "Herinnering vragenlijst" })] })), msg && _jsx("p", { className: msg.kind === 'ok' ? 'notice' : 'auth-msg error', children: msg.text }), tpl && (_jsxs("div", { className: "msg-box", children: [_jsxs("div", { className: "msg-head", children: [_jsxs("strong", { children: [tpl.label, " ", _jsxs("span", { className: "muted", children: ["\u00B7 ", LANG_NAME[tpl.lang] ?? tpl.lang] })] }), _jsx("span", { className: "muted small", children: "Pas de tekst aan onder Regels \u2192 Berichten" })] }), _jsx("textarea", { readOnly: true, rows: 5, value: text }), _jsxs("div", { className: "toolbar", children: [wa ? (_jsx("a", { className: "btn-wa", href: `https://wa.me/${wa}?text=${encodeURIComponent(text)}`, target: "_blank", rel: "noreferrer", children: "Versturen via WhatsApp" })) : _jsx("span", { className: "muted small", children: "Geen telefoonnummer: vul het in bij Klant om via WhatsApp te sturen." }), p.client_email && _jsx("a", { className: "btn-plain", href: `mailto:${p.client_email}?subject=${encodeURIComponent('Je project bij Vonstruct (' + p.project_code + ')')}&body=${encodeURIComponent(text)}`, children: "Per mail" }), _jsx("button", { onClick: () => navigator.clipboard.writeText(text), children: "Kopi\u00EBren" })] })] }))] }));
}
