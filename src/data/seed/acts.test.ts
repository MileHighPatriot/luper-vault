import { describe, expect, it } from 'vitest'
import { EXPECTED_ACT_COUNTS, SEED_ACTS, countActsByBand } from './acts'
import { SEED_USERS } from './users'
import { createMemoryRepository } from '@/data/memoryRepository'

describe('seed catalog', () => {
  it('has the locked act counts per band (18 / 23 / 8 / 13)', () => {
    expect(countActsByBand(SEED_ACTS)).toEqual(EXPECTED_ACT_COUNTS)
    expect(EXPECTED_ACT_COUNTS).toEqual({ little: 18, teen: 23, conduct: 8, parent: 13 })
  })

  it('has unique ids', () => {
    const ids = SEED_ACTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps pathBStamp in sync with path', () => {
    for (const act of SEED_ACTS) {
      expect(act.pathBStamp).toBe(act.path === 'B')
    }
  })

  it('marks conduct and parent acts as Path B only', () => {
    const stamped = SEED_ACTS.filter((a) => a.band === 'conduct' || a.band === 'parent')
    expect(stamped.every((a) => a.path === 'B')).toBe(true)
  })

  it('spot-checks locked point values', () => {
    const points = (id: string) => SEED_ACTS.find((a) => a.id === id)?.points
    expect(points('little.make-bed')).toBe(2)
    expect(points('little.honest')).toBe(5)
    expect(points('little.school-growth')).toBe(6)
    expect(points('teen.solo-meal')).toBe(8)
    expect(points('teen.homework-no-reminders')).toBe(1)
    expect(points('teen.help-fil')).toBe(5)
    expect(points('conduct.caught-good-little')).toBe(4)
    expect(points('conduct.caught-good-teen')).toBe(3)
    expect(points('conduct.outstanding-day-little')).toBe(7)
    expect(points('conduct.outstanding-day-teen')).toBe(5)
    expect(points('conduct.day-demerit-little')).toBe(-5)
    expect(points('conduct.day-demerit-teen')).toBe(-7)
    expect(points('conduct.serious-little')).toBe(-10)
    expect(points('conduct.serious-teen')).toBe(-14)
    expect(points('parent.stick-to-word')).toBe(5)
    expect(points('parent.day-demerit')).toBe(-5)
  })

  it('flags the rare FIL act', () => {
    expect(SEED_ACTS.find((a) => a.id === 'teen.help-fil')?.rare).toBe(true)
  })

  it('seeds the four users with the right roles and bands', () => {
    expect(SEED_USERS.map((u) => [u.name, u.role, u.band])).toEqual([
      ['Kameron', 'little', 'little'],
      ['Alea', 'little', 'little'],
      ['Christopher', 'teen', 'teen'],
      ['Admin', 'admin', null],
    ])
  })
})

describe('repository seeding', () => {
  it('seeds a fresh store and applies approved points to the meters', () => {
    const repo = createMemoryRepository()
    expect(repo.listUsers()).toHaveLength(4)
    expect(countActsByBand(repo.listActs())).toEqual(EXPECTED_ACT_COUNTS)
    expect(repo.listPendingClaims()).toEqual([])
    expect(repo.adminListLedger()).toEqual([])

    repo.recordApprovedPoints({ userId: 'admin', actId: null, points: 10, note: 'simulate' })
    const meters = Object.fromEntries(repo.getMeters().map((m) => [m.tier, m.valueTenths]))
    expect(meters).toEqual({ T1: 50, T2: 30, T3: 20 })
    expect(repo.adminListLedger()).toHaveLength(1)
  })

  it('exposes no per-user total helpers', () => {
    const repo = createMemoryRepository()
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(repo))
    const personalTotalish = methodNames.filter((n) => /total|score|balance|ForUser|ByUser/i.test(n))
    expect(personalTotalish).toEqual([])
  })
})
