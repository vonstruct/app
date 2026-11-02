import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router';
import { supabase } from './supabase';
import { useQuery } from './useQuery';
import { fmtEur } from './format';
/** De stage gates van de pijplijn (actieve, kiesbare fases). */
export const gatesOf = (phases) => phases.filter((p) => p.selectable && p.active);
export const useProjects = () => useQuery(() => supabase.from('app_projects').select('*').order('last_activity', { ascending: false }), []);
export const usePhases = () => useQuery(() => supabase.from('project_phases').select('*').order('sort'), []);
export function PhaseSteps({ phase, phases }) {
    const cur = phases.find((p) => p.phase === phase);
    const stage = phases.find((p) => p.phase === (cur?.stage ?? phase));
    const gates = gatesOf(phases);
    return (_jsx("ol", { className: "steps", style: { gridTemplateColumns: `repeat(${gates.length}, 1fr)` }, children: gates.map((g) => (_jsx("li", { className: !stage?.active ? '' : g.sort < stage.sort ? 'done' : g.phase === stage.phase ? 'now' : '', title: g.gate ?? g.label, children: _jsx("span", { children: g.label }) }, g.phase))) }));
}
export const fmtWhen = (iso) => iso ? new Date(iso).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export const relDays = (iso) => {
    if (!iso)
        return '';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`;
};
export function StatusChips({ p }) {
    const chips = [];
    if (p.last_version == null)
        chips.push({ cls: 'chip', text: 'Nog geen tekening' });
    else {
        if (p.optimizer_status == null)
            chips.push({ cls: 'chip warn', text: 'Optimalisatie bezig' });
        else if (!p.optimizer_ok)
            chips.push({ cls: 'chip bad', text: 'Optimalisatie mislukt', title: p.optimizer_status });
        if (p.cost_status == null)
            chips.push({ cls: 'chip warn', text: 'Kosten bezig' });
        else if (!p.cost_ok)
            chips.push({ cls: 'chip bad', text: 'Kosten mislukt', title: p.cost_status });
        if (p.n_errors)
            chips.push({ cls: 'chip bad', text: `${p.n_errors} fout${p.n_errors === 1 ? '' : 'en'}` });
        if (p.n_missing_prices)
            chips.push({ cls: 'chip warn', text: `${p.n_missing_prices} zonder prijs` });
        if (p.n_warnings)
            chips.push({ cls: 'chip', text: `${p.n_warnings} opmerking${p.n_warnings === 1 ? '' : 'en'}` });
        if (p.optimizer_ok && p.cost_ok && !p.n_errors && !p.n_missing_prices)
            chips.push({ cls: 'chip ok', text: 'Raming compleet' });
    }
    if (!p.client_email)
        chips.push({ cls: 'chip', text: 'Klant zonder e-mail', title: 'Nodig voor toegang tot het klantenportaal' });
    return (_jsx("div", { className: "chips", children: chips.map((c) => (_jsx("span", { className: c.cls, title: c.title, children: c.text }, c.text))) }));
}
/** Fase kiezen; bewaart meteen in Supabase. */
export function PhaseSelect({ p, phases, onSaved }) {
    return (_jsx("select", { className: "phase-select", value: p.phase, onClick: (e) => e.stopPropagation(), onChange: async (e) => {
            const { error } = await supabase.from('projects').update({ phase: e.target.value }).eq('id', p.project_id);
            if (error)
                alert('Fase niet bewaard: ' + error.message);
            onSaved();
        }, children: phases.filter((ph) => ph.selectable || ph.phase === p.phase).map((ph) => (_jsx("option", { value: ph.phase, children: ph.label }, ph.phase))) }));
}
export function ProjectCard({ p, phases, onSaved }) {
    const href = `/projecten/${encodeURIComponent(p.project_code)}`;
    return (_jsxs("article", { className: 'pcard' + (p.phase_active === false ? ' inactive' : ''), children: [_jsxs("header", { className: "pcard-head", children: [_jsxs("div", { children: [_jsx(Link, { to: href, className: "pcard-code", children: p.project_code }), _jsx("h3", { children: _jsx(Link, { to: href, children: p.title || p.scene_title || 'Zonder titel' }) }), _jsxs("p", { className: "muted", children: [p.client_name, p.site_city ? ` · ${p.site_city}` : ''] })] }), _jsx(PhaseSelect, { p: p, phases: phases, onSaved: onSaved })] }), _jsx(PhaseSteps, { phase: p.phase, phases: phases }), _jsxs("dl", { className: "pcard-facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "Raming materiaal" }), _jsx("dd", { children: p.cost_total != null ? fmtEur(p.cost_total) : '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "Laatste versie" }), _jsx("dd", { children: p.last_version != null ? _jsxs(Link, { to: `${href}/v/${p.last_version}`, children: ["v", p.last_version] }) : '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "Kasten" }), _jsx("dd", { children: p.n_cabinets ?? '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "Laatste activiteit" }), _jsx("dd", { children: relDays(p.last_activity) })] }), p.intro_at && p.stage === 'lead' && (_jsxs("div", { children: [_jsx("dt", { children: "Kennismaking" }), _jsx("dd", { children: fmtWhen(p.intro_at) })] })), p.stage === 'lead' && (_jsxs("div", { children: [_jsx("dt", { children: "Vragenlijst" }), _jsx("dd", { children: p.survey_status === 'submitted' ? 'ingediend' : p.survey_status === 'open' ? 'bezig' : 'nog niet' })] })), p.target_install_week && (_jsxs("div", { children: [_jsx("dt", { children: "Plaatsing" }), _jsxs("dd", { children: ["week ", p.target_install_week] })] }))] }), _jsx(StatusChips, { p: p })] }));
}
