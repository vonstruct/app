import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AuthGate } from './core/auth';
import { Layout } from './core/Layout';
import { modules } from './modules/registry';
export default function App() {
    return (_jsx(AuthGate, { children: _jsx(HashRouter, { children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [modules.flatMap((m) => m.routes.map((r) => _jsx(Route, { path: r.path, element: r.element }, m.id + r.path))), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: modules[0].path, replace: true }) })] }) }) }) }));
}
