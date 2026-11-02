import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from 'react-router';
import { modules } from '../modules/registry';
import { supabase } from './supabase';
import logo from '../assets/vonstruct-logo.webp';
export function Layout() {
    return (_jsxs("div", { className: "shell", children: [_jsxs("header", { className: "topbar", children: [_jsx("img", { className: "topbar-logo", src: logo, alt: "Vonstruct" }), _jsx("nav", { children: modules
                            .filter((m) => m.inMenu !== false)
                            .map((m) => (_jsx(NavLink, { to: m.path, className: ({ isActive }) => (isActive ? 'nav active' : 'nav'), children: m.label }, m.id))) }), _jsx("button", { className: "link topbar-out", onClick: () => supabase.auth.signOut(), children: "Afmelden" })] }), _jsx("main", { children: _jsx(Outlet, {}) })] }));
}
