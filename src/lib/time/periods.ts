import { toDenverParts, type DenverParts } from './denver'

/**
 * Placeholder period math for the kid Home countdowns. Periods end at the end
 * of the Denver calendar day: Saturday (week), last day of month, last day of
 * quarter. The real Mon–Sat ~8pm cutoff and Sunday celebrate mode land in
 * Phase 6 and will replace these boundaries; the meters do not reset here.
 */

export type PeriodKind = 'week' | 'month' | 'quarter'

export interface PeriodCountdown {
  kind: PeriodKind
  label: string
  /** Whole Denver calendar days left including today. 1 means "ends today". */
  daysLeft: number
  /** `YYYY-MM-DD` of the last Denver day in the period. */
  endsOn: string
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function dayOfYearOrdinal(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function weekEnd(p: DenverParts): PeriodCountdown {
  // Week runs Sun..Sat here; Saturday is the last earning day.
  const daysToSaturday = 6 - p.weekday
  const end = new Date(Date.UTC(p.year, p.month - 1, p.day + daysToSaturday))
  return {
    kind: 'week',
    label: 'This week',
    daysLeft: daysToSaturday + 1,
    endsOn: key(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()),
  }
}

function monthEnd(p: DenverParts): PeriodCountdown {
  const last = daysInMonth(p.year, p.month)
  return {
    kind: 'month',
    label: 'This month',
    daysLeft: last - p.day + 1,
    endsOn: key(p.year, p.month, last),
  }
}

function quarterEnd(p: DenverParts): PeriodCountdown {
  const lastMonth = Math.ceil(p.month / 3) * 3
  const lastDay = daysInMonth(p.year, lastMonth)
  const daysLeft = dayOfYearOrdinal(p.year, lastMonth, lastDay) - dayOfYearOrdinal(p.year, p.month, p.day) + 1
  return {
    kind: 'quarter',
    label: 'This quarter',
    daysLeft,
    endsOn: key(p.year, lastMonth, lastDay),
  }
}

export function periodCountdowns(date: Date = new Date()): PeriodCountdown[] {
  const parts = toDenverParts(date)
  return [weekEnd(parts), monthEnd(parts), quarterEnd(parts)]
}

export function describeDaysLeft(daysLeft: number): string {
  if (daysLeft <= 1) return 'Ends today'
  if (daysLeft === 2) return 'Ends tomorrow'
  return `${daysLeft} days left`
}
