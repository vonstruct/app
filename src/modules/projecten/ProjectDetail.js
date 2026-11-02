import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { supabase } from '../../core/supabase';
import { useQuery } from '../../core/useQuery';
import { DataTable } from '../../core/DataTable';
import { ErrorBox, Loading } from '../../core/ui';
import { fmtDate, fmtInt } from '../../core/format';
import { Compare } from './Compare';
import { ProjectCard, usePhases } from '../../core/projects';
import { ClientPanel } from './ClientPanel';
import { SurveyPanel } from './SurveyPanel';
import { LeadActions } from './LeadActions';
export function ProjectDetail() {
    const { code = '' } = useParams();
    const q = useQuery(() => supabase
        .from('design_versions')
        .select('id, version, received_at, exported_at, scene_title, n_cabinets, n_parts, n_errors, n_warnings')
        .eq('project_code', code)
        .order('version', { ascending: false }), [code]);
    const pq = useQuery(() => supabase.from('app_projects').select('*').eq('project_code', code), [code]);
    const ph = usePhases();
    const [params] = useSearchParams();
    const focus = params.get('focus');
    const project = pq.data?.[0];
    const versions = q.data ?? [];
    const [a, setA] = useState(null);
    const [b, setB] = useState(null);
    const va = versions.find((v) => v.version === (a ?? versions[1]?.version));
    const vb = versions.find((v) => v.version === (b ?? versions[0]?.version));
    return (_jsxs("section", { children: [_jsxs("p", { className: "crumbs", children: [_jsx(Link, { to: "/projecten", children: "Projecten" }), " / ", code] }), _jsxs("h1", { children: ["Project ", code] }), _jsx(ErrorBox, { error: q.error ?? pq.error }), project && ph.data && (_jsxs("div", { className: "pdetail-top", children: [_jsxs("div", { className: 'pcard-wide' + (focus === 'fase' ? ' focus' : ''), children: [focus === 'fase' && _jsx("p", { className: "notice", children: "Kies rechtsboven in de kaart de fase waarin het project nu zit." }), _jsx(ProjectCard, { p: project, phases: ph.data, onSaved: pq.reload })] }), _jsx(ClientPanel, { project: project, focus: focus === 'fase' || focus === 'survey' ? null : focus, onSaved: pq.reload })] })), project && _jsx(LeadActions, { p: project, onDone: pq.reload }), project && _jsx(SurveyPanel, { code: code, focus: focus === 'survey' }), q.loading ? (_jsx(Loading, {})) : (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Versies" }), _jsx(DataTable, { rows: versions, filter: false, rowKey: (r) => r.id, columns: [
                            { key: 'version', label: 'Versie', render: (r) => _jsxs(Link, { to: `/projecten/${encodeURIComponent(code)}/v/${r.version}`, children: ["v", r.version] }) },
                            { key: 'received_at', label: 'Ontvangen', render: (r) => fmtDate(r.received_at) },
                            { key: 'scene_title', label: 'Tekening' },
                            { key: 'n_parts', label: 'Onderdelen', align: 'right', render: (r) => fmtInt(r.n_parts) },
                            { key: 'n_errors', label: 'Fouten', align: 'right' },
                            { key: 'n_warnings', label: 'Aandachtspunten', align: 'right' },
                        ] }), versions.length > 1 && va && vb && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Vergelijken" }), _jsxs("div", { className: "toolbar", children: [_jsx("select", { value: va.version, onChange: (e) => setA(Number(e.target.value)), children: versions.map((v) => (_jsxs("option", { value: v.version, children: ["v", v.version] }, v.id))) }), _jsx("span", { children: "met" }), _jsx("select", { value: vb.version, onChange: (e) => setB(Number(e.target.value)), children: versions.map((v) => (_jsxs("option", { value: v.version, children: ["v", v.version] }, v.id))) })] }), _jsx(Compare, { from: va, to: vb })] }))] }))] }));
}
