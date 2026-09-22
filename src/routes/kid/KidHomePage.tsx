import { Link } from 'react-router-dom'
import { BookOpenText, CalendarDays, Coins, PartyPopper, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import type { Tier, VaultMeter } from '@/data/types'
import { meterPercent, meterPoints } from '@/engine/meters'
import { CUTOFF_LABEL, countdowns, formatRemaining } from '@/lib/time/calendar'
import { formatDenver } from '@/lib/time/denver'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { SurpriseFlare } from '@/components/SurpriseFlare'
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
  const verse = useRepositoryValue((r) => r.getFamilySettings().verse)
  const lastMovedAt = useRepositoryValue((r) => r.getVaultLastMovedAt())
  const { now, window: earn } = useHouseholdClock()
  const chips = countdowns(now)
  const sunday = earn.reason === 'sunday'

  const movedRecently = lastMovedAt !== null && now.getTime() - new Date(lastMovedAt).getTime() < RECENT_WINDOW_MS

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi, {user?.name}.</h1>
          <p className="text-sm text-muted-foreground">
            {sunday
              ? 'Reward day. Nothing to claim; enjoy what the family unlocked.'
              : 'This is the family vault. Everyone fills it together.'}
          </p>
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

      {user && <SurpriseFlare userId={user.id} />}
      {user && <AnnouncementBanner userId={user.id} />}

      {sunday && (
        <div
          role="status"
          data-testid="sunday-mode"
          className="flex flex-col gap-3 rounded-xl border border-accent-foreground/20 bg-accent p-4 text-accent-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Reward day — no claims today</p>
              <p className="opacity-80">Sundays are for celebrating. Claims reopen Monday morning.</p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <Button asChild size="sm" variant="outline" className="bg-card">
              <Link to="/rewards">Rewards</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="bg-card">
              <Link to="/wins">Wins</Link>
            </Button>
          </div>
        </div>
      )}

      <section aria-labelledby="vault-heading" className="space-y-3">
        <h2 id="vault-heading" className="text-lg font-semibold">
          Family vault
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {meters.map((m) => (
            <FamilyMeter key={m.tier} meter={m} />
          ))}
        </div>
        {earn.open ? (
          <Button asChild>
            <Link to="/earn">
              <Coins className="size-4" aria-hidden />
              Go earn
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="earn-closed-home">
            {earn.message}
            {earn.reopensAt ? ` Opens ${formatDenver(earn.reopensAt)}.` : ''}
          </p>
        )}
      </section>

      <section aria-labelledby="countdown-heading" className="space-y-3">
        <h2 id="countdown-heading" className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden />
          Time left
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {chips.map((c) => (
            <div key={c.kind} className="rounded-xl border bg-card px-4 py-3" data-testid={`countdown-${c.kind}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold tabular-nums">{formatRemaining(c.remainingMs)}</p>
              <p className="text-xs text-muted-foreground">
                {c.detail} · {formatDenver(c.target)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Earn Monday–Saturday until {CUTOFF_LABEL} Denver. Sunday is reward day.
        </p>
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
