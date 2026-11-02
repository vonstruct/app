import { createElement } from 'react';
import { ControlTower } from './ControlTower';
const controltower = {
    id: 'controltower',
    label: 'Control tower',
    path: '/overzicht',
    routes: [{ path: '/overzicht', element: createElement(ControlTower) }],
};
export default controltower;
