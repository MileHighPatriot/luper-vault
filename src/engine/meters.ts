import type { Tier, VaultMeter } from '@/data/types'

/**
 * Pure meter math for the shared family vault.
 *
 * Every approved point (positive or negative) is split across three family
 * meters. There are no personal caps and no personal totals here: this module
 * only ever knows about the family-wide meters.
 *
 * Values are kept in integer tenths so a 50/30/20 split of any integer point
 * amount is exact (10 pts -> 50/30/20 tenths -> 5.0/3.0/2.0 pts).
 */

export const TIERS: readonly Tier[] = ['T1', 'T2', 'T3'] as const

/** Share of each approved point that lands in each meter. */
export const SPLIT: Readonly<Record<Tier, number>> = {
  T1: 0.5,
  T2: 0.3,
  T3: 0.2,
}

/** Points required to fill each meter. */
export const FILLS: Readonly<Record<Tier, number>> = {
  T1: 120,
  T2: 280,
  T3: 560,
}

export type TenthsByTier = Record<Tier, number>

export function initialMeters(): VaultMeter[] {
  return TIERS.map((tier) => ({
    tier,
    fill: FILLS[tier],
    valueTenths: 0,
    overflowTenths: 0,
  }))
}

/**
 * Split a whole-point amount 50/30/20, returned in tenths of a point.
 * Exact for any integer input (positive or negative).
 */
export function splitPoints(points: number): TenthsByTier {
  if (!Number.isInteger(points)) {
    throw new RangeError(`splitPoints expects an integer, got ${points}`)
  }
  // points * 10 tenths * share; shares are 5/10, 3/10, 2/10 so this is integer math.
  return {
    T1: points * 5,
    T2: points * 3,
    T3: points * 2,
  }
}

function applyToMeter(meter: VaultMeter, deltaTenths: number): VaultMeter {
  const fillTenths = meter.fill * 10
  // The meter is conceptually one running total; value/overflow are a view of it.
  // A demerit therefore drains overflow before it dents the visible fill, and the
  // total never drops below zero.
  const total = Math.max(0, meter.valueTenths + meter.overflowTenths + deltaTenths)
  return {
    ...meter,
    valueTenths: Math.min(total, fillTenths),
    overflowTenths: Math.max(0, total - fillTenths),
  }
}

/**
 * Apply one approved ledger entry (positive earn or negative demerit) to the
 * three family meters. Returns new meter objects; inputs are not mutated.
 *
 * Overflow above a meter's fill is tracked rather than discarded, but it never
 * changes period boundaries. Period timelines stay calendar-based (Phase 6).
 */
export function applyLedgerEntry(meters: readonly VaultMeter[], points: number): VaultMeter[] {
  const split = splitPoints(points)
  return meters.map((meter) => applyToMeter(meter, split[meter.tier]))
}

export function tenthsToPoints(tenths: number): number {
  return tenths / 10
}

export function meterPoints(meter: VaultMeter): number {
  return tenthsToPoints(meter.valueTenths)
}

export function meterOverflowPoints(meter: VaultMeter): number {
  return tenthsToPoints(meter.overflowTenths)
}

/** Fill percentage in [0, 100], rounded to one decimal. */
export function meterPercent(meter: VaultMeter): number {
  const pct = (meter.valueTenths / (meter.fill * 10)) * 100
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10
}

export function isMeterFull(meter: VaultMeter): boolean {
  return meter.valueTenths >= meter.fill * 10
}
