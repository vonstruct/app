import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from '../core/supabase';
import logo from '../assets/vonstruct-logo.webp';
import { Survey } from './Survey';
import { LANGS, asLang, storeLang, storedLang, tr } from './i18n';
const STEPS = ['design', 'quote', 'production', 'installation', 'closed'];
/** Portaal voor klanten, de productiepartner en onderaannemers. `preview` = beheerder bekijkt het als voorbeeld. */
export function Portal({ role, preview = false }) {
    const [name, setName] = useState(null);
    const [survey, setSurvey] = useState(null);
    const [lang, setLang] = useState(storedLang);
    const t = tr(lang);
    useEffect(() => {
        if (preview)
            return setName(null);
        supabase.rpc('my_display_name').then(({ data }) => setName(typeof data === 'string' ? data : null));
        // de taal van de klant (bij de klantgegevens) gaat voor
        if (role === 'klant')
            supabase.rpc('my_language').then(({ data }) => { if (data) {
                setLang(asLang(data));
                storeLang(asLang(data));
            } });
    }, [preview, role]);
    const pick = (l) => {
        setLang(l);
        storeLang(l);
        if (!preview && role === 'klant')
            supabase.rpc('set_my_language', { p_lang: l });
    };
    return (_jsxs("div", { className: preview ? 'portal preview' : 'portal', children: [_jsxs("header", { className: "portal-top", children: [_jsx("span", { className: "portal-kind", children: t.kind[role] }), _jsxs("div", { className: "portal-top-right", children: [_jsx(LangPicker, { lang: lang, onPick: pick, label: t.language }), !preview && (_jsx("button", { className: "portal-out", onClick: () => supabase.auth.signOut(), children: t.signOut })), _jsx("img", { className: "portal-logo", src: logo, alt: "Vonstruct" })] })] }), _jsxs("section", { className: "portal-hero", children: [_jsx("h1", { children: name ? t.hello(name.split(' ')[0]) : t.welcome }), _jsx("p", { children: t.intro[role] })] }), _jsxs("main", { className: "portal-main", children: [survey ? (_jsx(Survey, { code: survey, lang: lang, onClose: () => setSurvey(null) })) : role === 'klant' ? (_jsx(ClientProjects, { preview: preview, lang: lang, onSurvey: setSurvey })) : (_jsx(EmptyWork, { role: role, lang: lang })), !survey && _jsx("h2", { className: "portal-h", children: t.coming }), !survey && (_jsx("div", { className: "portal-grid", children: t.comingTiles[role].map(([title, text]) => (_jsxs("div", { className: "portal-tile", children: [_jsx("h3", { children: title }), _jsx("p", { children: text })] }, title))) }))] }), _jsx("footer", { className: "portal-foot", children: t.footer })] }));
}
function ClientProjects({ preview, lang, onSurvey }) {
    const t = tr(lang);
    const [rows, setRows] = useState(null);
    useEffect(() => {
        if (preview)
            return setRows([{ project_code: '209901', title: 'Keuken en berging', phase: 'design', target_install_week: null, site_city: 'Geel', survey_status: 'submitted' }]);
        supabase.rpc('portal_my_projects').then(({ data }) => setRows(data ?? []));
    }, [preview]);
    if (rows === null)
        return _jsx("p", { className: "muted", children: t.loading });
    if (rows.length === 0)
        return (_jsxs("div", { className: "portal-empty", children: [_jsx("h2", { children: t.preparing }), _jsx("p", { children: t.preparingText })] }));
    return (_jsx("div", { className: "portal-projects", children: rows.map((p) => {
            const idx = p.phase === 'lead' ? -1 : STEPS.indexOf(p.phase ?? '');
            return (_jsxs("article", { className: "portal-project", children: [_jsxs("div", { className: "portal-project-head", children: [_jsxs("div", { children: [_jsxs("span", { className: "portal-code", children: [t.project, " ", p.project_code] }), _jsx("h2", { children: !p.title || p.title === 'Nieuwe aanvraag' ? t.yourProject : p.title }), p.site_city && _jsx("p", { className: "muted", children: p.site_city })] }), _jsx("span", { className: "portal-phase", children: t.phases[p.phase ?? ''] ?? '—' })] }), _jsx("ol", { className: "portal-steps", children: STEPS.map((s, i) => (_jsx("li", { className: idx >= 0 && i < idx ? 'done' : i === idx ? 'now' : '', children: t.phases[s] }, s))) }), p.target_install_week && _jsx("p", { className: "muted", children: t.plannedInstall(p.target_install_week) }), p.survey_status !== 'submitted' ? (_jsxs("div", { className: "portal-todo", children: [_jsxs("div", { children: [_jsx("strong", { children: t.fillSurvey }), _jsx("p", { className: "muted", children: t.fillSurveyText })] }), _jsx("button", { className: "primary", disabled: preview, onClick: () => onSurvey(p.project_code), children: p.survey_status === 'open' ? t.continue : t.start })] })) : (_jsxs("p", { className: "portal-ok", children: [t.surveyDone, " \u00B7 ", _jsx("button", { className: "link", disabled: preview, onClick: () => onSurvey(p.project_code), children: t.view })] }))] }, p.project_code));
        }) }));
}
function EmptyWork({ role, lang }) {
    const t = tr(lang);
    return (_jsxs("div", { className: "portal-empty", children: [_jsx("h2", { children: role === 'partner' ? t.noJobsP : t.noJobsS }), _jsx("p", { children: role === 'partner' ? t.noJobsPText : t.noJobsSText })] }));
}
/** Taalkeuze NL / EN / DE. */
export function LangPicker({ lang, onPick, label }) {
    return (_jsx("div", { className: "lang-pick", role: "group", "aria-label": label, children: LANGS.map((l) => (_jsx("button", { type: "button", className: l.id === lang ? 'on' : '', "aria-pressed": l.id === lang, onClick: () => onPick(l.id), children: l.label }, l.id))) }));
}
