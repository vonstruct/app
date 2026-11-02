import { createElement } from 'react';
import { ProjectList } from './ProjectList';
import { ProjectDetail } from './ProjectDetail';
import { VersionView } from './VersionView';
const projecten = {
    id: 'projecten',
    label: 'Projecten',
    path: '/projecten',
    routes: [
        { path: '/projecten', element: createElement(ProjectList) },
        { path: '/projecten/:code', element: createElement(ProjectDetail) },
        { path: '/projecten/:code/v/:version', element: createElement(VersionView) },
    ],
};
export default projecten;
