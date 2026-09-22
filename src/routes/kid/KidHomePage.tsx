import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenText, CalendarDays, Coins, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import type { Tier, VaultMeter } from '@/data/types'
import { meterPercent, meterPoints } from '@/engine/meters'
import { describeDaysLeft, periodCountdowns } from '@/lib/time/periods'
import { formatDenver } from '@/lib/time/denver'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TIER_LABEL: Record<Tier, string> = { T1: 'Vault 1', T2: 'Vault 2', T3: 'Vault 3' }
const TIER_BAR: Record<Tier, string> = { T1: 'bg-tier-1', T2: 'bg-tier-2', T3: 'bg-tier-3' }

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

function fmt(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

function FamilyMeter({ meter }: { meter: VaultMeter }) {
  const pct = meterPercent(meter)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{TIER_LABEL[meter.tier]}</span>
          <span className="text-sm font-normal tabular-nums text-muted-foreground" data-testid={`kid-meter-${meter.tier}-pct`}>
            {pct}%
          </span>
        </CardTitle>
        <CardDescription>Fills at {meter.fill}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={meter.fill}
          aria-valuenow={meterPoints(meter)}
          aria-label={`${TIER_LABEL[meter.tier]} fill`}
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className={cn('h-full rounded-full transition-all', TIER_BAR[meter.tier])} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          Family total <span className="font-medium text-foreground" data-testid={`kid-meter-${meter.tier}-value`}>{fmt(meterPoints(meter))}</span> of {meter.fill}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * KID-FACING. Shows the shared family vault only. There is no personal or
 * sibling score anywhere on this screen, by design.
 */
export function KidHomePage() {
  const { user } = useAuth()
  const meters = useRepositoryValue((r) => r.getMeters())
  const verse = useRepositoryValue((r) => r.getSettings().verse)
  const lastMovedAt = useRepositoryValue((r) => r.getVaultLastMovedAt())
  // Snapshot "now" once per mount; the page is short-lived and re-mounts on navigation.
  const [now] = useState(() => new Date())
  const countdowns = periodCountdowns(now)

  const movedRecently = lastMovedAt !== null && now.getTime() - new Date(lastMovedAt).getTime() < RECENT_WINDOW_MS

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi, {user?.name}.</h1>
          <p className="text-sm text-muted-foreground">This is the family vault. Everyone fills it together.</p>
        </div>
        {movedRecently && lastMovedAt && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Vault moved {formatDenver(new Date(lastMovedAt))}
          </span>
        )}
      </div>

      <section aria-labelledby="vault-heading" className="space-y-3">
        <h2 id="vault-heading" className="text-lg font-semibold">
          Family vault
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {meters.map((m) => (
            <FamilyMeter key={m.tier} meter={m} />
          ))}
        </div>
        <Button asChild>
          <Link to="/earn">
            <Coins className="size-4" aria-hidden />
            Go earn
          </Link>
        </Button>
      </section>

      <section aria-labelledby="countdown-heading" className="space-y-3">
        <h2 id="countdown-heading" className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden />
          Time left
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {countdowns.map((c) => (
            <div key={c.kind} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold">{describeDaysLeft(c.daysLeft)}</p>
              <p className="text-xs text-muted-foreground">Through {c.endsOn}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Placeholder countdowns. The real cutoff arrives in Phase 6.</p>
      </section>

      <Card className="bg-secondary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="size-5 text-primary" aria-hidden />
            Sky log
          </CardTitle>
          <CardDescription>Verse of the week</CardDescription>
        </CardHeader>
        <CardContent>
          <blockquote className="text-base leading-relaxed">{verse}</blockquote>
        </CardContent>
      </Card>
    </div>
  )
}
