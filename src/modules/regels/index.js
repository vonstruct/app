import { createElement } from 'react';
import { RulesPage } from './RulesPage';
const regels = {
    id: 'regels',
    label: 'Regels',
    path: '/regels',
    routes: [{ path: '/regels', element: createElement(RulesPage) }],
};
export default regels;
