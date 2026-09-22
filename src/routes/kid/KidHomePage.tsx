import { Link } from 'react-router-dom'
import { BookOpenText, CalendarDays, PartyPopper, Rocket, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import type { Tier, VaultMeter } from '@/data/types'
import { meterPercent, meterPoints } from '@/engine/meters'
import { CUTOFF_LABEL, countdowns, formatRemaining } from '@/lib/time/calendar'
import { formatDenver } from '@/lib/time/denver'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { OrbitRing } from '@/components/OrbitRing'
import { SurpriseFlare } from '@/components/SurpriseFlare'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const TIER_LABEL: Record<Tier, string> = { T1: 'Vault 1', T2: 'Vault 2', T3: 'Vault 3' }
const TIER_ORBIT: Record<Tier, string> = { T1: 'Week orbit', T2: 'Month orbit', T3: 'Quarter orbit' }

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

function fmt(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

function FamilyMeter({ meter }: { meter: VaultMeter }) {
  const pct = meterPercent(meter)
  return (
    <Card>
      <CardHeader className="pb-2 text-center">
        <CardTitle className="text-base">{TIER_LABEL[meter.tier]}</CardTitle>
        <CardDescription>{TIER_ORBIT[meter.tier]} · fills at {meter.fill}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <OrbitRing
          tier={meter.tier}
          percent={pct}
          label={`${TIER_LABEL[meter.tier]} fill`}
          valueNow={meterPoints(meter)}
          valueMax={meter.fill}
        >
          <span className="text-2xl font-extrabold tabular-nums" data-testid={`kid-meter-${meter.tier}-pct`}>
            {pct}%
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">full</span>
        </OrbitRing>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          Family total{' '}
          <span className="font-semibold text-foreground" data-testid={`kid-meter-${meter.tier}-value`}>
            {fmt(meterPoints(meter))}
          </span>{' '}
          of {meter.fill}
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
          <h1 className="text-3xl font-extrabold tracking-tight">Hi, {user?.name}.</h1>
          <p className="text-sm text-muted-foreground">
            {sunday
              ? 'Reward day. Nothing to claim; enjoy what the crew unlocked.'
              : 'This is the family vault. The whole crew fills it together.'}
          </p>
        </div>
        {movedRecently && lastMovedAt && (
          <span
            role="status"
            className="inline-flex animate-pop items-center gap-1.5 self-start rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground"
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
          className="glass flex flex-col gap-3 rounded-2xl border border-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <div className="text-sm">
              <p className="font-bold">Reward day — no claims today</p>
              <p className="text-muted-foreground">Sundays are for celebrating. Claims reopen Monday morning.</p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <Button asChild size="sm" variant="star">
              <Link to="/rewards">Rewards</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/wins">Wins</Link>
            </Button>
          </div>
        </div>
      )}

      <section aria-labelledby="vault-heading" className="space-y-3">
        <h2 id="vault-heading" className="text-lg font-bold">
          Family vault
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {meters.map((m) => (
            <FamilyMeter key={m.tier} meter={m} />
          ))}
        </div>
        {earn.open ? (
          <Button asChild size="lg" variant="star">
            <Link to="/earn">
              <Rocket className="size-4" aria-hidden />
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
        <h2 id="countdown-heading" className="flex items-center gap-2 text-lg font-bold">
          <CalendarDays className="size-5 text-star" aria-hidden />
          Time left
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {chips.map((c) => (
            <div key={c.kind} className="glass rounded-2xl border px-4 py-3" data-testid={`countdown-${c.kind}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-lg font-extrabold tabular-nums">{formatRemaining(c.remainingMs)}</p>
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

      <Card className="border-accent/30 bg-[linear-gradient(135deg,rgb(232_197_107_/_0.14),rgb(21_27_47_/_0.85)_55%)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="size-5 text-star" aria-hidden />
            Sky log
          </CardTitle>
          <CardDescription>Verse of the week</CardDescription>
        </CardHeader>
        <CardContent>
          <blockquote className="text-lg leading-relaxed text-ivory">{verse}</blockquote>
        </CardContent>
      </Card>
    </div>
  )
}
