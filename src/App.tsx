import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { RepositoryProvider } from '@/data/RepositoryContext'
import { AdminLayout } from '@/components/AdminLayout'
import { AppShell } from '@/components/AppShell'
import { KidLayout } from '@/components/KidLayout'
import { RequireAdmin, RequireAuth, RequireKid } from '@/components/RequireAuth'
import { AddEarnPage } from '@/routes/AddEarnPage'
import { AdminVerifyPage } from '@/routes/AdminVerifyPage'
import { DevToolsPage } from '@/routes/DevToolsPage'
import { InboxPage } from '@/routes/InboxPage'
import { LedgerPage } from '@/routes/LedgerPage'
import { LoginPage } from '@/routes/LoginPage'
import { ClockPage } from '@/routes/ClockPage'
import { ParentConsole } from '@/routes/ParentConsole'
import { RewardsBuilderPage } from '@/routes/RewardsBuilderPage'
import { KidEarnPage } from '@/routes/kid/KidEarnPage'
import { KidHomePage } from '@/routes/kid/KidHomePage'
import { KidRewardsPage } from '@/routes/kid/KidRewardsPage'
import { KidWinsPage } from '@/routes/kid/KidWinsPage'

/** `/` lands on the parent console for the admin and the kid home for everyone else. */
function RoleHome() {
  const { isAdmin } = useAuth()
  return <Navigate to={isAdmin ? '/admin' : '/home'} replace />
}

export default function App() {
  return (
    <RepositoryProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route index element={<RoleHome />} />
              </Route>
              <Route element={<RequireKid />}>
                <Route element={<KidLayout />}>
                  <Route path="/home" element={<KidHomePage />} />
                  <Route path="/earn" element={<KidEarnPage />} />
                  <Route path="/rewards" element={<KidRewardsPage />} />
                  <Route path="/wins" element={<KidWinsPage />} />
                </Route>
              </Route>
              <Route path="/admin" element={<RequireAdmin />}>
                <Route index element={<ParentConsole />} />
                <Route element={<AdminLayout />}>
                  <Route path="inbox" element={<InboxPage />} />
                  <Route path="add-earn" element={<AddEarnPage />} />
                  <Route path="rewards" element={<RewardsBuilderPage />} />
                  <Route path="ledger" element={<LedgerPage />} />
                  <Route path="clock" element={<ClockPage />} />
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
