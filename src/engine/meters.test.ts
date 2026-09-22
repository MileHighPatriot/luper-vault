import { describe, expect, it } from 'vitest'
import {
  FILLS,
  SPLIT,
  applyLedgerEntry,
  initialMeters,
  isMeterFull,
  meterOverflowPoints,
  meterPercent,
  meterPoints,
  splitPoints,
} from './meters'

function byTier(meters: ReturnType<typeof initialMeters>) {
  return Object.fromEntries(meters.map((m) => [m.tier, m])) as Record<
    'T1' | 'T2' | 'T3',
    (typeof meters)[number]
  >
}

describe('constants', () => {
  it('splits 50/30/20 and fills at 120/280/560', () => {
    expect(SPLIT).toEqual({ T1: 0.5, T2: 0.3, T3: 0.2 })
    expect(SPLIT.T1 + SPLIT.T2 + SPLIT.T3).toBeCloseTo(1)
    expect(FILLS).toEqual({ T1: 120, T2: 280, T3: 560 })
  })

  it('initial meters start empty with the right fills', () => {
    const m = byTier(initialMeters())
    expect(m.T1).toEqual({ tier: 'T1', fill: 120, valueTenths: 0, overflowTenths: 0 })
    expect(m.T2.fill).toBe(280)
    expect(m.T3.fill).toBe(560)
  })
})

describe('splitPoints', () => {
  it('+10 -> 5 / 3 / 2 points (in tenths)', () => {
    expect(splitPoints(10)).toEqual({ T1: 50, T2: 30, T3: 20 })
  })

  it('-5 -> -2.5 / -1.5 / -1 points, exactly', () => {
    expect(splitPoints(-5)).toEqual({ T1: -25, T2: -15, T3: -10 })
  })

  it('always sums back to the input for any integer', () => {
    for (const p of [-14, -7, -1, 0, 1, 3, 7, 8, 120, 999]) {
      const s = splitPoints(p)
      expect(s.T1 + s.T2 + s.T3).toBe(p * 10)
    }
  })

  it('rejects non-integers', () => {
    expect(() => splitPoints(2.5)).toThrow(RangeError)
  })
})

describe('applyLedgerEntry', () => {
  it('+10 approved points moves T1 +5, T2 +3, T3 +2', () => {
    const m = byTier(applyLedgerEntry(initialMeters(), 10))
    expect(meterPoints(m.T1)).toBe(5)
    expect(meterPoints(m.T2)).toBe(3)
    expect(meterPoints(m.T3)).toBe(2)
  })

  it('does not mutate its input', () => {
    const before = initialMeters()
    applyLedgerEntry(before, 10)
    expect(before.every((m) => m.valueTenths === 0)).toBe(true)
  })

  it('-5 after +10 lands at 2.5 / 1.5 / 1', () => {
    const m = byTier(applyLedgerEntry(applyLedgerEntry(initialMeters(), 10), -5))
    expect(meterPoints(m.T1)).toBe(2.5)
    expect(meterPoints(m.T2)).toBe(1.5)
    expect(meterPoints(m.T3)).toBe(1)
  })

  it('never drops below zero', () => {
    const m = byTier(applyLedgerEntry(initialMeters(), -14))
    expect(m.T1.valueTenths).toBe(0)
    expect(m.T2.valueTenths).toBe(0)
    expect(m.T3.valueTenths).toBe(0)
    expect(m.T1.overflowTenths).toBe(0)
  })

  it('clamps at fill and tracks overflow instead of discarding it', () => {
    // 240 approved points -> T1 gets 120 (exactly full), T2 72, T3 48.
    let meters = applyLedgerEntry(initialMeters(), 240)
    let m = byTier(meters)
    expect(meterPoints(m.T1)).toBe(120)
    expect(isMeterFull(m.T1)).toBe(true)
    expect(meterOverflowPoints(m.T1)).toBe(0)

    // Another +10 -> T1 stays full, 5 pts overflow; T2/T3 keep filling.
    meters = applyLedgerEntry(meters, 10)
    m = byTier(meters)
    expect(meterPoints(m.T1)).toBe(120)
    expect(meterOverflowPoints(m.T1)).toBe(5)
    expect(meterPoints(m.T2)).toBe(75)
    expect(meterPoints(m.T3)).toBe(50)
  })

  it('demerits drain overflow before denting a full meter', () => {
    let meters = applyLedgerEntry(initialMeters(), 250) // T1 full + 5 overflow
    meters = applyLedgerEntry(meters, -4) // T1 share = -2 -> overflow 3, still full
    let m = byTier(meters)
    expect(meterPoints(m.T1)).toBe(120)
    expect(meterOverflowPoints(m.T1)).toBe(3)

    meters = applyLedgerEntry(meters, -10) // T1 share = -5 -> overflow 0, value 118
    m = byTier(meters)
    expect(meterPoints(m.T1)).toBe(118)
    expect(meterOverflowPoints(m.T1)).toBe(0)
  })

  it('has no personal cap: a single large entry is accepted in full', () => {
    const m = byTier(applyLedgerEntry(initialMeters(), 2000))
    expect(meterPoints(m.T1) + meterOverflowPoints(m.T1)).toBe(1000)
    expect(meterPoints(m.T2) + meterOverflowPoints(m.T2)).toBe(600)
    expect(meterPoints(m.T3) + meterOverflowPoints(m.T3)).toBe(400)
  })
})

describe('meterPercent', () => {
  it('reports fill percentage to one decimal, clamped to 100', () => {
    const m = byTier(applyLedgerEntry(initialMeters(), 10))
    expect(meterPercent(m.T1)).toBeCloseTo(4.2, 1) // 5 / 120
    expect(meterPercent(m.T2)).toBeCloseTo(1.1, 1) // 3 / 280
    expect(meterPercent(m.T3)).toBeCloseTo(0.4, 1) // 2 / 560

    const full = byTier(applyLedgerEntry(initialMeters(), 5000))
    expect(meterPercent(full.T1)).toBe(100)
    expect(meterPercent(initialMeters()[0]!)).toBe(0)
  })
})
