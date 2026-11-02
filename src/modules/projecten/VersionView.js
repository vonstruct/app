import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useParams, useSearchParams } from 'react-router';
import { supabase } from '../../core/supabase';
import { useQuery } from '../../core/useQuery';
import { ErrorBox, Loading, Stat, Tabs } from '../../core/ui';
import { fmtDate, fmtInt } from '../../core/format';
import { versionTabs } from './tabs';
export function VersionView() {
    const { code = '', version = '' } = useParams();
    const [params, setParams] = useSearchParams();
    const tab = versionTabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : versionTabs[0].id;
    const setTab = (id) => setParams({ tab: id }, { replace: true });
    const q = useQuery(() => supabase
        .from('design_versions')
        .select('id, version, received_at, scene_title, n_cabinets, n_parts, n_errors, n_warnings, payload->project')
        .eq('project_code', code)
        .eq('version', Number(version))
        .single()
        .then((r) => ({ data: r.data ? { ...r.data, payload: { project: r.data.project } } : null, error: r.error })), [code, version]);
    const dv = q.data;
    const p = dv?.payload.project ?? {};
    const Active = versionTabs.find((t) => t.id === tab).component;
    return (_jsxs("section", { children: [_jsxs("p", { className: "crumbs", children: [_jsx(Link, { to: "/projecten", children: "Projecten" }), " / ", _jsx(Link, { to: `/projecten/${encodeURIComponent(code)}`, children: code }), " / v", version] }), _jsx(ErrorBox, { error: q.error }), q.loading || !dv ? (_jsx(Loading, {})) : (_jsxs(_Fragment, { children: [_jsxs("h1", { children: [code, " ", p.customer ? `· ${p.customer}` : '', " ", _jsxs("span", { className: "muted", children: ["v", dv.version] })] }), _jsx("p", { className: "muted", children: [dv.scene_title, p.street, p.city, p.drawn_by && `getekend door ${p.drawn_by}`, `ontvangen ${fmtDate(dv.received_at)}`].filter(Boolean).join(' · ') }), _jsxs("div", { className: "stats", children: [_jsx(Stat, { label: "getelde objecten", value: fmtInt(dv.n_parts) }), _jsx(Stat, { label: "fouten", value: dv.n_errors ? _jsx("span", { className: "bad-text", children: dv.n_errors }) : 0 }), _jsx(Stat, { label: "aandachtspunten", value: dv.n_warnings })] }), _jsx(Tabs, { tabs: versionTabs.map((t) => ({ id: t.id, label: t.label })), active: tab, onChange: setTab }), _jsx(Active, { dvId: dv.id })] }))] }));
}
