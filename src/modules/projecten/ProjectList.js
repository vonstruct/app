import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ErrorBox, Loading } from '../../core/ui';
import { ProjectCard, usePhases, useProjects } from '../../core/projects';
import { NewLead } from './NewLead';
export function ProjectList() {
    const q = useProjects();
    const ph = usePhases();
    const [filter, setFilter] = useState('lopend');
    const [search, setSearch] = useState('');
    const [adding, setAdding] = useState(false);
    const all = q.data ?? [];
    const needle = search.trim().toLowerCase();
    const rows = all
        .filter((p) => (filter === 'alle' ? true : filter === 'lopend' ? p.phase_active !== false : p.phase_active === false))
        .filter((p) => !needle || [p.project_code, p.title, p.client_name, p.site_city, p.scene_title].some((v) => (v ?? '').toLowerCase().includes(needle)));
    const count = (f) => all.filter((p) => (f === 'alle' ? true : f === 'lopend' ? p.phase_active !== false : p.phase_active === false)).length;
    return (_jsxs("section", { children: [adding && _jsx(NewLead, { onClose: () => setAdding(false) }), _jsxs("div", { className: "page-head", children: [_jsxs("div", { children: [_jsx("h1", { children: "Projecten" }), _jsx("p", { className: "muted", children: "Een aanvraag maakt de klant en het project aan met een projectcode. Gebruik die code in PaletteCAD: elke upload wordt dan een nieuwe versie van dat project." })] }), _jsxs("div", { className: "toolbar", children: [_jsx("input", { className: "search-input", placeholder: "Zoek op code, klant, gemeente\u2026", value: search, onChange: (e) => setSearch(e.target.value) }), _jsx("button", { className: "primary", onClick: () => setAdding(true), children: "+ Nieuwe aanvraag" })] })] }), _jsx("div", { className: "segmented", children: ['lopend', 'alle', 'afgesloten'].map((f) => (_jsxs("button", { className: f === filter ? 'on' : '', onClick: () => setFilter(f), children: [f === 'lopend' ? 'Lopend' : f === 'alle' ? 'Alle' : 'Afgesloten', " ", _jsx("span", { children: count(f) })] }, f))) }), _jsx(ErrorBox, { error: q.error ?? ph.error }), q.loading || ph.loading ? (_jsx(Loading, {})) : rows.length === 0 ? (_jsx("p", { className: "muted", children: "Geen projecten." })) : (_jsx("div", { className: "pcards", children: rows.map((p) => (_jsx(ProjectCard, { p: p, phases: ph.data ?? [], onSaved: q.reload }, p.project_id))) }))] }));
}
