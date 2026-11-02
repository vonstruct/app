import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const Loading = () => _jsx("p", { className: "muted", children: "Laden\u2026" });
export const ErrorBox = ({ error }) => (error ? _jsx("p", { className: "error", children: error }) : null);
export function Tabs({ tabs, active, onChange }) {
    return (_jsx("div", { className: "tabs", role: "tablist", children: tabs.map((t) => (_jsx("button", { role: "tab", "aria-selected": t.id === active, className: t.id === active ? 'tab active' : 'tab', onClick: () => onChange(t.id), children: t.label }, t.id))) }));
}
export const Stat = ({ label, value }) => (_jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-value", children: value }), _jsx("div", { className: "stat-label", children: label })] }));
