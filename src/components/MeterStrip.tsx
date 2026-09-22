import { useRepositoryValue } from '@/data/RepositoryContext'
import { meterPercent, meterPoints } from '@/engine/meters'

/** Compact family-meter readout for parent screens. Family-wide only; nothing personal. */
export function MeterStrip({ testIdPrefix = 'meter' }: { testIdPrefix?: string }) {
  const meters = useRepositoryValue((r) => r.getMeters())
  return (
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Family meters">
      {meters.map((m) => (
        <div key={m.tier} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">{m.tier}</span>
          <span className="tabular-nums">
            <span className="font-semibold" data-testid={`${testIdPrefix}-${m.tier}`}>
              {meterPoints(m)}
            </span>
            <span className="text-muted-foreground">
              {' '}
              / {m.fill} · {meterPercent(m)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
