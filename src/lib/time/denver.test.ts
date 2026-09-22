import { describe, expect, it } from 'vitest'
import { denverDateKey, formatDenver, isDenverSunday, toDenverParts } from './denver'

describe('Denver time helpers', () => {
  it('converts a UTC instant to Denver wall-clock time (MDT, UTC-6)', () => {
    // 2026-09-23T02:30:00Z is 8:30 PM on Tue Sep 22 in Denver.
    const parts = toDenverParts(new Date('2026-09-23T02:30:00Z'))
    expect(parts).toMatchObject({ year: 2026, month: 9, day: 22, hour: 20, minute: 30, weekday: 2 })
  })

  it('handles standard time (MST, UTC-7)', () => {
    // 2026-01-11T06:59:00Z is 11:59 PM on Sat Jan 10 in Denver.
    const parts = toDenverParts(new Date('2026-01-11T06:59:00Z'))
    expect(parts).toMatchObject({ month: 1, day: 10, hour: 23, minute: 59, weekday: 6 })
  })

  it('keys days by the Denver calendar, not UTC', () => {
    expect(denverDateKey(new Date('2026-09-23T02:30:00Z'))).toBe('2026-09-22')
    expect(denverDateKey(new Date('2026-09-23T07:30:00Z'))).toBe('2026-09-23')
  })

  it('detects Denver Sundays across the UTC boundary', () => {
    // Sunday 11 PM Denver = Monday 05:00Z
    expect(isDenverSunday(new Date('2026-09-28T05:00:00Z'))).toBe(true)
    // Monday 12:01 AM Denver
    expect(isDenverSunday(new Date('2026-09-28T06:01:00Z'))).toBe(false)
  })

  it('formats with the Denver zone name', () => {
    expect(formatDenver(new Date('2026-09-23T02:30:00Z'))).toMatch(/MDT/)
  })
})
