import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../core/supabase';
import { Survey } from '../../portal/Survey';
/** Antwoorden van de klant op de vragenlijst, met foto's. De beheerder kan de vragenlijst ook zelf openen en invullen. */
export function SurveyPanel({ code, submittedAt, focus }) {
    const [data, setData] = useState(null);
    const [urls, setUrls] = useState({});
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    const load = () => supabase.rpc('portal_survey', { p_code: code }).then(({ data }) => setData(data));
    useEffect(() => { load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (focus && data)
        box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [focus, data]);
    useEffect(() => {
        if (!data)
            return;
        const paths = Object.values(data.answers).flatMap((v) => (Array.isArray(v) ? v : [])).filter((v) => typeof v === 'string' && v.startsWith(code + '/'));
        if (!paths.length)
            return;
        supabase.storage.from('project-uploads').createSignedUrls(paths, 3600).then(({ data: d }) => {
            const m = {};
            for (const x of d ?? [])
                if (x.path && x.signedUrl)
                    m[x.path] = x.signedUrl;
            setUrls(m);
        });
    }, [data, code]);
    if (open)
        return (_jsx("div", { className: "survey-overlay", children: _jsx("div", { className: "survey-overlay-inner", children: _jsx(Survey, { code: code, onClose: () => { setOpen(false); load(); } }) }) }));
    if (!data)
        return null;
    const a = data.answers;
    const filled = data.questions.filter((q) => {
        const v = a[q.key];
        return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    });
    const show = (q) => {
        const v = a[q.key];
        if (q.type === 'upload')
            return (_jsx("div", { className: "uploads", children: v.map((p) => /\.(jpe?g|png|webp|gif)$/i.test(p) && urls[p]
                    ? _jsx("a", { href: urls[p], target: "_blank", rel: "noreferrer", className: "upl", children: _jsx("img", { src: urls[p], alt: "" }) }, p)
                    : _jsxs("a", { href: urls[p], target: "_blank", rel: "noreferrer", className: "upl", children: [_jsx("span", { className: "upl-file", children: p.split('.').pop()?.toUpperCase() }), _jsx("span", { className: "upl-name", children: p.split('/').pop()?.replace(/^\d+-/, '') })] }, p)) }));
        if (Array.isArray(v))
            return v.join(', ');
        if (v === true)
            return 'Ja';
        if (v === false)
            return 'Nee';
        return String(v);
    };
    const sections = [...new Set(filled.map((q) => q.section))];
    return (_jsxs("div", { ref: box, className: 'panel survey-panel' + (focus ? ' focus' : ''), children: [_jsxs("div", { className: "survey-panel-head", children: [_jsxs("h2", { children: ["Vragenlijst ", _jsx("span", { className: 'chip ' + (data.status === 'submitted' ? 'ok' : 'warn'), children: data.status === 'submitted' ? 'ingediend' + (submittedAt ? ' ' + new Date(submittedAt).toLocaleDateString('nl-BE') : '') : filled.length ? 'bezig' : 'nog niet gestart' })] }), _jsx("button", { onClick: () => setOpen(true), children: data.status === 'submitted' ? 'Openen' : 'Zelf invullen of aanvullen' })] }), filled.length === 0 ? (_jsx("p", { className: "muted", children: "De klant heeft nog niets ingevuld. De klant vult dit in via het klantenportaal; je kunt het ook zelf invullen tijdens een gesprek." })) : (sections.map((s) => (_jsxs("div", { className: "survey-answers", children: [_jsx("h3", { children: s }), _jsx("dl", { children: filled.filter((q) => q.section === s).map((q) => (_jsxs("div", { className: q.type === 'upload' ? 'wide' : undefined, children: [_jsx("dt", { children: q.label }), _jsx("dd", { children: show(q) })] }, q.key))) })] }, s))))] }));
}
