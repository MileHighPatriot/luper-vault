/**
 * America/Denver time helpers. The household clock is Denver regardless of the
 * device's zone. Cutoff / Sunday logic is Phase 6; these are just the building
 * blocks it will use.
 */

export const HOUSEHOLD_TIME_ZONE = 'America/Denver'

export interface DenverParts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number // 0-23
  minute: number
  second: number
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: HOUSEHOLD_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
})

/** Break an instant into wall-clock parts as seen in Denver. */
export function toDenverParts(date: Date = new Date()): DenverParts {
  const parts: Record<string, string> = {}
  for (const { type, value } of partsFormatter.formatToParts(date)) {
    if (type !== 'literal') parts[type] = value
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]),
  }
}

export function nowInDenver(): DenverParts {
  return toDenverParts(new Date())
}

/** `YYYY-MM-DD` for the Denver calendar day containing `date`. Stable key for daily grouping. */
export function denverDateKey(date: Date = new Date()): string {
  const { year, month, day } = toDenverParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isDenverSunday(date: Date = new Date()): boolean {
  return toDenverParts(date).weekday === 0
}

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: HOUSEHOLD_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

/** Human-readable Denver timestamp, e.g. "Tue, Sep 22, 8:14 PM MDT". */
export function formatDenver(date: Date = new Date()): string {
  return displayFormatter.format(date)
}
