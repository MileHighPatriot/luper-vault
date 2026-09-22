import { Link } from 'react-router-dom'
import { Crown, LockOpen, Megaphone, Sparkles, Trophy } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { TIER_PERIOD } from '@/data/seed'
import type { Tier, WinKind } from '@/data/types'
import { formatDenver } from '@/lib/time/denver'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const KIND_LABEL: Record<WinKind, string> = {
  unlock: 'Unlocked',
  announce: 'Announced',
}

const TIER_RING: Record<Tier, string> = {
  T1: 'ring-tier-1/70',
  T2: 'ring-tier-2/70',
  T3: 'ring-tier-3/70',
}

/** Hex "mission badge" used for every win and surprise patch. */
function MissionBadge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('mission-badge flex size-12 shrink-0 items-center justify-center text-lg font-bold', className)}>
      {children}
    </span>
  )
}

/** KID-FACING. Family unlocks and announcements, plus this kid's seen surprise patches. */
export function KidWinsPage() {
  const { user } = useAuth()
  const wins = useRepositoryValue((r) => r.listWins())
  const surprises = useRepositoryValue((r) => (user ? r.listSeenSurprisesForKid(user.id) : []))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Wins</h1>
        <p className="text-sm text-muted-foreground">Mission badges the crew has earned together.</p>
      </div>

      {surprises.length > 0 && (
        <section aria-labelledby="surprise-patches-heading" className="space-y-3">
          <h2 id="surprise-patches-heading" className="text-lg font-bold">
            Surprise patches
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {surprises.map((surprise) => (
              <li key={surprise.id} className="glass flex items-center gap-3 rounded-2xl border border-accent/30 px-4 py-3" data-testid="surprise-patch">
                <MissionBadge>{surprise.emoji ?? <Sparkles className="size-5" aria-hidden />}</MissionBadge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{surprise.title}</span>
                    <Badge variant="accent">Surprise</Badge>
                  </div>
                  {surprise.note ? <p className="text-sm text-muted-foreground">{surprise.note}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatDenver(new Date(surprise.createdAt))}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {wins.length === 0 && surprises.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MissionBadge className="size-14 opacity-80">
              <Trophy className="size-6" aria-hidden />
            </MissionBadge>
            <p className="font-bold">No wins yet — fill the vault on Home</p>
            <Link to="/home" className="text-sm underline underline-offset-4">
              Back to Home
            </Link>
          </CardContent>
        </Card>
      ) : wins.length > 0 ? (
        <section aria-labelledby="crew-wins-heading" className="space-y-3">
          <h2 id="crew-wins-heading" className="text-lg font-bold">
            Crew wins
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {wins.map((win) => {
              const Icon = win.kind === 'unlock' ? LockOpen : Megaphone
              return (
                <li
                  key={win.id}
                  className={cn('glass flex items-center gap-3 rounded-2xl border px-4 py-3 ring-1 ring-inset', TIER_RING[win.tier])}
                >
                  <MissionBadge className={win.kind === 'announce' ? 'opacity-90' : undefined}>
                    <Icon className="size-5" aria-hidden />
                  </MissionBadge>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{win.title}</span>
                      <Badge variant={win.kind === 'unlock' ? 'default' : 'accent'}>{KIND_LABEL[win.kind]}</Badge>
                      <Badge variant="outline">{TIER_PERIOD[win.tier]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDenver(new Date(win.createdAt))}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ivory/20 px-4 py-3 text-sm text-muted-foreground">
        <Crown className="size-4" aria-hidden />
        Top earner crowns — Phase later
      </div>
    </div>
  )
}
