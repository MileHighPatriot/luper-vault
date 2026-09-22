import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from './memoryRepository'
import { ClaimError } from './repository'

describe('listEarnActsForKid', () => {
  it('gives a little kid their band plus positive conduct, names only, no demerits', () => {
    const repo = createMemoryRepository()
    const acts = repo.listEarnActsForKid('kameron')
    const ids = acts.map((a) => a.id)

    // 18 little acts + 2 positive little conduct stamps
    expect(acts).toHaveLength(20)
    expect(ids).toContain('little.make-bed')
    expect(ids).toContain('little.honest')
    expect(ids).toContain('conduct.caught-good-little')
    expect(ids).toContain('conduct.outstanding-day-little')
    expect(ids).not.toContain('conduct.day-demerit-little')
    expect(ids).not.toContain('conduct.serious-little')
    expect(ids.some((id) => id.startsWith('teen.') || id.startsWith('parent.'))).toBe(false)
    expect(ids).not.toContain('conduct.caught-good-teen')

    for (const act of acts) {
      expect(act).not.toHaveProperty('points')
      expect(act).not.toHaveProperty('pathBStamp')
    }
  })

  it('gives the teen the teen catalog, which differs from the little one', () => {
    const repo = createMemoryRepository()
    const teen = repo.listEarnActsForKid('christopher')
    const little = repo.listEarnActsForKid('alea')
    const teenIds = new Set(teen.map((a) => a.id))

    // 23 teen acts + 2 positive teen conduct stamps
    expect(teen).toHaveLength(25)
    expect(teenIds.has('teen.laundry')).toBe(true)
    expect(teenIds.has('teen.help-fil')).toBe(true)
    expect(teen.find((a) => a.id === 'teen.help-fil')?.rare).toBe(true)
    expect(teenIds.has('conduct.caught-good-teen')).toBe(true)
    expect(teenIds.has('little.make-bed')).toBe(false)
    expect(little.some((a) => teenIds.has(a.id))).toBe(false)
    expect(teen.filter((a) => a.path === 'A')).toHaveLength(13)
    expect(teen.filter((a) => a.path === 'B')).toHaveLength(12)
  })

  it('returns nothing for the admin or unknown users', () => {
    const repo = createMemoryRepository()
    expect(repo.listEarnActsForKid('admin')).toEqual([])
    expect(repo.listEarnActsForKid('nobody')).toEqual([])
  })
})

describe('kid claim flow', () => {
  it('lets a kid claim a Path A act, shows it as pending, and blocks a duplicate', () => {
    const repo = createMemoryRepository()
    repo.queueClaim({ userId: 'alea', actId: 'little.read-20' })

    const mine = repo.listKidPendingClaims('alea')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ actId: 'little.read-20' })
    expect(mine[0]).not.toHaveProperty('requestedPoints')
    expect(mine[0]).not.toHaveProperty('userId')
    expect(repo.listKidPendingClaims('kameron')).toEqual([])

    expect(() => repo.queueClaim({ userId: 'alea', actId: 'little.read-20' })).toThrow(ClaimError)
    expect(() => repo.queueClaim({ userId: 'alea', actId: 'little.read-20' })).toThrow(/already waiting/)
    // Siblings can still claim the same act.
    expect(() => repo.queueClaim({ userId: 'kameron', actId: 'little.read-20' })).not.toThrow()
  })

  it('runs end to end: kid claim -> inbox -> approve -> meters, then the row clears for the kid', () => {
    const repo = createMemoryRepository()
    const claim = repo.queueClaim({ userId: 'christopher', actId: 'teen.kitchen-dinner' }) // 4 pts

    expect(repo.listPendingClaims().map((c) => c.id)).toEqual([claim.id])
    repo.approveClaim(claim.id)

    expect(repo.listKidPendingClaims('christopher')).toEqual([])
    expect(Object.fromEntries(repo.getMeters().map((m) => [m.tier, m.valueTenths]))).toEqual({
      T1: 20,
      T2: 12,
      T3: 8,
    })
    expect(repo.getVaultLastMovedAt()).toBeTruthy()
    // After approval the kid may claim the same act again (e.g. tomorrow).
    expect(() => repo.queueClaim({ userId: 'christopher', actId: 'teen.kitchen-dinner' })).not.toThrow()
  })

  it('reports no vault movement on a fresh store', () => {
    expect(createMemoryRepository().getVaultLastMovedAt()).toBeNull()
  })

  it('demo seeding is idempotent with respect to already-pending acts', () => {
    const repo = createMemoryRepository()
    const first = repo.adminSeedDemoClaims()
    const second = repo.adminSeedDemoClaims()
    const pending = repo.listPendingClaims()
    const keys = pending.map((c) => `${c.userId}:${c.actId}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(pending).toHaveLength(first.length + second.length)
  })
})

describe('kid safety: repository surface', () => {
  it('kid-facing methods never return a points field', () => {
    const repo = createMemoryRepository()
    repo.queueClaim({ userId: 'kameron', actId: 'little.dogs' })
    const payloads: unknown[] = [
      ...repo.listEarnActsForKid('kameron'),
      ...repo.listKidPendingClaims('kameron'),
      repo.getFamilySettings(),
    ]
    const json = JSON.stringify(payloads)
    expect(json).not.toMatch(/"points"/)
    expect(json).not.toMatch(/requestedPoints|editedPoints/)
    expect(json).not.toMatch(/adminPinHash|clockOverride|forceLive/)
  })
})
