import { Link } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, RotateCcw } from 'lucide-react'
import { ADMIN_USER_ID, EXPECTED_ACT_COUNTS, countActsByBand } from '@/data/seed'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import type { Band, Tier, VaultMeter } from '@/data/types'
import { FILLS, SPLIT, meterOverflowPoints, meterPercent, meterPoints } from '@/engine/meters'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TIER_LABEL: Record<Tier, string> = { T1: 'Tier 1', T2: 'Tier 2', T3: 'Tier 3' }
const TIER_BAR: Record<Tier, string> = { T1: 'bg-tier-1', T2: 'bg-tier-2', T3: 'bg-tier-3' }
const BAND_ORDER: Band[] = ['little', 'teen', 'conduct', 'parent']
const BAND_LABEL: Record<Band, string> = {
  little: 'Little (Kameron, Alea)',
  teen: 'Teen (Christopher)',
  conduct: 'Conduct',
  parent: 'Parents',
}

function fmt(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

function MeterCard({ meter }: { meter: VaultMeter }) {
  const pct = meterPercent(meter)
  const overflow = meterOverflowPoints(meter)
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>{TIER_LABEL[meter.tier]}</CardTitle>
          <Badge variant="secondary">{Math.round(SPLIT[meter.tier] * 100)}% share</Badge>
        </div>
        <CardDescription>Fills at {meter.fill} points</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums" data-testid={`meter-${meter.tier}-value`}>
            {fmt(meterPoints(meter))}
            <span className="text-sm font-normal text-muted-foreground"> / {meter.fill}</span>
          </span>
          <span className="text-sm tabular-nums text-muted-foreground" data-testid={`meter-${meter.tier}-pct`}>
            {pct}%
          </span>
        </div>
        {overflow > 0 && (
          <p className="text-xs text-muted-foreground">
            Full. {fmt(overflow)} overflow points tracked; period length is unaffected.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminVerifyPage() {
  const repo = useRepository()
  const meters = useRepositoryValue((r) => r.getMeters())
  const acts = useRepositoryValue((r) => r.listActs())
  const ledger = useRepositoryValue((r) => r.adminListLedger())
  const settings = useRepositoryValue((r) => r.getSettings())
  const counts = countActsByBand(acts)
  const pathB = acts.filter((a) => a.pathBStamp).length

  function simulate(points: number) {
    repo.recordApprovedPoints({
      userId: ADMIN_USER_ID,
      actId: null,
      points,
      note: `Verify screen: simulated ${points > 0 ? '+' : ''}${points} approved points`,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden />
              Parent console
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Verify: meter engine and seed</h1>
          <p className="text-sm text-muted-foreground">
            Approved points split {Math.round(SPLIT.T1 * 100)}/{Math.round(SPLIT.T2 * 100)}/{Math.round(SPLIT.T3 * 100)} into
            family meters that fill at {FILLS.T1}/{FILLS.T2}/{FILLS.T3}. No personal caps, no personal totals.
          </p>
        </div>
      </div>

      <section aria-labelledby="meters-heading" className="space-y-4">
        <h2 id="meters-heading" className="text-lg font-semibold">
          Family vault meters
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {meters.map((meter) => (
            <MeterCard key={meter.tier} meter={meter} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => simulate(10)}>
            <Plus className="size-4" aria-hidden />
            Simulate +10 approved points
          </Button>
          <Button variant="outline" onClick={() => simulate(-5)}>
            <Minus className="size-4" aria-hidden />
            Simulate -5 demerit
          </Button>
          <Button variant="ghost" onClick={() => repo.adminResetMetersAndLedger()} disabled={ledger.length === 0}>
            <RotateCcw className="size-4" aria-hidden />
            Reset meters
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Expect +10 to move T1 +5, T2 +3, T3 +2. Ledger entries recorded this session: {ledger.length}.
          {ledger.length > 0 && ` Last at ${formatDenver(new Date(ledger[ledger.length - 1]!.createdAt))}.`}
        </p>
      </section>

      <section aria-labelledby="seed-heading" className="space-y-4">
        <h2 id="seed-heading" className="text-lg font-semibold">
          Seed catalog
        </h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Band
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Acts
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Expected
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Path B
                  </th>
                </tr>
              </thead>
              <tbody>
                {BAND_ORDER.map((band) => {
                  const ok = counts[band] === EXPECTED_ACT_COUNTS[band]
                  return (
                    <tr key={band} className="border-b last:border-0">
                      <td className="px-4 py-2">{BAND_LABEL[band]}</td>
                      <td className="px-4 py-2 text-right tabular-nums" data-testid={`count-${band}`}>
                        {counts[band]}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {EXPECTED_ACT_COUNTS[band]}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {acts.filter((a) => a.band === band && a.pathBStamp).length}
                        <Badge variant={ok ? 'secondary' : 'destructive'} className="ml-2">
                          {ok ? 'ok' : 'mismatch'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{acts.length}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {Object.values(EXPECTED_ACT_COUNTS).reduce((a, b) => a + b, 0)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{pathB}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Seeded {formatDenver(new Date(settings.seededAt))} (schema v{settings.schemaVersion}). Verse placeholder: “{settings.verse}”
        </p>
      </section>
    </div>
  )
}
