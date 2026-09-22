import { useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Gift, Lock, LockOpen, Megaphone, PartyPopper, Rocket } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import { TIER_PERIOD } from '@/data/seed'
import type { KidReward, Tier } from '@/data/types'
import { TIERS, isMeterFull, meterPercent, meterPoints } from '@/engine/meters'
import { burstFrom } from '@/lib/fx'
import { useSounds } from '@/lib/useSounds'
import { cn } from '@/lib/utils'
import { ConstellationMeter } from '@/components/ConstellationMeter'
import { Button } from '@/components/ui/button'

const VAULT_LABEL: Record<Tier, string> = { T1: 'Vault 1', T2: 'Vault 2', T3: 'Vault 3' }
const TIER_HEX: Record<Tier, string> = { T1: '#7fd8b4', T2: '#6fa0ff', T3: '#c48af5' }

function isTier(value: unknown): value is Tier {
  return value === 'T1' || value === 'T2' || value === 'T3'
}

function TierPlanet({ tier, size = 28 }: { tier: Tier; size?: number }) {
  const color = TIER_HEX[tier]
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.85), ${color} 36%, color-mix(in oklab, ${color} 40%, #0b1020))`,
        boxShadow: `0 0 18px -4px ${color}`,
      }}
      aria-hidden
    />
  )
}

function RewardCapsule({ reward, unlocked, pct, tier }: { reward: KidReward; unlocked: boolean; pct: number; tier: Tier }) {
  const play = useSounds()
  const [shake, setShake] = useState(0)
  const [hint, setHint] = useState(false)

  function onTap(event: MouseEvent<HTMLButtonElement>) {
    if (unlocked) {
      burstFrom(event.currentTarget, { count: 22, distance: 130 })
      play('approve')
    } else {
      setShake((n) => n + 1)
      setHint(true)
      play('tap')
    }
  }

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`reward-${reward.id}`}
      className={cn(
        'glass group relative flex flex-col overflow-hidden rounded-3xl border text-left transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0',
        unlocked && 'border-accent/70 shadow-[0_0_48px_-16px] shadow-accent',
      )}
    >
      <span
        className="h-2 w-full"
        style={{ background: `linear-gradient(90deg, ${TIER_HEX[tier]}, transparent)` }}
        aria-hidden
      />
      <span key={shake} className={cn('flex flex-col gap-3 p-5', shake > 0 && 'animate-shake')}>
        <span className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1',
              unlocked ? 'bg-accent text-accent-foreground ring-accent' : 'bg-sky-1 text-muted-foreground ring-ivory/10',
            )}
          >
            <Gift className={cn('size-6', unlocked && 'animate-wiggle')} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
              {reward.title}
              {reward.announced && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                  <Megaphone className="size-3" aria-hidden />
                  announced
                </span>
              )}
            </span>
            {reward.blurb && <span className="block text-sm text-muted-foreground">{reward.blurb}</span>}
          </span>
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-bold',
            unlocked ? 'animate-pop bg-accent text-accent-foreground' : 'bg-sky-1/70 text-muted-foreground',
          )}
          data-testid={`reward-${reward.id}-state`}
        >
          {unlocked ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {unlocked ? 'Unlocked — tap to celebrate' : `Locked · fill ${VAULT_LABEL[tier]}`}
        </span>
        {hint && !unlocked && (
          <span className="animate-rise-in text-xs font-semibold text-accent">
            {pct}% there. Keep lighting stars!
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * KID-FACING. Rewards per period, locked or unlocked from the family meter
 * fill. No prices, no personal costs, no point math beyond the fill.
 */
export function KidRewardsPage() {
  const location = useLocation()
  const initialTier = (location.state as { tier?: unknown } | null)?.tier
  const [tier, setTier] = useState<Tier>(isTier(initialTier) ? initialTier : 'T1')
  const { window: earn } = useHouseholdClock()
  const play = useSounds()
  const sunday = earn.reason === 'sunday'
  const rewards = useRepositoryValue((r) => r.listRewardsForKids())
  const meters = useRepositoryValue((r) => r.getMeters())
  const meter = meters.find((m) => m.tier === tier)
  const unlocked = meter ? isMeterFull(meter) : false
  const pct = meter ? Math.floor(meterPercent(meter)) : 0
  const list = rewards.filter((r) => r.tier === tier)

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-rise-in">
        <h1 className="text-starlight text-4xl font-extrabold tracking-tight">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Light a whole constellation together and the crew unlocks its reward. One reward per orbit.
        </p>
      </div>

      {sunday && (
        <p
          role="status"
          data-testid="rewards-sunday"
          className="glass flex items-center gap-2 rounded-3xl border border-accent/40 px-4 py-3 text-sm font-bold"
        >
          <PartyPopper className="size-5 animate-wiggle text-accent" aria-hidden />
          Reward day — no claims today. Time to enjoy what the family unlocked.
        </p>
      )}

      <div role="tablist" aria-label="Reward period" className="grid grid-cols-3 gap-2 sm:gap-3">
        {TIERS.map((t) => {
          const m = meters.find((x) => x.tier === t)
          const full = m ? isMeterFull(m) : false
          const active = t === tier
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTier(t)
                play('tap')
              }}
              className={cn(
                'glass flex flex-col items-center gap-1.5 rounded-3xl border px-2 py-3 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'scale-[1.03] border-accent/70 text-foreground shadow-[0_0_28px_-12px] shadow-accent' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TierPlanet tier={t} size={active ? 34 : 26} />
              <span>{TIER_PERIOD[t]}</span>
              <span className={cn('flex items-center gap-1 text-[11px] font-semibold', full ? 'text-accent' : 'text-muted-foreground')}>
                {full ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                {full ? 'Unlocked' : 'Locked'}
              </span>
            </button>
          )
        })}
      </div>

      {meter && (
        <div className="glass flex flex-col gap-3 rounded-3xl border px-4 py-4 sm:flex-row sm:items-center">
          <div className="mx-auto w-full max-w-xs sm:mx-0 sm:w-72 sm:shrink-0">
            <ConstellationMeter
              tier={tier}
              percent={meter ? meterPercent(meter) : 0}
              label={`${VAULT_LABEL[tier]} fill`}
              valueNow={meterPoints(meter)}
              valueMax={meter.fill}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 sm:pl-4">
            <span className="text-sm font-bold">{VAULT_LABEL[tier]}</span>
            <span className="text-4xl font-extrabold tabular-nums" data-testid={`rewards-${tier}-pct`}>
              {pct}% full
            </span>
            <span className="text-xs text-muted-foreground">
              {unlocked ? 'Every star is lit. Enjoy it together!' : 'Each approved claim lights more of this constellation.'}
            </span>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-3xl border py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-sky-1 text-star ring-1 ring-accent/30">
            <Gift className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            No {TIER_PERIOD[tier].toLowerCase()} reward is set yet. Ask a parent.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((reward) => (
            <RewardCapsule key={reward.id} reward={reward} unlocked={unlocked} pct={pct} tier={tier} />
          ))}
        </div>
      )}

      {!unlocked && (
        <Button asChild variant="star" size="lg" className="self-start rounded-2xl">
          <Link to="/earn">
            <Rocket className="size-4" aria-hidden />
            Go earn toward it
          </Link>
        </Button>
      )}
    </div>
  )
}
