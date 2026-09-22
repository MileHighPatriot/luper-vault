import { useState, type FormEvent } from 'react'
import { CalendarCheck, CalendarX, Clock, FlaskConical, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react'
import { useRepository } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import {
  CUTOFF_LABEL,
  GO_LIVE_DATE_KEY,
  MONTH_TIER_OPENS_DATE_KEY,
  countdowns,
  denverInstant,
  formatRemaining,
  isBeforeGoLive,
  isCelebrateSunday,
  isMonthTierOpen,
  isPastCutoff,
  seasonLabel,
} from '@/lib/time/calendar'
import { HOUSEHOLD_TIME_ZONE, formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface Preset {
  label: string
  at: Date
}

/** Handy instants for previewing each gate. All Denver wall-clock. */
const PRESETS: Preset[] = [
  { label: 'Before go-live (Tue Sep 22, 3 PM)', at: denverInstant(2026, 9, 22, 15) },
  { label: 'Go-live Monday (Sep 28, 9 AM)', at: denverInstant(2026, 9, 28, 9) },
  { label: 'Mon Sep 28, 8:01 PM (after cutoff)', at: denverInstant(2026, 9, 28, 20, 1) },
  { label: 'Tue Sep 29, 3 PM (open)', at: denverInstant(2026, 9, 29, 15) },
  { label: 'Sat Oct 3, 8:30 PM (week closed)', at: denverInstant(2026, 10, 3, 20, 30) },
  { label: 'Sun Oct 4, 10 AM (reward day)', at: denverInstant(2026, 10, 4, 10) },
]

function StatusRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  const Icon = ok ? CalendarCheck : CalendarX
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm font-medium">
        <Icon className={ok ? 'size-4 text-primary' : 'size-4 text-muted-foreground'} aria-hidden />
        {text}
      </span>
    </div>
  )
}

/** ADMIN ONLY. Household clock status, FORCE_LIVE toggle, and dev clock preview. */
export function ClockPage() {
  const repo = useRepository()
  const { now, window: earn, isOverridden, forceLive } = useHouseholdClock(1_000)
  const [customIso, setCustomIso] = useState('')
  const [error, setError] = useState<string | null>(null)
  const chips = countdowns(now)

  function setOverride(at: Date | null) {
    try {
      repo.adminSetClockOverride(at ? at.toISOString() : null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set that time.')
    }
  }

  function submitCustom(event: FormEvent) {
    event.preventDefault()
    const parsed = new Date(customIso)
    if (Number.isNaN(parsed.getTime())) {
      setError('Enter a date/time the browser can parse, e.g. 2026-10-06T15:00:00-06:00')
      return
    }
    setOverride(parsed)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clock</h1>
        <p className="text-sm text-muted-foreground">
          Every gate runs on {HOUSEHOLD_TIME_ZONE}. Go-live {GO_LIVE_DATE_KEY}; month and quarter tiers open{' '}
          {MONTH_TIER_OPENS_DATE_KEY}. Earn Monday–Saturday until {CUTOFF_LABEL}; Sunday is reward day.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-primary" aria-hidden />
              Denver now
              {isOverridden && <Badge variant="destructive">preview</Badge>}
            </CardTitle>
            <CardDescription data-testid="denver-now">{formatDenver(now)}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <StatusRow
              label="Go-live"
              ok={!isBeforeGoLive(now)}
              text={isBeforeGoLive(now) ? `Not yet · Mon Sep 28${forceLive ? ' (FORCE_LIVE on)' : ''}` : 'Live'}
            />
            <StatusRow
              label="Earn window"
              ok={earn.open}
              text={earn.open ? `Open until ${CUTOFF_LABEL}` : `Closed · ${earn.reason?.replace(/-/g, ' ')}`}
            />
            <StatusRow label="Day" ok={!isCelebrateSunday(now)} text={isCelebrateSunday(now) ? 'Sunday · reward day' : 'Earn day'} />
            <StatusRow label="Cutoff" ok={!isPastCutoff(now)} text={isPastCutoff(now) ? `Past ${CUTOFF_LABEL}` : `Before ${CUTOFF_LABEL}`} />
            <StatusRow
              label="Month tier (T2)"
              ok={isMonthTierOpen(now)}
              text={isMonthTierOpen(now) ? 'Open · calendar months' : 'Opens Oct 1 · October is the first full month'}
            />
            <StatusRow label="Quarter tier (T3)" ok={isMonthTierOpen(now)} text={isMonthTierOpen(now) ? seasonLabel(now) : 'Opens Oct 1 · Fall 2026'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" aria-hidden />
              Parent testing
            </CardTitle>
            <CardDescription>
              FORCE_LIVE lets kids claim before Sep 28. It never bypasses Sunday or the {CUTOFF_LABEL} cutoff. Also
              settable at build time with VITE_FORCE_LIVE=true.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant={forceLive ? 'default' : 'outline'}
              onClick={() => repo.adminSetForceLive(!repo.getSettings().forceLive)}
              aria-pressed={forceLive}
              data-testid="force-live-toggle"
            >
              {forceLive ? <ToggleRight className="size-4" aria-hidden /> : <ToggleLeft className="size-4" aria-hidden />}
              FORCE_LIVE {forceLive ? 'on' : 'off'}
            </Button>

            <div className="space-y-2">
              <p className="text-sm font-medium">Clock preview (dev)</p>
              <p className="text-xs text-muted-foreground">
                Freeze the household clock to check each gate. Affects kids too while active, so clear it when done.
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button key={p.label} size="sm" variant="secondary" onClick={() => setOverride(p.at)}>
                    {p.label}
                  </Button>
                ))}
              </div>
              <form onSubmit={submitCustom} className="flex gap-2">
                <Input
                  aria-label="Custom preview time"
                  placeholder="2026-10-06T15:00:00-06:00"
                  value={customIso}
                  onChange={(e) => setCustomIso(e.target.value)}
                />
                <Button type="submit" size="sm" variant="secondary" disabled={!customIso}>
                  Set
                </Button>
              </form>
              <Button size="sm" variant="ghost" onClick={() => setOverride(null)} disabled={!isOverridden}>
                <RotateCcw className="size-4" aria-hidden />
                Use the real clock
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Countdowns the kids see</CardTitle>
          <CardDescription>Computed from the same clock.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {chips.map((c) => (
            <div key={c.kind} className="rounded-lg border px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold tabular-nums">{formatRemaining(c.remainingMs)}</p>
              <p className="text-xs text-muted-foreground">
                {c.detail} · {formatDenver(c.target)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
