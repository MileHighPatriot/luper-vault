import { denverInstant } from './calendar'
import { denverDateKey, toDenverParts } from './denver'

/**
 * Surprise caps use the earn week, not the claim window.
 * The week starts Monday 00:00 Denver. Sunday is the reward day at the end of
 * that same Monday–Saturday week, so a Sunday treat counts against the week
 * that just finished. Surprises are allowed every day, including Sunday.
 */

/** Monday 00:00 Denver that opens the earn week containing `now`. */
export function earnWeekMonday(now: Date): Date {
  const p = toDenverParts(now)
  const daysSinceMonday = p.weekday === 0 ? 6 : p.weekday - 1
  return denverInstant(p.year, p.month, p.day - daysSinceMonday)
}

/** Stable key for the earn week: the Denver date of its Monday. */
export function earnWeekKey(now: Date): string {
  return denverDateKey(earnWeekMonday(now))
}

/** `YYYY-MM` for the Denver calendar month. */
export function calendarMonthKey(now: Date): string {
  const { year, month } = toDenverParts(now)
  return `${year}-${String(month).padStart(2, '0')}`
}
