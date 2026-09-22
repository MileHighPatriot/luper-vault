import { Link, Outlet } from 'react-router-dom'
import { BookOpenText, Clock, LogOut, Rocket } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import { isBeforeGoLive } from '@/lib/time/calendar'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const APP_NAME = 'The Luper Ledger'

export function PhaseBadge() {
  return (
    <Badge variant="accent" title="Phase 8 of polish: admin PIN, Settings, Audit. The Monday-ready core is phases 1–6.">
      Phase 8
    </Badge>
  )
}

/** Everyone sees this until the 2026-09-28 go-live. */
function GoLiveBanner({ forceLive }: { forceLive: boolean }) {
  return (
    <div role="status" data-testid="go-live-banner" className="border-b bg-accent text-accent-foreground">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 py-2 text-sm">
        <Rocket className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Family go-live Mon Sep 28</span> — October month starts Oct 1.
          {forceLive ? ' FORCE_LIVE is on: claims are allowed for parent testing.' : ' Nothing counts yet.'}
        </span>
      </div>
    </div>
  )
}

export function AppShell() {
  const { user, isAdmin, logout } = useAuth()
  const { now, isOverridden, forceLive } = useHouseholdClock()
  const familyName = useRepositoryValue((r) => r.getFamilySettings().familyName)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <BookOpenText className="size-5 text-primary" aria-hidden />
            <span className="flex flex-col leading-tight">
              <span>{APP_NAME}</span>
              <span className="text-xs font-normal text-muted-foreground" data-testid="family-name">
                {familyName}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && isOverridden && (
              <Link
                to="/admin/clock"
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive"
                title="A clock preview is active. Every gate uses this time."
                data-testid="clock-preview-chip"
              >
                <Clock className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Preview:</span> {formatDenver(now)}
              </Link>
            )}
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

      {isBeforeGoLive(now) && <GoLiveBanner forceLive={forceLive} />}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 text-xs text-muted-foreground">
          Phase 8 of polish — admin PIN, Settings, Audit. Earn Mon–Sat until 8:00 PM Denver; Sunday is reward day.
          Go-live Mon Sep 28, 2026; month and quarter tiers open Oct 1.
        </div>
      </footer>
    </div>
  )
}
