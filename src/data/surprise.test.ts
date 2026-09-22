import { describe, expect, it } from 'vitest'
import { denverInstant } from '@/lib/time/calendar'
import { calendarMonthKey, earnWeekKey } from '@/lib/time/surpriseWeek'
import { MemoryAdapter, createMemoryRepository } from './memoryRepository'
import { Repository, SURPRISE_MONTH_CAP, SURPRISE_WEEK_CAP, SurpriseError } from './repository'
import { buildSeedDatabase, migrateDatabase, SCHEMA_VERSION } from './seed'
import type { Database } from './types'

const iso = (d: Date) => d.toISOString()

function send(repo: Repository, title: string, kidId = 'kameron') {
  return repo.adminSendSurprise({ kidId, title, createdBy: 'admin', emoji: '🍬', note: 'For crushing it' })
}

describe('earn week keys', () => {
  it('puts Sunday on the Monday that opened the earn week, including across DST', () => {
    expect(earnWeekKey(denverInstant(2026, 9, 28, 9))).toBe('2026-09-28') // Monday go-live
    expect(earnWeekKey(denverInstant(2026, 10, 3, 20, 30))).toBe('2026-09-28') // Saturday
    expect(earnWeekKey(denverInstant(2026, 10, 4, 10))).toBe('2026-09-28') // Sunday reward day
    expect(earnWeekKey(denverInstant(2026, 10, 5, 9))).toBe('2026-10-05') // next Monday
    expect(earnWeekKey(denverInstant(2026, 11, 1, 10))).toBe('2026-10-26') // Sunday, DST fallback
    expect(calendarMonthKey(denverInstant(2026, 10, 4, 10))).toBe('2026-10')
  })
})

describe('surprise drops', () => {
  it('sends a surprise to Kameron without moving meters, the ledger, or the rewards board', () => {
    const repo = createMemoryRepository()
    const meters = repo.getMeters()
    const rewards = repo.listRewardsForKids()
    const drop = send(repo, 'Starbucks')

    expect(drop).toMatchObject({
      kidId: 'kameron',
      title: 'Starbucks',
      emoji: '🍬',
      note: 'For crushing it',
      createdBy: 'admin',
      status: 'pending',
    })
    expect(drop.seenAt).toBeUndefined()
    expect(repo.getMeters()).toEqual(meters)
    expect(repo.adminListLedger()).toEqual([])
    expect(repo.listWins()).toEqual([])
    expect(repo.listRewardsForKids()).toEqual(rewards)
    expect(repo.listRewardsForKids().map((r) => r.title)).not.toContain('Starbucks')
    expect(repo.listPendingSurprisesForKid('kameron')).toEqual([
      { id: drop.id, title: 'Starbucks', emoji: '🍬', note: 'For crushing it', createdAt: drop.createdAt },
    ])
    expect(JSON.stringify(repo.listPendingSurprisesForKid('kameron'))).not.toMatch(/userId|kidId|points|seenBy/)
    expect(repo.listPendingSurprisesForKid('alea')).toEqual([])
  })

  it('blocks a second surprise for Kameron in the same earn week, then allows the next Monday', () => {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 6, 15))) // Tuesday
    send(repo, 'Candy')
    expect(repo.adminSurpriseAllowance('kameron')).toMatchObject({
      weekUsed: 1,
      weekCap: SURPRISE_WEEK_CAP,
      canSend: false,
    })
    expect(() => send(repo, 'Second candy')).toThrow(SurpriseError)
    expect(() => send(repo, 'Second candy')).toThrow(/earn week/)
    expect(repo.adminListSurprises()).toHaveLength(1)

    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 12, 9))) // next Monday
    expect(send(repo, 'Next week').status).toBe('pending')
  })

  it('counts Sunday on the earn week that just finished, and still allows a Sunday send when the week is open', () => {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 3, 15))) // Saturday
    send(repo, 'Saturday treat')
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 4, 10))) // Sunday
    expect(() => send(repo, 'Sunday treat')).toThrow(/earn week/)

    const fresh = createMemoryRepository()
    fresh.adminSetClockOverride(iso(denverInstant(2026, 10, 4, 10)))
    expect(send(fresh, 'Sunday only').status).toBe('pending')
    expect(fresh.getEarnWindow().open).toBe(false)
  })

  it('caps a kid at three surprises in a calendar month', () => {
    const repo = createMemoryRepository()
    const mondays = [
      denverInstant(2026, 10, 5, 10),
      denverInstant(2026, 10, 12, 10),
      denverInstant(2026, 10, 19, 10),
      denverInstant(2026, 10, 26, 10),
    ]
    for (const day of mondays.slice(0, SURPRISE_MONTH_CAP)) {
      repo.adminSetClockOverride(iso(day))
      send(repo, `Week of ${iso(day)}`)
    }
    repo.adminSetClockOverride(iso(mondays[3]!))
    expect(repo.adminSurpriseAllowance('kameron').monthUsed).toBe(SURPRISE_MONTH_CAP)
    expect(() => send(repo, 'Fourth')).toThrow(/calendar month/)
    expect(repo.adminListSurprises().filter((d) => d.status !== 'canceled')).toHaveLength(3)
    // Alea is a different kid and still has room in the same month.
    expect(send(repo, 'Alea treat', 'alea').kidId).toBe('alea')
  })

  it('frees the week slot when a pending surprise is canceled, and refuses to cancel a seen one', () => {
    const repo = createMemoryRepository()
    const drop = send(repo, 'Candy bar')
    expect(repo.adminCancelSurprise(drop.id).status).toBe('canceled')
    expect(repo.listPendingSurprisesForKid('kameron')).toEqual([])
    const again = send(repo, 'Replacement')
    expect(again.status).toBe('pending')

    repo.markSurprisesSeen('kameron', [again.id])
    expect(() => repo.adminCancelSurprise(again.id)).toThrow(/already saw/)
    expect(repo.adminListSurprises().find((d) => d.id === again.id)?.status).toBe('seen')
  })

  it('shows the flare once, then a Wins patch, and ignores another kid dismissing it', () => {
    const repo = createMemoryRepository()
    const drop = send(repo, 'Store money')
    expect(repo.listSeenSurprisesForKid('kameron')).toEqual([])

    repo.markSurprisesSeen('alea', [drop.id])
    expect(repo.listPendingSurprisesForKid('kameron')).toHaveLength(1)

    repo.markSurprisesSeen('kameron', [drop.id])
    expect(repo.listPendingSurprisesForKid('kameron')).toEqual([])
    const seen = repo.listSeenSurprisesForKid('kameron')
    expect(seen.map((s) => s.title)).toEqual(['Store money'])
    expect(repo.listSeenSurprisesForKid('alea')).toEqual([])
    expect(repo.adminListSurprises()[0]).toMatchObject({ status: 'seen' })
    expect(repo.adminListSurprises()[0]?.seenAt).toEqual(expect.any(String))
    expect(repo.getMeters()).toEqual(createMemoryRepository().getMeters())
    expect(repo.listWins()).toEqual([])
  })

  it('rejects an empty title and a surprise aimed at the admin', () => {
    const repo = createMemoryRepository()
    expect(() => repo.adminSendSurprise({ kidId: 'kameron', title: '   ', createdBy: 'admin' })).toThrow(/title/)
    expect(() => repo.adminSendSurprise({ kidId: 'admin', title: 'Nope', createdBy: 'admin' })).toThrow(SurpriseError)
    expect(() => repo.adminCancelSurprise('missing')).toThrow(/not on the list/)
  })

  it('migrates a v4 snapshot by adding an empty surprise list and keeping the ledger', () => {
    const seeded = buildSeedDatabase()
    const { surpriseDrops: _drops, ...rest } = seeded
    const v4 = { ...rest, settings: { ...seeded.settings, schemaVersion: 4 } } as unknown as Database
    const migrated = migrateDatabase(v4)
    expect(migrated?.settings.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated?.surpriseDrops).toEqual([])
    expect(migrated?.ledger).toEqual([])

    const adapter = new MemoryAdapter()
    adapter.save(v4)
    const repo = new Repository(adapter)
    expect(repo.getSettings().schemaVersion).toBe(SCHEMA_VERSION)
    expect(repo.adminListSurprises()).toEqual([])
    expect(send(repo, 'After migrate').title).toBe('After migrate')
  })
})
