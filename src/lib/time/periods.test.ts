import { describe, expect, it } from 'vitest'
import { describeDaysLeft, periodCountdowns } from './periods'

function byKind(date: Date) {
  return Object.fromEntries(periodCountdowns(date).map((p) => [p.kind, p]))
}

describe('periodCountdowns (placeholder boundaries)', () => {
  it('counts to Saturday, month end, and quarter end in Denver time', () => {
    // Tue Sep 22 2026, 8:30 PM Denver (Wed 02:30Z)
    const p = byKind(new Date('2026-09-23T02:30:00Z'))
    expect(p.week).toMatchObject({ daysLeft: 5, endsOn: '2026-09-26' })
    expect(p.month).toMatchObject({ daysLeft: 9, endsOn: '2026-09-30' })
    expect(p.quarter).toMatchObject({ daysLeft: 9, endsOn: '2026-09-30' })
  })

  it('reports "ends today" on a Saturday that is also month and quarter end', () => {
    // Sat Dec 31 2022 noon Denver
    const p = byKind(new Date('2022-12-31T19:00:00Z'))
    expect(p.week.daysLeft).toBe(1)
    expect(p.month).toMatchObject({ daysLeft: 1, endsOn: '2022-12-31' })
    expect(p.quarter).toMatchObject({ daysLeft: 1, endsOn: '2022-12-31' })
  })

  it('uses the Denver day, not UTC, at the boundary', () => {
    // 05:30Z on Oct 1 is still Sep 30, 11:30 PM in Denver (MDT).
    const p = byKind(new Date('2026-10-01T05:30:00Z'))
    expect(p.month).toMatchObject({ daysLeft: 1, endsOn: '2026-09-30' })
    expect(p.quarter.endsOn).toBe('2026-09-30')
  })

  it('handles quarters that start mid-year and leap Februaries', () => {
    // Sun Feb 1 2032 (leap year), noon Denver
    const p = byKind(new Date('2032-02-01T19:00:00Z'))
    expect(p.week).toMatchObject({ daysLeft: 7, endsOn: '2032-02-07' })
    expect(p.month).toMatchObject({ daysLeft: 29, endsOn: '2032-02-29' })
    expect(p.quarter).toMatchObject({ daysLeft: 29 + 31, endsOn: '2032-03-31' })
  })
})

describe('describeDaysLeft', () => {
  it('reads naturally', () => {
    expect(describeDaysLeft(1)).toBe('Ends today')
    expect(describeDaysLeft(2)).toBe('Ends tomorrow')
    expect(describeDaysLeft(9)).toBe('9 days left')
  })
})
