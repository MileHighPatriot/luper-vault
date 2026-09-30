import { describe, expect, it } from 'vitest'
import { denverInstant } from '@/lib/time/calendar'
import { MemoryAdapter, createMemoryRepository } from './memoryRepository'
import { CustomPointsError, Repository } from './repository'
import { buildSeedDatabase, migrateDatabase, SCHEMA_VERSION } from './seed'
import type { Database, LedgerEntry } from './types'

describe('catalog refresh (v6 → v7)', () => {
  function v6Snapshot(): Database {
    const db = buildSeedDatabase()
    // A v6 catalog still had these acts.
    const old = [
      { id: 'little.help-food', title: 'Help with food', band: 'little', points: 3, path: 'A', pathBStamp: false },
      { id: 'little.room-keep', title: 'Keep room clean', band: 'little', points: 2, path: 'A', pathBStamp: false },
      { id: 'teen.small-fix', title: 'Small fix', band: 'teen', points: 3, path: 'A', pathBStamp: false },
    ] as Database['earnActs']
    const { pointNotices: _drop, ...rest } = db
    void _drop
    return {
      ...(rest as Database),
      earnActs: [...db.earnActs.filter((a) => a.id !== 'little.dogs'), ...old],
      pendingClaims: [
        { id: 'c1', userId: 'kameron', actId: 'little.help-food', requestedPoints: 3, status: 'pending', createdAt: new Date().toISOString() },
      ],
      settings: { ...db.settings, schemaVersion: 6 },
    }
  }

  it('swaps in the new catalog and keeps removed acts as retired', () => {
    const migrated = migrateDatabase(v6Snapshot())!
    expect(migrated.settings.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.pointNotices).toEqual([])
    const act = (id: string) => migrated.earnActs.find((a) => a.id === id)
    expect(act('little.help-food')).toMatchObject({ retired: true, title: 'Help with food' })
    expect(act('teen.small-fix')?.retired).toBe(true)
    expect(act('little.dogs')).toMatchObject({ title: 'Feed the dogs', points: 2 })
    expect(act('little.vacuum-living')?.retired).toBeUndefined()
    expect(act('teen.bathroom')?.points).toBe(7)
  })

  it('hides retired acts from kids and claims, but the inbox can still resolve old claims', () => {
    const adapter = new MemoryAdapter()
    adapter.save(v6Snapshot())
    const repo = new Repository(adapter)
    const kidIds = repo.listEarnActsForKid('kameron').map((a) => a.id)
    expect(kidIds).not.toContain('little.help-food')
    expect(kidIds).not.toContain('little.room-keep')
    expect(kidIds).toContain('little.trash')
    expect(repo.listActsByBand('little').some((a) => a.retired)).toBe(false)
    expect(() => repo.queueClaim({ userId: 'alea', actId: 'little.help-food' })).toThrow(/no longer on the list/)

    const entry = repo.approveClaim('c1')
    expect(entry.points).toBe(3)
    expect(repo.adminListAuditEvents()[0]?.title).toBe('Help with food')
  })
})

describe('custom points', () => {
  it('adds points to the ledger and meters and queues a reason-only notice for the kid', () => {
    const repo = createMemoryRepository()
    const entry = repo.adminAddCustomPoints({ earnerId: 'alea', points: 6, reason: '  Helped a neighbor  ' })
    expect(entry).toMatchObject({ userId: 'alea', actId: null, points: 6, path: 'B', source: 'custom', note: 'Helped a neighbor' })
    expect(repo.getMeters().find((m) => m.tier === 'T1')?.valueTenths).toBe(30)

    const notices = repo.listUnseenPointNotices('alea')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({ reason: 'Helped a neighbor', direction: 'up' })
    expect(JSON.stringify(notices)).not.toMatch(/"points"|\b6\b/)
    expect(repo.listUnseenPointNotices('kameron')).toEqual([])

    expect(repo.adminListAuditEvents()[0]).toMatchObject({ title: 'Helped a neighbor', points: 6, source: 'Custom', note: '' })
  })

  it('takes points away with a "down" notice', () => {
    const repo = createMemoryRepository()
    repo.adminAddCustomPoints({ earnerId: 'christopher', points: 10, reason: 'Big help' })
    repo.adminAddCustomPoints({ earnerId: 'christopher', points: -4, reason: 'Left the gate open' })
    expect(repo.getMeters().find((m) => m.tier === 'T1')?.valueTenths).toBe(30)
    expect(repo.listUnseenPointNotices('christopher').map((n) => n.direction)).toEqual(['up', 'down'])
  })

  it('does not queue a notice for parents', () => {
    const repo = createMemoryRepository()
    repo.adminAddCustomPoints({ earnerId: 'admin', points: 3, reason: 'Date night' })
    expect(repo.exportSnapshot().pointNotices).toEqual([])
  })

  it('rejects zero, fractions, huge amounts, and blank reasons', () => {
    const repo = createMemoryRepository()
    const add = (points: number, reason = 'x') => () => repo.adminAddCustomPoints({ earnerId: 'alea', points, reason })
    expect(add(0)).toThrow(CustomPointsError)
    expect(add(1.5)).toThrow(/whole number/)
    expect(add(101)).toThrow(/between/)
    expect(add(-101)).toThrow(/between/)
    expect(add(5, '   ')).toThrow(/what the points are for/)
    expect(repo.adminListLedger()).toEqual([])
  })

  it('marks only that kid\'s notices seen', () => {
    const repo = createMemoryRepository()
    repo.adminAddCustomPoints({ earnerId: 'alea', points: 2, reason: 'A' })
    repo.adminAddCustomPoints({ earnerId: 'kameron', points: 2, reason: 'K' })
    const aleaIds = repo.listUnseenPointNotices('alea').map((n) => n.id)
    const kamIds = repo.listUnseenPointNotices('kameron').map((n) => n.id)
    repo.markPointNoticesSeen('alea', [...aleaIds, ...kamIds])
    expect(repo.listUnseenPointNotices('alea')).toEqual([])
    expect(repo.listUnseenPointNotices('kameron')).toHaveLength(1)
  })
})

describe('adminPeriodPoints', () => {
  it('sums net points per person for the current week, month, and quarter', () => {
    const at = (d: Date) => d.toISOString()
    const row = (userId: string, points: number, when: Date): LedgerEntry => ({
      id: `${userId}-${at(when)}`,
      userId,
      actId: null,
      points,
      path: 'B',
      source: 'custom',
      note: '',
      createdAt: at(when),
    })
    const db = buildSeedDatabase()
    db.ledger = [
      row('kameron', 5, denverInstant(2026, 10, 6, 9)), // Tue this week
      row('kameron', -2, denverInstant(2026, 10, 11, 18)), // Sun, same earn week
      row('kameron', 4, denverInstant(2026, 10, 2, 9)), // last week, this month
      row('kameron', 7, denverInstant(2026, 9, 30, 9)), // last month, last quarter
      row('admin', 3, denverInstant(2026, 10, 7, 9)),
      row('christopher', 9, denverInstant(2026, 11, 20, 9)), // later quarter-mate, not this month
    ]
    const adapter = new MemoryAdapter()
    adapter.save(db)
    const repo = new Repository(adapter)

    const totals = repo.adminPeriodPoints(denverInstant(2026, 10, 8, 12))
    expect(totals.map((t) => t.label)).toEqual(['Kameron', 'Alea', 'Christopher', 'Parents'])
    const by = Object.fromEntries(totals.map((t) => [t.userId, [t.week, t.month, t.quarter]]))
    expect(by.kameron).toEqual([3, 7, 7])
    expect(by.alea).toEqual([0, 0, 0])
    expect(by.christopher).toEqual([0, 0, 9])
    expect(by.admin).toEqual([3, 3, 3])
  })
})
