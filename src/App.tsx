import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { RepositoryProvider } from '@/data/RepositoryContext'
import { AppShell } from '@/components/AppShell'
import { RequireAdmin, RequireAuth } from '@/components/RequireAuth'
import { AdminVerifyPage } from '@/routes/AdminVerifyPage'
import { HomeStub } from '@/routes/HomeStub'
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
                <Route index element={<Navigate to="/admin/verify" replace />} />
                <Route path="verify" element={<AdminVerifyPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </RepositoryProvider>
  )
}
