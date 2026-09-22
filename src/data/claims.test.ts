import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from './memoryRepository'
import { ClaimError } from './repository'
import { denverDateKey } from '@/lib/time/denver'

function meterValues(repo: ReturnType<typeof createMemoryRepository>) {
  return Object.fromEntries(repo.getMeters().map((m) => [m.tier, m.valueTenths])) as Record<
    'T1' | 'T2' | 'T3',
    number
  >
}

describe('queueClaim', () => {
  it('queues a Path A act for a kid with catalog points', () => {
    const repo = createMemoryRepository()
    const claim = repo.queueClaim({ userId: 'kameron', actId: 'little.dogs' })
    expect(claim).toMatchObject({ userId: 'kameron', actId: 'little.dogs', requestedPoints: 3, status: 'pending' })
    expect(repo.listPendingClaims()).toHaveLength(1)
    expect(repo.adminListLedger()).toEqual([])
    expect(meterValues(repo)).toEqual({ T1: 0, T2: 0, T3: 0 })
  })

  it('rejects Path B acts', () => {
    const repo = createMemoryRepository()
    expect(() => repo.queueClaim({ userId: 'kameron', actId: 'little.honest' })).toThrow(ClaimError)
    expect(() => repo.queueClaim({ userId: 'christopher', actId: 'conduct.caught-good-teen' })).toThrow(
      /Path B/,
    )
  })

  it('rejects the admin user and unknown acts', () => {
    const repo = createMemoryRepository()
    expect(() => repo.queueClaim({ userId: 'admin', actId: 'little.dogs' })).toThrow(/Only kids/)
    expect(() => repo.queueClaim({ userId: 'alea', actId: 'nope' })).toThrow(/Unknown act/)
  })

  it('lists pending claims newest first', () => {
    const repo = createMemoryRepository()
    repo.queueClaim({ userId: 'kameron', actId: 'little.dogs', createdAt: '2026-09-22T10:00:00.000Z' })
    repo.queueClaim({ userId: 'alea', actId: 'little.hamper', createdAt: '2026-09-22T12:00:00.000Z' })
    expect(repo.listPendingClaims().map((c) => c.userId)).toEqual(['alea', 'kameron'])
  })
})

describe('approveClaim', () => {
  it('writes a ledger row, moves meters 50/30/20, and marks the claim approved', () => {
    const repo = createMemoryRepository()
    const claim = repo.queueClaim({ userId: 'christopher', actId: 'teen.laundry' }) // 5 pts
    const entry = repo.approveClaim(claim.id)

    expect(entry).toMatchObject({
      userId: 'christopher',
      actId: 'teen.laundry',
      points: 5,
      path: 'A',
      source: 'inbox',
      claimId: claim.id,
    })
    expect(repo.adminListLedger()).toHaveLength(1)
    expect(meterValues(repo)).toEqual({ T1: 25, T2: 15, T3: 10 })
    expect(repo.getClaim(claim.id)).toMatchObject({ status: 'approved' })
    expect(repo.getClaim(claim.id)?.resolvedAt).toBeTruthy()
    expect(repo.listPendingClaims()).toEqual([])
  })

  it('uses edited points instead of the catalog value', () => {
    const repo = createMemoryRepository()
    // Pretend the catalog said 10 and the parent trimmed it to 7.
    const claim = repo.queueClaim({ userId: 'kameron', actId: 'little.homework-calm' }) // 4 pts
    const entry = repo.approveClaim(claim.id, { points: 7, note: 'Great effort' })

    expect(entry.points).toBe(7)
    expect(entry.note).toBe('Great effort')
    expect(meterValues(repo)).toEqual({ T1: 35, T2: 21, T3: 14 })
    expect(repo.getClaim(claim.id)).toMatchObject({
      status: 'approved',
      requestedPoints: 4,
      editedPoints: 7,
      parentNote: 'Great effort',
    })
  })

  it('rejects non-integer edits and double approval', () => {
    const repo = createMemoryRepository()
    const claim = repo.queueClaim({ userId: 'alea', actId: 'little.read-20' })
    expect(() => repo.approveClaim(claim.id, { points: 2.5 })).toThrow(/whole number/)
    repo.approveClaim(claim.id)
    expect(() => repo.approveClaim(claim.id)).toThrow(/already approved/)
    expect(repo.adminListLedger()).toHaveLength(1)
  })
})

describe('denyClaim', () => {
  it('marks denied with no ledger write and no meter movement', () => {
    const repo = createMemoryRepository()
    const claim = repo.queueClaim({ userId: 'kameron', actId: 'little.make-bed' })
    const denied = repo.denyClaim(claim.id, 'Bed was not made')

    expect(denied).toMatchObject({ status: 'denied', parentNote: 'Bed was not made' })
    expect(repo.adminListLedger()).toEqual([])
    expect(meterValues(repo)).toEqual({ T1: 0, T2: 0, T3: 0 })
    expect(repo.listPendingClaims()).toEqual([])
    expect(() => repo.approveClaim(claim.id)).toThrow(/already denied/)
  })
})

describe('approveAllPendingOn', () => {
  it("approves only today's pending claims, oldest first", () => {
    const repo = createMemoryRepository()
    const today = denverDateKey()
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()

    const old = repo.queueClaim({ userId: 'kameron', actId: 'little.dogs', createdAt: yesterday }) // 3
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString()
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString()
    const a = repo.queueClaim({ userId: 'alea', actId: 'little.hamper', createdAt: twoMinAgo }) // 1
    const b = repo.queueClaim({ userId: 'christopher', actId: 'teen.trash-recycle', createdAt: oneMinAgo }) // 2

    const entries = repo.approveAllPendingOn(today)
    expect(entries.map((e) => e.claimId)).toEqual([a.id, b.id])
    expect(repo.getClaim(old.id)?.status).toBe('pending')
    expect(meterValues(repo)).toEqual({ T1: 15, T2: 9, T3: 6 })
  })
})

describe('adminSeedDemoClaims', () => {
  it('queues at least two Path A claims for different kids', () => {
    const repo = createMemoryRepository()
    const created = repo.adminSeedDemoClaims()
    expect(created.length).toBeGreaterThanOrEqual(2)
    expect(new Set(created.map((c) => c.userId)).size).toBeGreaterThanOrEqual(2)
    for (const c of created) {
      expect(repo.getAct(c.actId)?.path).toBe('A')
    }
    expect(repo.adminListLedger()).toEqual([])
  })
})

describe('reset', () => {
  it('clears ledger, meters, and claims together', () => {
    const repo = createMemoryRepository()
    repo.approveClaim(repo.queueClaim({ userId: 'kameron', actId: 'little.dogs' }).id)
    repo.adminResetMetersAndLedger()
    expect(repo.adminListLedger()).toEqual([])
    expect(repo.listPendingClaims()).toEqual([])
    expect(meterValues(repo)).toEqual({ T1: 0, T2: 0, T3: 0 })
  })
})
