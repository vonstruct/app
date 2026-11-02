import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Portal } from '../../portal/Portal';
import { Tabs } from '../../core/ui';
/** Beheerder: bekijk het portaal zoals een klant, partner of onderaannemer het ziet. */
export function PortalPreview() {
    const [role, setRole] = useState('klant');
    return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Portaal" }), _jsx("p", { className: "crumbs", children: "Zo zien klanten, je productiepartner en onderaannemers het portaal na het inloggen. De gegevens hier zijn een voorbeeld." }), _jsx(Tabs, { tabs: [
                    { id: 'klant', label: 'Klant' },
                    { id: 'partner', label: 'Partner (productie)' },
                    { id: 'onderaannemer', label: 'Onderaannemer' },
                ], active: role, onChange: setRole }), _jsx("div", { className: "portal-frame", children: _jsx(Portal, { role: role, preview: true }) })] }));
}
