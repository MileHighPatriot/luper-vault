import { Link, Outlet } from 'react-router-dom'
import { BookOpenText, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const APP_NAME = 'The Luper Ledger'

export function PhaseBadge() {
  return (
    <Badge variant="accent" title="Foundation, parent inbox, and Add earn. Kid screens, rewards, and the calendar gate land in Phases 4–6.">
      Phase 3 of 6
    </Badge>
  )
}

export function AppShell() {
  const { user, isAdmin, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <BookOpenText className="size-5 text-primary" aria-hidden />
            <span>{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <PhaseBadge />
            {user && (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user.name}
                  {isAdmin ? ' (admin)' : ''}
                </span>
                <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
                  <LogOut className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 text-xs text-muted-foreground">
          Phase 3 of 6. Kid Earn, Rewards, and the calendar gate arrive in later phases.
        </div>
      </footer>
    </div>
  )
}
