import { describe, expect, it } from 'vitest'
import { MemoryAdapter, createMemoryRepository } from './memoryRepository'
import { ClaimError, Repository } from './repository'
import { buildSeedDatabase, migrateDatabase, SCHEMA_VERSION } from './seed'
import { denverInstant } from '@/lib/time/calendar'

const iso = (d: Date) => d.toISOString()

describe('clock override and FORCE_LIVE', () => {
  it('now() follows the override and clears back to the real clock', () => {
    const repo = createMemoryRepository()
    const frozen = denverInstant(2026, 10, 4, 10) // Sunday
    repo.adminSetClockOverride(iso(frozen))
    expect(repo.isClockOverridden()).toBe(true)
    expect(repo.now().getTime()).toBe(frozen.getTime())
    repo.adminSetClockOverride(null)
    expect(repo.isClockOverridden()).toBe(false)
    expect(Math.abs(repo.now().getTime() - Date.now())).toBeLessThan(5_000)
    expect(() => repo.adminSetClockOverride('garbage')).toThrow(RangeError)
  })

  it('forceLive comes from settings or the env option', () => {
    expect(createMemoryRepository().isForceLive()).toBe(false)
    expect(createMemoryRepository({ envForceLive: true }).isForceLive()).toBe(true)
    const repo = createMemoryRepository()
    repo.adminSetForceLive(true)
    expect(repo.isForceLive()).toBe(true)
    expect(repo.getSettings().forceLive).toBe(true)
  })

  it('migrates a v3 snapshot by adding the new settings', () => {
    const seeded = buildSeedDatabase()
    const { forceLive: _f, clockOverride: _c, ...oldSettings } = seeded.settings
    const v3 = { ...seeded, settings: { ...oldSettings, schemaVersion: 3 } } as unknown as typeof seeded
    const migrated = migrateDatabase(v3)
    expect(migrated?.settings).toMatchObject({ schemaVersion: SCHEMA_VERSION, forceLive: false, clockOverride: null })
    const adapter = new MemoryAdapter()
    adapter.save(v3)
    expect(new Repository(adapter).getSettings().schemaVersion).toBe(SCHEMA_VERSION)
  })
})

describe('claimForKid respects the household calendar', () => {
  it('before go-live: blocked with the Sep 28 message, allowed with FORCE_LIVE', () => {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 9, 22, 15))) // Tue 3 PM, pre go-live
    expect(repo.getEarnWindow()).toMatchObject({ open: false, reason: 'before-go-live' })
    expect(() => repo.claimForKid({ userId: 'kameron', actId: 'little.dogs' })).toThrow(ClaimError)
    expect(() => repo.claimForKid({ userId: 'kameron', actId: 'little.dogs' })).toThrow(/Sep 28/)
    expect(repo.listPendingClaims()).toEqual([])

    repo.adminSetForceLive(true)
    expect(repo.getEarnWindow().open).toBe(true)
    const claim = repo.claimForKid({ userId: 'kameron', actId: 'little.dogs' })
    expect(claim.createdAt).toBe(iso(denverInstant(2026, 9, 22, 15)))
  })

  it('Sunday: blocked even with FORCE_LIVE', () => {
    const repo = createMemoryRepository({ envForceLive: true })
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 4, 10)))
    expect(repo.getEarnWindow().reason).toBe('sunday')
    expect(() => repo.claimForKid({ userId: 'alea', actId: 'little.hamper' })).toThrow(/Reward day/)
  })

  it('Monday 8:01 PM Denver: blocked; Tuesday 3 PM: allowed', () => {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 9, 28, 20, 1)))
    expect(repo.getEarnWindow().reason).toBe('after-cutoff')
    expect(() => repo.claimForKid({ userId: 'christopher', actId: 'teen.laundry' })).toThrow(/8:00 PM/)

    repo.adminSetClockOverride(iso(denverInstant(2026, 9, 29, 15)))
    expect(repo.getEarnWindow().open).toBe(true)
    expect(() => repo.claimForKid({ userId: 'christopher', actId: 'teen.laundry' })).not.toThrow()
  })

  it('admin queueClaim bypasses the gate for testing, and approve-all-today uses the overridden clock', () => {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 4, 10))) // Sunday
    const claim = repo.queueClaim({ userId: 'kameron', actId: 'little.dogs', createdAt: iso(denverInstant(2026, 10, 4, 9)) })
    expect(repo.listPendingClaims()).toHaveLength(1)
    const approved = repo.approveAllPendingOn()
    expect(approved.map((e) => e.claimId)).toEqual([claim.id])
  })

  it('full smoke while the window is open: claim -> inbox -> approve -> meters -> reward unlock', () => {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 6, 15))) // Tue Oct 6, 3 PM
    expect(repo.getEarnWindow().open).toBe(true)

    // 237 pts -> T1 at 118.5; the kid's +3 (T1 share +1.5) lands exactly on 120.
    repo.recordApprovedPoints({ userId: 'admin', actId: null, points: 237, path: 'B', source: 'simulate' })
    const claim = repo.claimForKid({ userId: 'alea', actId: 'little.dogs' })
    expect(repo.listPendingClaims().map((c) => c.id)).toEqual([claim.id])
    repo.approveClaim(claim.id)

    const t1 = repo.getMeters().find((m) => m.tier === 'T1')!
    expect(t1.valueTenths).toBe(1200)
    expect(repo.listWins()[0]).toMatchObject({ kind: 'unlock', tier: 'T1', title: 'Friday movie night' })
    expect(repo.listKidPendingClaims('alea')).toEqual([])
  })
})
