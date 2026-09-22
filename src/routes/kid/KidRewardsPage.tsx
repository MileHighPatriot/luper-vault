import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Lock, LockOpen, Megaphone, PartyPopper } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import { TIER_PERIOD } from '@/data/seed'
import type { Tier } from '@/data/types'
import { TIERS, isMeterFull, meterPercent } from '@/engine/meters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TIER_BAR: Record<Tier, string> = { T1: 'bg-tier-1', T2: 'bg-tier-2', T3: 'bg-tier-3' }
const VAULT_LABEL: Record<Tier, string> = { T1: 'Vault 1', T2: 'Vault 2', T3: 'Vault 3' }

/**
 * KID-FACING. Rewards per period, locked or unlocked from the family meter
 * fill. No prices, no personal costs, no point math beyond the fill bar.
 */
export function KidRewardsPage() {
  const [tier, setTier] = useState<Tier>('T1')
  const { window: earn } = useHouseholdClock()
  const sunday = earn.reason === 'sunday'
  const rewards = useRepositoryValue((r) => r.listRewardsForKids())
  const meters = useRepositoryValue((r) => r.getMeters())
  const meter = meters.find((m) => m.tier === tier)
  const unlocked = meter ? isMeterFull(meter) : false
  const pct = meter ? meterPercent(meter) : 0
  const list = rewards.filter((r) => r.tier === tier)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Fill a vault together and the whole crew unlocks its reward. One reward per orbit.
        </p>
      </div>

      {sunday && (
        <p
          role="status"
          data-testid="rewards-sunday"
          className="glass flex items-center gap-2 rounded-2xl border border-accent/40 px-4 py-3 text-sm font-bold"
        >
          <PartyPopper className="size-4 text-accent" aria-hidden />
          Reward day — no claims today. Time to enjoy what the family unlocked.
        </p>
      )}

      <div role="tablist" aria-label="Reward period" className="grid grid-cols-3 gap-2">
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
              onClick={() => setTier(t)}
              className={cn(
                'glass flex flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-accent/60 text-foreground shadow-[0_0_24px_-12px] shadow-accent' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{TIER_PERIOD[t]}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {full ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                {full ? 'Unlocked' : 'Locked'}
              </span>
            </button>
          )
        })}
      </div>

      {meter && (
        <div className="glass rounded-2xl border px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{VAULT_LABEL[tier]}</span>
            <span className="tabular-nums text-muted-foreground" data-testid={`rewards-${tier}-pct`}>
              {pct}% full
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`${VAULT_LABEL[tier]} fill`}
            className="h-3 w-full overflow-hidden rounded-full bg-sky-1/70"
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', TIER_BAR[tier])}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Gift className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              No {TIER_PERIOD[tier].toLowerCase()} reward is set yet. Ask a parent.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((reward) => (
            <Card
              key={reward.id}
              className={cn(unlocked && 'border-accent/60 shadow-[0_0_40px_-16px] shadow-accent/70')}
              data-testid={`reward-${reward.id}`}
            >
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <Gift className={cn('size-5', unlocked ? 'text-star' : 'text-muted-foreground')} aria-hidden />
                  {reward.title}
                  {reward.announced && (
                    <Badge variant="accent" className="gap-1">
                      <Megaphone className="size-3" aria-hidden />
                      announced
                    </Badge>
                  )}
                </CardTitle>
                {reward.blurb && <CardDescription>{reward.blurb}</CardDescription>}
              </CardHeader>
              <CardContent>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                    unlocked ? 'animate-pop bg-accent text-accent-foreground' : 'bg-sky-1/70 text-muted-foreground',
                  )}
                  data-testid={`reward-${reward.id}-state`}
                >
                  {unlocked ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                  {unlocked ? 'Unlocked' : `Locked · fill ${VAULT_LABEL[tier]}`}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!unlocked && (
        <Button asChild variant="star" className="self-start">
          <Link to="/earn">Go earn toward it</Link>
        </Button>
      )}
    </div>
  )
}
