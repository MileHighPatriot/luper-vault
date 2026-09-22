import { Link, Outlet } from 'react-router-dom'
import { Clock, LogOut, Rocket, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import { isBeforeGoLive } from '@/lib/time/calendar'
import { formatDenver } from '@/lib/time/denver'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const APP_NAME = 'The Luper Ledger'
export const SKIN_NAME = 'Constellation Crew'

export function PhaseBadge() {
  return (
    <Badge variant="accent" title="Phase 9 of polish: Constellation Crew skin. The Monday-ready core is phases 1–6.">
      Phase 9
    </Badge>
  )
}

/** Everyone sees this until the 2026-09-28 go-live. */
function GoLiveBanner({ forceLive }: { forceLive: boolean }) {
  return (
    <div role="status" data-testid="go-live-banner" className="border-b border-accent/30 bg-accent/15 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 py-2 text-sm">
        <Rocket className="size-4 shrink-0 text-accent" aria-hidden />
        <span>
          <span className="font-semibold">Family go-live Mon Sep 28</span> — October month starts Oct 1.
          {forceLive ? ' FORCE_LIVE is on: claims are allowed for parent testing.' : ' Nothing counts yet.'}
        </span>
      </div>
    </div>
  )
}

/**
 * Shared night sky. Kids get the starfield; the admin surface ("Ground
 * Control") keeps the same palette but flat, so lists stay quick to scan.
 */
export function AppShell() {
  const { user, isAdmin, logout } = useAuth()
  const { now, isOverridden, forceLive } = useHouseholdClock()
  const familyName = useRepositoryValue((r) => r.getFamilySettings().familyName)

  return (
    <div className={cn('sky flex min-h-screen flex-col', isAdmin ? 'sky-admin' : 'sky-kid')} data-surface={isAdmin ? 'admin' : 'kid'}>
      <header className="border-b border-ivory/10 bg-sky-1/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-2 ring-1 ring-accent/40">
              <Sparkles className="size-4 text-star" aria-hidden />
            </span>
            <span className="flex flex-col leading-tight">
              <span>{APP_NAME}</span>
              <span className="text-xs font-semibold text-muted-foreground" data-testid="family-name">
                {familyName}
                {isAdmin ? ' · Ground Control' : ''}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && isOverridden && (
              <Link
                to="/admin/clock"
                className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-2.5 py-0.5 text-xs font-semibold text-foreground"
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

      <footer className="border-t border-ivory/10">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 text-xs text-muted-foreground">
          Phase 9 of polish — {SKIN_NAME} skin. Earn Mon–Sat until 8:00 PM Denver; Sunday is reward day. Go-live Mon Sep
          28, 2026; month and quarter tiers open Oct 1.
        </div>
      </footer>
    </div>
  )
}
