import { useRepositoryValue } from '@/data/RepositoryContext'
import type { Tier } from '@/data/types'
import { meterPercent, meterPoints } from '@/engine/meters'
import { cn } from '@/lib/utils'

const TIER_DOT: Record<Tier, string> = { T1: 'bg-tier-1', T2: 'bg-tier-2', T3: 'bg-tier-3' }

/**
 * Compact family-meter readout for Ground Control. Family-wide only; nothing
 * personal. The value pops when it changes (keyed remount), which is the
 * "star tick" after an approve.
 */
export function MeterStrip({ testIdPrefix = 'meter' }: { testIdPrefix?: string }) {
  const meters = useRepositoryValue((r) => r.getMeters())
  return (
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Family meters">
      {meters.map((m) => {
        const points = meterPoints(m)
        return (
          <div key={m.tier} className="glass flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={cn('size-2 rounded-full', TIER_DOT[m.tier])} aria-hidden />
              {m.tier}
            </span>
            <span className="tabular-nums">
              <span key={points} className="inline-block animate-pop font-bold motion-reduce:animate-none" data-testid={`${testIdPrefix}-${m.tier}`}>
                {points}
              </span>
              <span className="text-muted-foreground">
                {' '}
                / {m.fill} · {meterPercent(m)}%
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
