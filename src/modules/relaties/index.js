import { createElement } from 'react';
import { RelationsPage } from './RelationsPage';
const relaties = {
    id: 'relaties',
    label: 'Relaties',
    path: '/relaties',
    routes: [{ path: '/relaties', element: createElement(RelationsPage) }],
};
export default relaties;
