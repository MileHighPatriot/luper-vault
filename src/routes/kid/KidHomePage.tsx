import { Link } from 'react-router-dom'
import { CalendarClock, Moon, PartyPopper, Rocket, Sparkles, Telescope, Timer } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import type { KidReward, Tier, VaultMeter } from '@/data/types'
import { isMeterFull, meterPercent, meterPoints } from '@/engine/meters'
import { CUTOFF_LABEL, countdowns, formatRemaining, type Countdown } from '@/lib/time/calendar'
import { formatDenver, toDenverParts } from '@/lib/time/denver'
import { burstFrom } from '@/lib/fx'
import { crewStyle, greetingFor } from '@/lib/crew'
import { useSounds } from '@/lib/useSounds'
import { cn } from '@/lib/utils'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { ConstellationMeter } from '@/components/ConstellationMeter'
import { PlanetAvatar } from '@/components/PlanetAvatar'
import { SurpriseFlare } from '@/components/SurpriseFlare'
import { Button } from '@/components/ui/button'

const TIER_LABEL: Record<Tier, string> = { T1: 'Vault 1', T2: 'Vault 2', T3: 'Vault 3' }
const TIER_PERIOD_NAME: Record<Tier, string> = { T1: 'Week', T2: 'Month', T3: 'Quarter' }
const TIER_TEXT: Record<Tier, string> = { T1: 'text-tier-1', T2: 'text-tier-2', T3: 'text-tier-3' }
const CLOCK_ICON: Record<Countdown['kind'], typeof Timer> = { week: Timer, month: CalendarClock, quarter: Telescope }

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

function fmt(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

function FamilyConstellation({ meter, rewards }: { meter: VaultMeter; rewards: KidReward[] }) {
  const play = useSounds()
  const pct = Math.floor(meterPercent(meter))
  const full = isMeterFull(meter)
  const titles = rewards.map((r) => r.title)
  return (
    <Link
      to="/rewards"
      state={{ tier: meter.tier }}
      onClick={(e) => {
        burstFrom(e.currentTarget, { count: 10, distance: 70 })
        play('tap')
      }}
      className={cn(
        'glass group flex flex-col gap-2 rounded-3xl border p-4 transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0',
        full && 'border-accent/70 shadow-[0_0_48px_-18px] shadow-accent',
      )}
      aria-label={`${TIER_LABEL[meter.tier]}, ${pct}% full. See ${TIER_PERIOD_NAME[meter.tier].toLowerCase()} rewards.`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold">
          {TIER_LABEL[meter.tier]}{' '}
          <span className={cn('font-semibold', TIER_TEXT[meter.tier])}>· {TIER_PERIOD_NAME[meter.tier]}</span>
        </span>
        <span className="text-2xl font-extrabold tabular-nums" data-testid={`kid-meter-${meter.tier}-pct`}>
          {pct}%
        </span>
      </div>
      <ConstellationMeter
        tier={meter.tier}
        percent={meterPercent(meter)}
        label={`${TIER_LABEL[meter.tier]} fill`}
        valueNow={meterPoints(meter)}
        valueMax={meter.fill}
      />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          Family{' '}
          <span className="font-bold text-foreground" data-testid={`kid-meter-${meter.tier}-value`}>
            {fmt(meterPoints(meter))}
          </span>{' '}
          / {meter.fill}
        </span>
        {full ? (
          <span className="animate-pop rounded-full bg-accent px-2 py-0.5 font-bold text-accent-foreground">Unlocked!</span>
        ) : null}
      </div>
      <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {titles.length > 0 ? (
          <>
            <span className="font-semibold text-foreground/90">Unlocks:</span> {titles.join(' · ')}
          </>
        ) : (
          'Reward coming soon'
        )}
      </p>
    </Link>
  )
}

function MissionStatus({
  open,
  reason,
  message,
  reopensAt,
}: {
  open: boolean
  reason?: string
  message: string
  reopensAt?: Date
}) {
  if (open) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-approve/40 bg-approve/10 px-3 py-1.5 text-xs font-bold text-approve">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-approve opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-approve" />
        </span>
        Mission open until {CUTOFF_LABEL}
      </span>
    )
  }
  if (reason === 'sunday') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent">
        <PartyPopper className="size-3.5" aria-hidden />
        Reward day
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
      title={message}
    >
      <Moon className="size-3.5" aria-hidden />
      {reopensAt ? `Opens ${formatDenver(reopensAt)}` : 'Claims closed'}
    </span>
  )
}

/**
 * KID-FACING. Shows the shared family vault only. There is no personal or
 * sibling score anywhere on this screen, by design.
 */
export function KidHomePage() {
  const { user } = useAuth()
  const meters = useRepositoryValue((r) => r.getMeters())
  const rewards = useRepositoryValue((r) => r.listRewardsForKids())
  const verse = useRepositoryValue((r) => r.getFamilySettings().verse)
  const lastMovedAt = useRepositoryValue((r) => r.getVaultLastMovedAt())
  const { now, window: earn } = useHouseholdClock()
  const play = useSounds()
  const chips = countdowns(now)
  const sunday = earn.reason === 'sunday'
  const crew = crewStyle(user?.id)
  const greeting = greetingFor(toDenverParts(now).hour)

  const movedRecently = lastMovedAt !== null && now.getTime() - new Date(lastMovedAt).getTime() < RECENT_WINDOW_MS

  return (
    <div className="flex flex-col gap-8">
      <section className="flex animate-rise-in flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {user && <PlanetAvatar userId={user.id} name={user.name} size={64} className="animate-float" />}
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              {greeting}, <span style={{ color: crew.color }}>{crew.callsign}</span>
            </p>
            <h1 className="text-starlight text-4xl font-extrabold tracking-tight">{user?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {sunday ? 'Reward day. Enjoy what the crew unlocked.' : 'Every star you earn lights up the family sky.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <MissionStatus open={earn.open} reason={earn.reason} message={earn.message} reopensAt={earn.reopensAt} />
          {movedRecently && lastMovedAt && (
            <span
              role="status"
              className="inline-flex animate-pop items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Sky moved {formatDenver(new Date(lastMovedAt))}
            </span>
          )}
        </div>
      </section>

      {user && <SurpriseFlare userId={user.id} />}
      {user && <AnnouncementBanner userId={user.id} />}

      {sunday && (
        <div
          role="status"
          data-testid="sunday-mode"
          className="glass flex flex-col gap-3 rounded-3xl border border-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 size-6 shrink-0 animate-wiggle text-accent" aria-hidden />
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

      <section aria-labelledby="vault-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="vault-heading" className="text-xl font-extrabold">
              The family sky
            </h2>
            <p className="text-xs text-muted-foreground">Three vaults, three constellations. Tap one to see its reward.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {meters.map((m) => (
            <FamilyConstellation key={m.tier} meter={m} rewards={rewards.filter((r) => r.tier === m.tier)} />
          ))}
        </div>
        {earn.open ? (
          <Button
            asChild
            size="lg"
            variant="star"
            className="group h-14 w-full rounded-2xl text-base sm:w-auto sm:px-8"
          >
            <Link
              to="/earn"
              onClick={(e) => {
                burstFrom(e.currentTarget, { count: 16 })
                play('tap')
              }}
            >
              <Rocket
                className="size-5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-12"
                aria-hidden
              />
              Launch: go earn stars
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
        <h2 id="countdown-heading" className="text-xl font-extrabold">
          Mission clocks
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {chips.map((c) => {
            const Icon = CLOCK_ICON[c.kind]
            return (
              <div key={c.kind} className="glass flex items-center gap-3 rounded-2xl border px-4 py-3" data-testid={`countdown-${c.kind}`}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-1 text-star ring-1 ring-accent/30">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="text-xl font-extrabold tabular-nums">{formatRemaining(c.remainingMs)}</p>
                  <p className="truncate text-[11px] text-muted-foreground" title={`${c.detail} · ${formatDenver(c.target)}`}>
                    {c.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Earn Monday–Saturday until {CUTOFF_LABEL} Denver. Sunday is reward day.
        </p>
      </section>

      <figure className="glass relative overflow-hidden rounded-3xl border border-accent/40 p-6">
        <span
          className="pointer-events-none absolute -right-2 -top-6 select-none font-serif text-[9rem] leading-none text-accent/15"
          aria-hidden
        >
          “
        </span>
        <figcaption className="mb-3 flex items-center gap-2 text-sm font-bold text-accent">
          <Telescope className="size-5" aria-hidden />
          Sky log · verse of the week
        </figcaption>
        <blockquote className="relative text-xl font-semibold leading-relaxed text-ivory">{verse}</blockquote>
      </figure>
    </div>
  )
}
