import { describe, expect, it } from 'vitest'
import {
  GO_LIVE_AT,
  MONTH_TIER_OPENS_AT,
  countdowns,
  denverInstant,
  earnWindow,
  formatRemaining,
  isBeforeGoLive,
  isCelebrateSunday,
  isEarnDay,
  isMonthTierOpen,
  isPastCutoff,
  monthEndAt,
  quarterEndAt,
  seasonLabel,
  weekCutoffAt,
} from './calendar'

// Handy Denver instants. Sep 2026 is MDT (UTC-6); Nov 2 onward is MST (UTC-7).
const TUE_SEP_22_3PM = denverInstant(2026, 9, 22, 15) // before go-live
const MON_SEP_28_9AM = denverInstant(2026, 9, 28, 9) // go-live day
const MON_SEP_28_759PM = denverInstant(2026, 9, 28, 19, 59)
const MON_SEP_28_800PM = denverInstant(2026, 9, 28, 20, 0)
const MON_SEP_28_801PM = denverInstant(2026, 9, 28, 20, 1)
const TUE_SEP_29_3PM = denverInstant(2026, 9, 29, 15)
const SAT_OCT_3_759PM = denverInstant(2026, 10, 3, 19, 59)
const SAT_OCT_3_800PM = denverInstant(2026, 10, 3, 20, 0)
const SAT_OCT_3_830PM = denverInstant(2026, 10, 3, 20, 30)
const SUN_OCT_4_10AM = denverInstant(2026, 10, 4, 10)

describe('locked constants', () => {
  it('go-live is Monday Sep 28 2026 00:00 Denver (MDT)', () => {
    expect(GO_LIVE_AT.toISOString()).toBe('2026-09-28T06:00:00.000Z')
  })
  it('month tier opens Oct 1 2026 00:00 Denver', () => {
    expect(MONTH_TIER_OPENS_AT.toISOString()).toBe('2026-10-01T06:00:00.000Z')
  })
})

describe('gates', () => {
  it('go-live boundary', () => {
    expect(isBeforeGoLive(TUE_SEP_22_3PM)).toBe(true)
    expect(isBeforeGoLive(new Date(GO_LIVE_AT.getTime() - 1))).toBe(true)
    expect(isBeforeGoLive(GO_LIVE_AT)).toBe(false)
    expect(isBeforeGoLive(MON_SEP_28_9AM)).toBe(false)
  })

  it('month tier boundary', () => {
    expect(isMonthTierOpen(denverInstant(2026, 9, 30, 23, 59))).toBe(false)
    expect(isMonthTierOpen(MONTH_TIER_OPENS_AT)).toBe(true)
  })

  it('Sunday vs earn day on the Denver calendar', () => {
    expect(isCelebrateSunday(SUN_OCT_4_10AM)).toBe(true)
    expect(isEarnDay(SUN_OCT_4_10AM)).toBe(false)
    expect(isEarnDay(MON_SEP_28_9AM)).toBe(true)
    // Sunday 11 PM Denver is Monday 05:00Z; still Sunday for us.
    expect(isCelebrateSunday(new Date('2026-10-05T05:00:00Z'))).toBe(true)
  })

  it('cutoff is Saturday 8:00 PM Denver inclusive', () => {
    expect(isPastCutoff(SAT_OCT_3_759PM)).toBe(false)
    expect(isPastCutoff(SAT_OCT_3_800PM)).toBe(true)
    expect(isPastCutoff(SAT_OCT_3_830PM)).toBe(true)
    expect(isPastCutoff(denverInstant(2026, 10, 3, 23, 59))).toBe(true)
  })

  it('weekdays have no cutoff', () => {
    expect(isPastCutoff(MON_SEP_28_800PM)).toBe(false)
    expect(isPastCutoff(MON_SEP_28_801PM)).toBe(false)
    expect(isPastCutoff(denverInstant(2026, 10, 2, 23, 59))).toBe(false) // Friday
  })

  it('cutoff survives the DST change (Nov 1 2026)', () => {
    // 8:00 PM MST on Sat Nov 7 is 03:00Z Nov 8.
    expect(isPastCutoff(new Date('2026-11-08T02:59:00Z'))).toBe(false)
    expect(isPastCutoff(new Date('2026-11-08T03:00:00Z'))).toBe(true)
    // 8:00 PM MDT on Sat Oct 31 is 02:00Z Nov 1.
    expect(isPastCutoff(new Date('2026-11-01T01:59:00Z'))).toBe(false)
    expect(isPastCutoff(new Date('2026-11-01T02:00:00Z'))).toBe(true)
  })
})

describe('earnWindow', () => {
  it('is closed before go-live unless forceLive', () => {
    const closed = earnWindow(TUE_SEP_22_3PM)
    expect(closed.open).toBe(false)
    expect(closed.reason).toBe('before-go-live')
    expect(closed.message).toMatch(/Sep 28/)
    expect(closed.reopensAt?.getTime()).toBe(GO_LIVE_AT.getTime())

    expect(earnWindow(TUE_SEP_22_3PM, { forceLive: true }).open).toBe(true)
  })

  it('forceLive never bypasses Sunday or the cutoff', () => {
    expect(earnWindow(denverInstant(2026, 9, 27, 10), { forceLive: true }).reason).toBe('sunday')
    expect(earnWindow(denverInstant(2026, 9, 26, 20, 5), { forceLive: true }).reason).toBe('after-cutoff')
  })

  it('Sunday is celebrate day', () => {
    const w = earnWindow(SUN_OCT_4_10AM)
    expect(w).toMatchObject({ open: false, reason: 'sunday' })
    expect(w.message).toMatch(/Reward day/)
    expect(w.reopensAt?.toISOString()).toBe(denverInstant(2026, 10, 5).toISOString())
  })

  it('weekday nights stay open all day', () => {
    expect(earnWindow(MON_SEP_28_801PM)).toMatchObject({ open: true, message: 'Claims are open all day.' })
    expect(earnWindow(MON_SEP_28_801PM).closesTonight).toBeUndefined()
    expect(earnWindow(TUE_SEP_29_3PM).open).toBe(true)
    expect(earnWindow(MON_SEP_28_759PM).open).toBe(true)
    expect(earnWindow(denverInstant(2026, 10, 2, 23, 30)).open).toBe(true) // Friday late
  })

  it('Saturday before 8 PM is open and says it closes tonight', () => {
    expect(earnWindow(SAT_OCT_3_759PM)).toMatchObject({ open: true, closesTonight: true })
    expect(earnWindow(SAT_OCT_3_759PM).message).toMatch(/until 8:00 PM tonight/)
  })

  it('Saturday after cutoff points to Monday', () => {
    const w = earnWindow(SAT_OCT_3_830PM)
    expect(w.reason).toBe('after-cutoff')
    expect(w.message).toMatch(/reward day.*Monday/i)
    expect(w.reopensAt?.toISOString()).toBe(denverInstant(2026, 10, 5).toISOString())
  })
})

describe('period boundaries', () => {
  it('week cutoff is Saturday 8 PM of the current Sun–Sat week, or next week once passed', () => {
    expect(weekCutoffAt(TUE_SEP_29_3PM).toISOString()).toBe(denverInstant(2026, 10, 3, 20).toISOString())
    expect(weekCutoffAt(SAT_OCT_3_830PM).toISOString()).toBe(denverInstant(2026, 10, 10, 20).toISOString())
    expect(weekCutoffAt(SUN_OCT_4_10AM).toISOString()).toBe(denverInstant(2026, 10, 10, 20).toISOString())
  })

  it('month and quarter ends roll across year boundaries', () => {
    expect(monthEndAt(TUE_SEP_29_3PM).toISOString()).toBe(denverInstant(2026, 10, 1).toISOString())
    expect(monthEndAt(denverInstant(2026, 12, 15)).toISOString()).toBe(denverInstant(2027, 1, 1).toISOString())
    expect(quarterEndAt(denverInstant(2026, 10, 20)).toISOString()).toBe(denverInstant(2027, 1, 1).toISOString())
    expect(quarterEndAt(denverInstant(2027, 2, 1)).toISOString()).toBe(denverInstant(2027, 4, 1).toISOString())
  })

  it('season labels', () => {
    expect(seasonLabel(denverInstant(2026, 10, 1))).toBe('Fall 2026')
    expect(seasonLabel(denverInstant(2027, 1, 15))).toBe('Winter 2027')
    expect(seasonLabel(denverInstant(2027, 5, 1))).toBe('Spring 2027')
    expect(seasonLabel(denverInstant(2027, 8, 1))).toBe('Summer 2027')
  })
})

describe('countdowns', () => {
  it('before Oct 1, month and quarter chips count to opening on Oct 1', () => {
    const c = Object.fromEntries(countdowns(TUE_SEP_29_3PM).map((x) => [x.kind, x]))
    expect(c.week.target.toISOString()).toBe(denverInstant(2026, 10, 3, 20).toISOString())
    expect(c.month.label).toBe('Month tier opens')
    expect(c.month.target.toISOString()).toBe(MONTH_TIER_OPENS_AT.toISOString())
    expect(c.month.remainingMs).toBe(MONTH_TIER_OPENS_AT.getTime() - TUE_SEP_29_3PM.getTime())
    expect(c.quarter.label).toBe('Quarter opens')
    expect(c.quarter.detail).toMatch(/Fall 2026/)
  })

  it('from Oct 1, chips count to month end and quarter end with the season name', () => {
    const now = denverInstant(2026, 10, 20, 12)
    const c = Object.fromEntries(countdowns(now).map((x) => [x.kind, x]))
    expect(c.month.label).toBe('Month ends')
    expect(c.month.target.toISOString()).toBe(denverInstant(2026, 11, 1).toISOString())
    expect(c.month.detail).toBe('October 2026')
    expect(c.quarter.label).toBe('Quarter ends')
    expect(c.quarter.target.toISOString()).toBe(denverInstant(2027, 1, 1).toISOString())
    expect(c.quarter.detail).toBe('Fall 2026')
  })

  it('formats remaining time', () => {
    expect(formatRemaining(0)).toBe('now')
    expect(formatRemaining(30_000)).toBe('1m')
    expect(formatRemaining(12 * 60_000)).toBe('12m')
    expect(formatRemaining((5 * 60 + 12) * 60_000)).toBe('5h 12m')
    expect(formatRemaining((2 * 24 + 5) * 3_600_000 + 7 * 60_000)).toBe('2d 5h')
  })
})
