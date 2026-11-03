import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AuthGate } from './core/auth'
import { InstallPrompt } from './core/InstallPrompt'
import { UpdateCheck } from './core/UpdateCheck'
import { Layout } from './core/Layout'
import { modules } from './modules/registry'

export default function App() {
  return (
    <>
    <InstallPrompt />
    <UpdateCheck />
    <AuthGate>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            {modules.flatMap((m) => m.routes.map((r) => <Route key={m.id + r.path} path={r.path} element={r.element} />))}
            <Route path="*" element={<Navigate to={modules[0].path} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthGate>
    </>
  )
}
