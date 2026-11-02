import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from 'react-router';
import { supabase } from '../../core/supabase';
import { useQuery } from '../../core/useQuery';
import { ErrorBox, Loading } from '../../core/ui';
import { fmtEur, fmtInt } from '../../core/format';
import { fmtWhen, gatesOf, relDays, usePhases, useProjects } from '../../core/projects';
const PRIO = { 1: 'Nu doen', 2: 'Binnenkort', 3: 'Ter info' };
export function ControlTower() {
    const flags = useQuery(() => supabase.from('app_control_tower').select('*').order('prio').order('since', { ascending: false }), []);
    const projects = useProjects();
    const phases = usePhases();
    const sup = useQuery(() => supabase.from('app_supplier_freshness').select('*').order('supplier_name'), []);
    const loading = flags.loading || projects.loading || phases.loading;
    const ps = projects.data ?? [];
    const active = ps.filter((p) => p.phase_active !== false);
    const fl = flags.data ?? [];
    const openValue = active.reduce((s, p) => s + (p.cost_total ?? 0), 0);
    const oldest = (sup.data ?? []).reduce((m, s) => Math.max(m, s.days_old), 0);
    const recent = [...ps].filter((p) => p.last_received).sort((a, b) => (b.last_received ?? '').localeCompare(a.last_received ?? '')).slice(0, 5);
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
    /** Waar je het punt oplost, en wat er op de knop staat. */
    const actionFor = (f) => {
        const proj = f.project_code ? `/projecten/${encodeURIComponent(f.project_code)}` : '/projecten';
        const ver = f.last_version ? `${proj}/v/${f.last_version}` : proj;
        switch (f.kind) {
            case 'prijzen': return { to: `${ver}?tab=kosten&focus=prijzen`, label: 'Prijzen invullen' };
            case 'kosten': return { to: `${ver}?tab=kosten`, label: 'Kosten bekijken' };
            case 'optimalisatie': return { to: `${ver}?tab=platen`, label: 'Platen bekijken' };
            case 'stuklijst_fout': return { to: `${ver}?tab=controle`, label: 'Fouten bekijken' };
            case 'stuklijst_opm': return { to: `${ver}?tab=controle`, label: 'Opmerkingen bekijken' };
            case 'klant_email': return { to: `${proj}?focus=email`, label: 'E-mail invullen' };
            case 'partner_email': return { to: `/relaties?tab=partners&focus=${f.ref}:email`, label: 'E-mail invullen' };
            case 'stilstand': return { to: `${proj}?focus=fase`, label: 'Fase aanpassen' };
            case 'survey_nieuw': return { to: `${proj}?focus=survey`, label: 'Vragenlijst bekijken' };
            case 'survey_open': return { to: `${proj}?focus=survey`, label: 'Klant contacteren' };
            case 'leverancier': return { to: '/regels', label: 'Regels bekijken' };
            default: return { to: proj, label: 'Openen' };
        }
    };
    return (_jsxs("section", { className: "ct", children: [_jsx("div", { className: "page-head", children: _jsxs("div", { children: [_jsxs("h1", { children: [greet, ", Olivier"] }), _jsx("p", { className: "muted", children: new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) })] }) }), _jsx(ErrorBox, { error: flags.error ?? projects.error ?? phases.error ?? sup.error }), loading ? (_jsx(Loading, {})) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "kpis", children: [_jsx(Kpi, { label: "Lopende projecten", value: fmtInt(active.length) }), _jsx(Kpi, { label: "Nu doen", value: fmtInt(fl.filter((f) => f.prio === 1).length), tone: fl.some((f) => f.prio === 1) ? 'bad' : 'ok' }), _jsx(Kpi, { label: "Binnenkort", value: fmtInt(fl.filter((f) => f.prio === 2).length), tone: fl.some((f) => f.prio === 2) ? 'warn' : 'ok' }), _jsx(Kpi, { label: "Materiaalraming lopend", value: fmtEur(openValue) }), _jsx(Kpi, { label: "Oudste prijsupdate leverancier", value: oldest <= 1 ? 'actueel' : `${oldest} dagen`, tone: oldest > 35 ? 'warn' : 'ok' })] }), _jsxs("div", { className: "ct-grid", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Aandacht nodig" }), fl.length === 0 ? (_jsx("p", { className: "muted", children: "Alles in orde. Er vraagt niets je aandacht." })) : ([1, 2, 3].map((prio) => {
                                        const list = fl.filter((f) => f.prio === prio);
                                        if (!list.length)
                                            return null;
                                        return (_jsxs("div", { className: "flag-group", children: [_jsxs("h3", { className: 'prio p' + prio, children: [PRIO[prio], " ", _jsx("span", { children: list.length })] }), _jsx("ul", { className: "flags", children: list.map((f, i) => {
                                                        const act = actionFor(f);
                                                        return (_jsx("li", { children: _jsxs(Link, { to: act.to, className: "flag", children: [_jsx("span", { className: 'dot p' + f.prio }), _jsxs("span", { className: "flag-main", children: [_jsx("strong", { children: f.title }), _jsxs("span", { className: "muted", children: [f.project_code ? `${f.project_code} · ` : '', f.detail] })] }), _jsxs("span", { className: "flag-side", children: [_jsxs("span", { className: "flag-act", children: [act.label, " \u2192"] }), _jsx("span", { className: "flag-when muted", children: relDays(f.since) })] })] }) }, i));
                                                    }) })] }, prio));
                                    }))] }), _jsxs("div", { className: "ct-side", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Komende kennismakingen" }), (() => {
                                                const up = ps.filter((p) => p.intro_at && p.intro_at > new Date(Date.now() - 3600e3).toISOString() && p.phase_active !== false)
                                                    .sort((a, b) => (a.intro_at ?? '').localeCompare(b.intro_at ?? ''));
                                                return up.length === 0 ? _jsx("p", { className: "muted", children: "Geen geplande gesprekken." }) : (_jsx("ul", { className: "mini", children: up.map((p) => (_jsxs("li", { children: [_jsx(Link, { to: `/projecten/${encodeURIComponent(p.project_code)}`, children: p.client_name }), _jsx("span", { className: "muted", children: p.project_code }), _jsx("span", { className: "right", children: fmtWhen(p.intro_at) })] }, p.project_id))) }));
                                            })()] }), _jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Laatste uploads" }), recent.length === 0 ? (_jsx("p", { className: "muted", children: "Nog geen uploads." })) : (_jsx("ul", { className: "mini", children: recent.map((p) => (_jsxs("li", { children: [_jsxs(Link, { to: `/projecten/${encodeURIComponent(p.project_code)}/v/${p.last_version}`, children: [p.project_code, " v", p.last_version] }), _jsx("span", { className: "muted", children: p.client_name }), _jsx("span", { className: "muted right", children: relDays(p.last_received) })] }, p.project_id))) }))] }), _jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Leveranciersprijzen" }), _jsx("ul", { className: "mini", children: (sup.data ?? []).map((s) => (_jsxs("li", { children: [_jsx("span", { children: s.supplier_name }), _jsxs("span", { className: "muted", children: [fmtInt(s.n_articles), " art."] }), _jsx("span", { className: 'right ' + (s.days_old > 35 ? 'warn-text' : 'muted'), children: relDays(s.last_update) })] }, s.supplier_name))) })] })] })] }), _jsx("h2", { className: "ct-h", children: "Pijplijn" }), _jsx(Pipeline, { projects: active, gates: gatesOf(phases.data ?? []) })] }))] }));
}
function Kpi({ label, value, tone }) {
    return (_jsxs("div", { className: 'kpi' + (tone ? ' ' + tone : ''), children: [_jsx("div", { className: "kpi-value", children: value }), _jsx("div", { className: "kpi-label", children: label })] }));
}
function Pipeline({ projects, gates }) {
    return (_jsx("div", { className: "pipeline", style: { gridTemplateColumns: `repeat(${gates.length}, minmax(170px, 1fr))` }, children: gates.map((g, i) => {
            const list = projects.filter((p) => (p.stage ?? p.phase) === g.phase);
            return (_jsxs("div", { className: 'lane' + (list.length ? '' : ' empty'), children: [_jsxs("div", { className: "lane-head", children: [_jsxs("span", { children: [_jsx("em", { children: i + 1 }), " ", g.label] }), _jsx("span", { className: "lane-n", children: list.length })] }), list.map((p) => (_jsxs(Link, { to: `/projecten/${encodeURIComponent(p.project_code)}`, className: "lane-card", children: [_jsx("strong", { children: p.project_code }), _jsx("span", { children: p.client_name }), p.cost_total != null && _jsx("span", { className: "muted", children: fmtEur(p.cost_total) })] }, p.project_id))), g.gate && _jsx("p", { className: "lane-gate", children: g.gate })] }, g.phase));
        }) }));
}
