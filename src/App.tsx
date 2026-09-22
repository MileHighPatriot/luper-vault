import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { RepositoryProvider } from '@/data/RepositoryContext'
import { AdminLayout } from '@/components/AdminLayout'
import { AppShell } from '@/components/AppShell'
import { RequireAdmin, RequireAuth } from '@/components/RequireAuth'
import { AdminVerifyPage } from '@/routes/AdminVerifyPage'
import { DevToolsPage } from '@/routes/DevToolsPage'
import { HomeStub } from '@/routes/HomeStub'
import { InboxPage } from '@/routes/InboxPage'
import { LedgerPage } from '@/routes/LedgerPage'
import { LoginPage } from '@/routes/LoginPage'

export default function App() {
  return (
    <RepositoryProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route index element={<HomeStub />} />
              </Route>
              <Route path="/admin" element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/inbox" replace />} />
                  <Route path="inbox" element={<InboxPage />} />
                  <Route path="ledger" element={<LedgerPage />} />
                  <Route path="verify" element={<AdminVerifyPage />} />
                  <Route path="dev" element={<DevToolsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </RepositoryProvider>
  )
}
