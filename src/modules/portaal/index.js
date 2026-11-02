import { createElement } from 'react';
import { PortalPreview } from './PortalPreview';
const portaal = {
    id: 'portaal',
    label: 'Portaal',
    path: '/portaal',
    routes: [{ path: '/portaal', element: createElement(PortalPreview) }],
};
export default portaal;
