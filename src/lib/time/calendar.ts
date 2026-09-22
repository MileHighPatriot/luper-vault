import { TZDate } from '@date-fns/tz'
import { HOUSEHOLD_TIME_ZONE, toDenverParts } from './denver'

/**
 * The household calendar. Every rule here is evaluated on the America/Denver
 * wall clock, DST-safe via `TZDate`.
 *
 * Product lock:
 * - Go-live / first counted earn week: Monday 2026-09-28. Chosen as the first
 *   Monday that still preserves a full October for the month tier.
 * - Earn window: Monday–Saturday until ~8:00 PM Denver. Path A claims after
 *   the cutoff are rejected.
 * - Sunday: celebrate / reward day. No Path A claims.
 * - Month tier (T2): calendar months. Sep 28–30 earns still feed every vault
 *   through the 50/30/20 split, but the month tier officially opens Oct 1 and
 *   October 1–31, 2026 is the first full month.
 * - Quarter tier (T3): starts Oct 1, 2026 as "Fall 2026".
 */

export const GO_LIVE_DATE_KEY = '2026-09-28'
export const MONTH_TIER_OPENS_DATE_KEY = '2026-10-01'
export const QUARTER_TIER_OPENS_DATE_KEY = '2026-10-01'
export const CUTOFF_HOUR = 20
export const CUTOFF_MINUTE = 0
export const CUTOFF_LABEL = '8:00 PM'

/** Build an instant from Denver wall-clock parts. Month is 1-12. */
export function denverInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(new TZDate(year, month - 1, day, hour, minute, 0, 0, HOUSEHOLD_TIME_ZONE).getTime())
}

function keyToInstant(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return denverInstant(y, m, d)
}

export const GO_LIVE_AT = keyToInstant(GO_LIVE_DATE_KEY)
export const MONTH_TIER_OPENS_AT = keyToInstant(MONTH_TIER_OPENS_DATE_KEY)

export function isBeforeGoLive(now: Date): boolean {
  return now.getTime() < GO_LIVE_AT.getTime()
}

export function isMonthTierOpen(now: Date): boolean {
  return now.getTime() >= MONTH_TIER_OPENS_AT.getTime()
}

export function isCelebrateSunday(now: Date): boolean {
  return toDenverParts(now).weekday === 0
}

/** Monday–Saturday on the Denver calendar. */
export function isEarnDay(now: Date): boolean {
  return !isCelebrateSunday(now)
}

/** True from 8:00 PM Denver until midnight, on any day. */
export function isPastCutoff(now: Date): boolean {
  const { hour, minute } = toDenverParts(now)
  return hour > CUTOFF_HOUR || (hour === CUTOFF_HOUR && minute >= CUTOFF_MINUTE)
}

export type EarnClosedReason = 'before-go-live' | 'sunday' | 'after-cutoff'

export interface EarnWindow {
  open: boolean
  reason?: EarnClosedReason
  /** Kid-facing copy. */
  message: string
  /** When the window next opens, if closed. */
  reopensAt?: Date
}

export interface EarnWindowOptions {
  /** Parent testing switch: treat the app as live before 2026-09-28. Never bypasses Sunday or the cutoff. */
  forceLive?: boolean
}

/** Start of the next Denver calendar day. */
function nextDenverMidnight(now: Date): Date {
  const p = toDenverParts(now)
  return denverInstant(p.year, p.month, p.day + 1)
}

/** Next Monday 00:00 Denver strictly after `now`. */
function nextMondayStart(now: Date): Date {
  const p = toDenverParts(now)
  const daysToMonday = ((8 - p.weekday) % 7) || 7
  return denverInstant(p.year, p.month, p.day + daysToMonday)
}

/** Can a kid send a Path A claim right now? */
export function earnWindow(now: Date, opts: EarnWindowOptions = {}): EarnWindow {
  if (isBeforeGoLive(now) && !opts.forceLive) {
    return {
      open: false,
      reason: 'before-go-live',
      message: 'The vault opens Monday, Sep 28. Look around all you like; nothing counts yet.',
      reopensAt: GO_LIVE_AT,
    }
  }
  if (isCelebrateSunday(now)) {
    return {
      open: false,
      reason: 'sunday',
      message: 'Reward day. No claims today; check Rewards and Wins instead.',
      reopensAt: nextDenverMidnight(now),
    }
  }
  if (isPastCutoff(now)) {
    const saturday = toDenverParts(now).weekday === 6
    return {
      open: false,
      reason: 'after-cutoff',
      message: saturday
        ? `Claims closed at ${CUTOFF_LABEL}. Tomorrow is reward day; the vault reopens Monday.`
        : `Claims closed for tonight at ${CUTOFF_LABEL}. Back tomorrow morning.`,
      reopensAt: saturday ? nextMondayStart(now) : nextDenverMidnight(now),
    }
  }
  return { open: true, message: `Claims are open until ${CUTOFF_LABEL} tonight.` }
}

// --- seasons and period boundaries ------------------------------------------

export function seasonLabel(now: Date): string {
  const { year, month } = toDenverParts(now)
  if (month >= 10) return `Fall ${year}`
  if (month >= 7) return `Summer ${year}`
  if (month >= 4) return `Spring ${year}`
  return `Winter ${year}`
}

/** Saturday 8:00 PM Denver of the current Sun–Sat week (or the next one if that has passed). */
export function weekCutoffAt(now: Date): Date {
  const p = toDenverParts(now)
  let cutoff = denverInstant(p.year, p.month, p.day + (6 - p.weekday), CUTOFF_HOUR, CUTOFF_MINUTE)
  if (cutoff.getTime() <= now.getTime()) {
    cutoff = denverInstant(p.year, p.month, p.day + (6 - p.weekday) + 7, CUTOFF_HOUR, CUTOFF_MINUTE)
  }
  return cutoff
}

/** Midnight Denver at the start of next month. */
export function monthEndAt(now: Date): Date {
  const p = toDenverParts(now)
  return denverInstant(p.year, p.month + 1, 1)
}

/** Midnight Denver at the start of the next quarter. */
export function quarterEndAt(now: Date): Date {
  const p = toDenverParts(now)
  const nextQuarterMonth = Math.ceil(p.month / 3) * 3 + 1
  return denverInstant(p.year, nextQuarterMonth, 1)
}

export interface Countdown {
  kind: 'week' | 'month' | 'quarter'
  label: string
  /** What the countdown runs to. */
  target: Date
  /** Milliseconds until `target` (never negative). */
  remainingMs: number
  /** Extra line, e.g. season name or "opens Oct 1". */
  detail: string
}

/**
 * Real remaining time for the kid Home chips. Before Oct 1 the month and
 * quarter chips count to their opening instead of an end that has not started.
 */
export function countdowns(now: Date): Countdown[] {
  const week = weekCutoffAt(now)
  const monthOpen = isMonthTierOpen(now)
  const month = monthOpen ? monthEndAt(now) : MONTH_TIER_OPENS_AT
  const quarter = monthOpen ? quarterEndAt(now) : MONTH_TIER_OPENS_AT
  const remaining = (t: Date) => Math.max(0, t.getTime() - now.getTime())
  return [
    {
      kind: 'week',
      label: 'Week cutoff',
      target: week,
      remainingMs: remaining(week),
      detail: `Saturday ${CUTOFF_LABEL} Denver`,
    },
    {
      kind: 'month',
      label: monthOpen ? 'Month ends' : 'Month tier opens',
      target: month,
      remainingMs: remaining(month),
      detail: monthOpen ? denverMonthName(now) : 'October is the first full month',
    },
    {
      kind: 'quarter',
      label: monthOpen ? 'Quarter ends' : 'Quarter opens',
      target: quarter,
      remainingMs: remaining(quarter),
      detail: monthOpen ? seasonLabel(now) : 'Fall 2026 starts Oct 1',
    },
  ]
}

function denverMonthName(now: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: HOUSEHOLD_TIME_ZONE, month: 'long', year: 'numeric' }).format(now)
}

/** "2d 5h", "5h 12m", "12m", or "now". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now'
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${Math.max(1, minutes)}m`
}
