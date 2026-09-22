import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from './memoryRepository'
import { MemoryAdapter } from './memoryRepository'
import { Repository, RewardError } from './repository'
import { buildSeedDatabase, migrateDatabase, SCHEMA_VERSION } from './seed'
import type { Database } from './types'

describe('reward seed and migration', () => {
  it('seeds at least one active reward per tier', () => {
    const repo = createMemoryRepository()
    const rewards = repo.adminListRewards()
    const tiers = rewards.filter((r) => r.active).map((r) => r.tier)
    expect(tiers).toContain('T1')
    expect(tiers).toContain('T2')
    expect(tiers).toContain('T3')
    expect(rewards.length).toBeGreaterThanOrEqual(3)
    expect(rewards.length).toBeLessThanOrEqual(6)
    expect(repo.listWins()).toEqual([])
  })

  it('migrates a v2 snapshot in place instead of reseeding, preserving ledger and claims', () => {
    const v3 = buildSeedDatabase()
    const { rewards: _rewards, wins: _wins, ...rest } = v3
    const v2 = {
      ...rest,
      ledger: [
        {
          id: 'l1',
          userId: 'kameron',
          actId: 'little.dogs',
          points: 3,
          path: 'A',
          source: 'inbox',
          note: '',
          createdAt: '2026-09-20T00:00:00.000Z',
        },
      ],
      settings: { ...v3.settings, schemaVersion: 2 },
    } as unknown as Database

    const migrated = migrateDatabase(v2)
    expect(migrated?.settings.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated?.rewards.length).toBeGreaterThan(0)
    expect(migrated?.wins).toEqual([])
    expect(migrated?.ledger).toHaveLength(1)

    const adapter = new MemoryAdapter()
    adapter.save(v2)
    const repo = new Repository(adapter)
    expect(repo.adminListLedger()).toHaveLength(1)
    expect(repo.adminListRewards().length).toBeGreaterThan(0)
  })

  it('reseeds snapshots older than v2', () => {
    const v1 = { ...buildSeedDatabase(), settings: { ...buildSeedDatabase().settings, schemaVersion: 1 } }
    expect(migrateDatabase(v1)).toBeNull()
  })
})

describe('admin rewards builder', () => {
  it('adds, edits, and deactivates a Week reward', () => {
    const repo = createMemoryRepository()
    const created = repo.adminCreateReward({ tier: 'T1', title: '  Pancake breakfast ', blurb: 'Saturday morning.' })
    expect(created).toMatchObject({ tier: 'T1', title: 'Pancake breakfast', active: true })
    expect(repo.listRewardsForKids().some((r) => r.id === created.id)).toBe(true)

    const edited = repo.adminUpdateReward(created.id, { blurb: 'Saturday morning, chocolate chips.' })
    expect(edited.blurb).toBe('Saturday morning, chocolate chips.')

    repo.adminUpdateReward(created.id, { active: false })
    expect(repo.listRewardsForKids().some((r) => r.id === created.id)).toBe(false)
    expect(repo.adminListRewards().find((r) => r.id === created.id)?.active).toBe(false)
  })

  it('rejects empty titles and unknown ids', () => {
    const repo = createMemoryRepository()
    expect(() => repo.adminCreateReward({ tier: 'T2', title: '   ', blurb: '' })).toThrow(RewardError)
    expect(() => repo.adminUpdateReward('nope', { title: 'x' })).toThrow(/not found/)
    const [first] = repo.adminListRewards()
    expect(() => repo.adminUpdateReward(first!.id, { title: '' })).toThrow(/needs a title/)
  })
})

describe('announce', () => {
  it('records a Win and surfaces a one-time banner per kid', () => {
    const repo = createMemoryRepository()
    const reward = repo.adminListRewards().find((r) => r.tier === 'T1')!
    repo.adminAnnounceReward(reward.id)

    expect(repo.listWins()).toHaveLength(1)
    expect(repo.listWins()[0]).toMatchObject({ kind: 'announce', tier: 'T1', title: reward.title })
    expect(repo.listRewardsForKids().find((r) => r.id === reward.id)?.announced).toBe(true)

    expect(repo.listUnseenAnnouncements('kameron').map((r) => r.id)).toEqual([reward.id])
    expect(repo.listUnseenAnnouncements('alea').map((r) => r.id)).toEqual([reward.id])

    repo.markAnnouncementsSeen('kameron', [reward.id])
    expect(repo.listUnseenAnnouncements('kameron')).toEqual([])
    expect(repo.listUnseenAnnouncements('alea')).toHaveLength(1)

    // Announcing again does nothing.
    repo.adminAnnounceReward(reward.id)
    expect(repo.listWins()).toHaveLength(1)
    expect(repo.listUnseenAnnouncements('kameron')).toEqual([])
  })

  it('hides announcements for deactivated rewards', () => {
    const repo = createMemoryRepository()
    const reward = repo.adminListRewards().find((r) => r.tier === 'T2')!
    repo.adminAnnounceReward(reward.id)
    repo.adminUpdateReward(reward.id, { active: false })
    expect(repo.listUnseenAnnouncements('christopher')).toEqual([])
  })
})

describe('unlock detection', () => {
  const simulate = (repo: ReturnType<typeof createMemoryRepository>, points: number) =>
    repo.recordApprovedPoints({ userId: 'admin', actId: null, points, path: 'B', source: 'simulate' })

  it('records one unlock Win per tier the moment its meter fills, naming the active reward', () => {
    const repo = createMemoryRepository()
    simulate(repo, 230) // T1 at 115 of 120: not yet
    expect(repo.listWins()).toEqual([])

    simulate(repo, 10) // T1 hits 120
    const wins = repo.listWins()
    expect(wins).toHaveLength(1)
    expect(wins[0]).toMatchObject({ kind: 'unlock', tier: 'T1', title: 'Friday movie night' })

    simulate(repo, 10) // overflow: no second T1 unlock
    expect(repo.listWins()).toHaveLength(1)
  })

  it('unlocks T2 and T3 as their fills are reached, including through an inbox approval', () => {
    const repo = createMemoryRepository()
    simulate(repo, 559) // T2 at 167.7 -> not yet... T1 full (unlock 1)
    expect(repo.listWins().map((w) => w.tier)).toEqual(['T1'])

    // T2 fills at 280 pts = 933.3 total; T3 at 560 pts = 2800 total.
    simulate(repo, 375) // total 934 -> T2 280.2 full
    expect(repo.listWins().map((w) => w.tier).sort()).toEqual(['T1', 'T2'])

    simulate(repo, 1865) // total 2799 -> T3 559.8, not yet
    expect(repo.listWins()).toHaveLength(2)

    const claim = repo.queueClaim({ userId: 'kameron', actId: 'little.dogs' }) // +3 -> T3 560.4
    repo.approveClaim(claim.id)
    const wins = repo.listWins()
    expect(wins).toHaveLength(3)
    expect(wins[0]).toMatchObject({ kind: 'unlock', tier: 'T3', title: 'Big day out' })
  })

  it('falls back to a generic title when the tier has no active reward', () => {
    const repo = createMemoryRepository()
    for (const r of repo.adminListRewards().filter((r) => r.tier === 'T1')) {
      repo.adminUpdateReward(r.id, { active: false })
    }
    simulate(repo, 240)
    expect(repo.listWins()[0]).toMatchObject({ tier: 'T1', title: 'Week vault filled', rewardId: null })
  })

  it('reset clears wins but keeps rewards', () => {
    const repo = createMemoryRepository()
    simulate(repo, 240)
    const rewardCount = repo.adminListRewards().length
    repo.adminResetMetersAndLedger()
    expect(repo.listWins()).toEqual([])
    expect(repo.adminListRewards()).toHaveLength(rewardCount)
  })
})

describe('kid safety: rewards and wins carry no scores', () => {
  it('kid-facing reward and win payloads have no points, costs, or per-kid fields', () => {
    const repo = createMemoryRepository()
    repo.adminAnnounceReward(repo.adminListRewards()[0]!.id)
    repo.recordApprovedPoints({ userId: 'alea', actId: null, points: 240, path: 'B', source: 'simulate' })
    const json = JSON.stringify([
      ...repo.listRewardsForKids(),
      ...repo.listUnseenAnnouncements('alea'),
      ...repo.listWins(),
    ])
    expect(json).not.toMatch(/"points"|cost|price|seenBy|userId/)
  })
})
