import { describe, expect, it } from 'vitest'
import { FALLBACK_ADMIN_PIN, hashPin, isValidPinFormat } from '@/lib/pin'
import { denverInstant } from '@/lib/time/calendar'
import { denverDateKey } from '@/lib/time/denver'
import { MemoryAdapter, createMemoryRepository } from './memoryRepository'
import { PinError, Repository, SettingsError } from './repository'
import { DEFAULT_FAMILY_NAME, buildSeedDatabase, migrateDatabase, SCHEMA_VERSION } from './seed'
import type { Database } from './types'

const iso = (d: Date) => d.toISOString()

describe('admin PIN', () => {
  it('defaults to 2580 and only accepts that PIN', () => {
    const repo = createMemoryRepository()
    expect(FALLBACK_ADMIN_PIN).toBe('2580')
    expect(repo.verifyAdminPin('2580')).toBe(true)
    expect(repo.verifyAdminPin(' 2580 ')).toBe(true)
    expect(repo.verifyAdminPin('1234')).toBe(false)
    expect(repo.verifyAdminPin('')).toBe(false)
    expect(repo.getSettings().adminPinHash).not.toContain('2580')
  })

  it('seeds from the build-time default when one is given', () => {
    const repo = createMemoryRepository({ defaultAdminPin: '4321' })
    expect(repo.verifyAdminPin('4321')).toBe(true)
    expect(repo.verifyAdminPin('2580')).toBe(false)
  })

  it('changes with the current PIN and a matching confirmation', () => {
    const repo = createMemoryRepository()
    expect(() => repo.adminChangePin({ currentPin: '0000', newPin: '9753', confirmPin: '9753' })).toThrow(PinError)
    expect(() => repo.adminChangePin({ currentPin: '0000', newPin: '9753', confirmPin: '9753' })).toThrow(/Current PIN/)
    expect(() => repo.adminChangePin({ currentPin: '2580', newPin: '12', confirmPin: '12' })).toThrow(/4–8 digits/)
    expect(() => repo.adminChangePin({ currentPin: '2580', newPin: 'abcd', confirmPin: 'abcd' })).toThrow(/digits/)
    expect(() => repo.adminChangePin({ currentPin: '2580', newPin: '9753', confirmPin: '9754' })).toThrow(/do not match/)
    expect(repo.verifyAdminPin('2580')).toBe(true)

    repo.adminChangePin({ currentPin: '2580', newPin: '9753', confirmPin: '9753' })
    expect(repo.verifyAdminPin('9753')).toBe(true)
    expect(repo.verifyAdminPin('2580')).toBe(false)
  })

  it('survives a reload because the digest is stored, and updateSettings cannot overwrite it', () => {
    const adapter = new MemoryAdapter()
    const repo = new Repository(adapter)
    repo.adminChangePin({ currentPin: '2580', newPin: '11223344', confirmPin: '11223344' })
    const reloaded = new Repository(adapter, { defaultAdminPin: '0000' })
    expect(reloaded.verifyAdminPin('11223344')).toBe(true)
    expect(reloaded.verifyAdminPin('0000')).toBe(false)
  })

  it('pin helpers', () => {
    expect(isValidPinFormat('2580')).toBe(true)
    expect(isValidPinFormat('12345678')).toBe(true)
    expect(isValidPinFormat('123')).toBe(false)
    expect(isValidPinFormat('123456789')).toBe(false)
    expect(isValidPinFormat('12a4')).toBe(false)
    expect(hashPin('2580')).toBe(hashPin(' 2580'))
    expect(hashPin('2580')).not.toBe(hashPin('2581'))
  })
})

describe('family settings', () => {
  it('edits the verse and family name, trims, and rejects blanks', () => {
    const repo = createMemoryRepository()
    expect(repo.getFamilySettings()).toMatchObject({ familyName: DEFAULT_FAMILY_NAME, muteKidSounds: false })

    const saved = repo.adminUpdateFamilySettings({
      familyName: '  Team Luper ',
      verse: ' Be strong and courageous. — Joshua 1:9 ',
    })
    expect(saved).toEqual({
      familyName: 'Team Luper',
      verse: 'Be strong and courageous. — Joshua 1:9',
      muteKidSounds: false,
    })
    expect(repo.getFamilySettings().verse).toBe('Be strong and courageous. — Joshua 1:9')

    expect(() => repo.adminUpdateFamilySettings({ familyName: '  ' })).toThrow(SettingsError)
    expect(() => repo.adminUpdateFamilySettings({ verse: '' })).toThrow(/verse/)
    expect(repo.getFamilySettings().familyName).toBe('Team Luper')

    repo.adminUpdateFamilySettings({ muteKidSounds: true })
    expect(repo.getFamilySettings().muteKidSounds).toBe(true)
  })

  it('kid-facing settings carry no PIN digest or dev switches', () => {
    const json = JSON.stringify(createMemoryRepository().getFamilySettings())
    expect(json).not.toMatch(/adminPinHash|clockOverride|forceLive|schemaVersion/)
  })

  it('migrates a v5 snapshot: adds the PIN digest, family name, and mute flag; keeps surprises and ledger', () => {
    const seeded = buildSeedDatabase()
    const { adminPinHash: _h, familyName: _f, muteKidSounds: _m, ...oldSettings } = seeded.settings
    const v5 = {
      ...seeded,
      ledger: [
        {
          id: 'l1',
          userId: 'kameron',
          actId: 'little.dogs',
          points: 3,
          path: 'A',
          source: 'inbox',
          note: '',
          createdAt: '2026-10-06T20:00:00.000Z',
        },
      ],
      settings: { ...oldSettings, schemaVersion: 5 },
    } as unknown as Database

    const migrated = migrateDatabase(v5, new Date(), { adminPin: '7777' })
    expect(migrated?.settings).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      adminPinHash: hashPin('7777'),
      familyName: DEFAULT_FAMILY_NAME,
      muteKidSounds: false,
    })
    expect(migrated?.ledger).toHaveLength(1)

    const adapter = new MemoryAdapter()
    adapter.save(v5)
    const repo = new Repository(adapter, { defaultAdminPin: '7777' })
    expect(repo.verifyAdminPin('7777')).toBe(true)
    expect(repo.adminListLedger()).toHaveLength(1)
  })
})

describe('snapshot repair', () => {
  it('fills tables missing from a current-version snapshot instead of crashing', () => {
    const seeded = buildSeedDatabase()
    const { surpriseDrops: _d, wins: _w, ...partial } = seeded
    const adapter = new MemoryAdapter()
    adapter.save(partial as unknown as Database)
    const repo = new Repository(adapter)
    expect(repo.adminListSurprises()).toEqual([])
    expect(repo.listWins()).toEqual([])
    expect(repo.getSettings().schemaVersion).toBe(SCHEMA_VERSION)
    expect(repo.adminListLedger()).toEqual([])
  })
})

describe('audit log', () => {
  function seeded() {
    const repo = createMemoryRepository()
    repo.adminSetClockOverride(iso(denverInstant(2026, 10, 6, 15))) // Tue Oct 6
    const claim = repo.claimForKid({ userId: 'kameron', actId: 'little.dogs' }) // +3
    repo.approveClaim(claim.id, { note: 'Good job' })
    repo.adminAddEarn({ earnerId: 'christopher', actId: 'teen.own-mistake' })
    repo.adminAddEarn({ earnerId: 'admin', actId: 'parent.day-demerit' })
    repo.adminSendSurprise({ kidId: 'alea', title: 'Starbucks', createdBy: 'admin', emoji: '☕' })
    return repo
  }

  it('lists approvals, Add earns, and surprises together, newest first, with points on ledger rows only', () => {
    const repo = seeded()
    const events = repo.adminListAuditEvents()
    expect(events).toHaveLength(4)
    expect(events.map((e) => e.path).sort()).toEqual(['A', 'B', 'B', 'surprise'])
    // The surprise honors the Oct 6 clock preview; ledger rows are stamped with the real (earlier) clock.
    expect(events[0]).toMatchObject({
      kind: 'surprise',
      userName: 'Alea',
      title: '☕ Starbucks',
      points: null,
      source: 'Surprise',
      status: 'pending',
    })
    expect(events.find((e) => e.path === 'A')).toMatchObject({
      kind: 'ledger',
      userName: 'Kameron',
      title: 'Dogs',
      points: 3,
      path: 'A',
      source: 'Inbox',
      note: 'Good job',
    })
    const parentRow = events.find((e) => e.userId === 'admin')
    expect(parentRow).toMatchObject({ source: 'Add earn', path: 'B' })
    expect(parentRow?.points).toBeLessThan(0)
  })

  it('filters by kid', () => {
    const repo = seeded()
    expect(repo.adminListAuditEvents({ userId: 'kameron' }).map((e) => e.title)).toEqual(['Dogs'])
    expect(repo.adminListAuditEvents({ userId: 'alea' }).map((e) => e.kind)).toEqual(['surprise'])
    expect(repo.adminListAuditEvents({ userId: 'christopher' })).toHaveLength(1)
  })

  it('filters by path / surprise, date range, and free text', () => {
    const repo = seeded()
    expect(repo.adminListAuditEvents({ path: 'A' })).toHaveLength(1)
    expect(repo.adminListAuditEvents({ path: 'B' })).toHaveLength(2)
    expect(repo.adminListAuditEvents({ path: 'surprise' })).toHaveLength(1)

    // Ledger rows are stamped with the real clock; the surprise honors the clock preview (Oct 6).
    const today = denverDateKey(new Date())
    expect(repo.adminListAuditEvents({ from: '2026-10-06', to: '2026-10-06' }).map((e) => e.kind)).toEqual(['surprise'])
    expect(repo.adminListAuditEvents({ from: today, to: today, path: 'B' })).toHaveLength(2)
    expect(repo.adminListAuditEvents({ from: '2026-10-07', to: '2026-10-07' })).toHaveLength(0)
    expect(repo.adminListAuditEvents({ to: '2026-01-01' })).toHaveLength(0)

    expect(repo.adminListAuditEvents({ query: 'starbucks' }).map((e) => e.kind)).toEqual(['surprise'])
    expect(repo.adminListAuditEvents({ query: 'good job' })).toHaveLength(1)
    expect(repo.adminListAuditEvents({ query: 'Kameron' })).toHaveLength(1)
    expect(repo.adminListAuditEvents({ query: 'add earn' })).toHaveLength(2)
    expect(repo.adminListAuditEvents({ limit: 2 })).toHaveLength(2)
  })

  it('reflects surprise status changes without touching meters', () => {
    const repo = seeded()
    const meters = repo.getMeters()
    const drop = repo.adminListSurprises()[0]!
    repo.adminCancelSurprise(drop.id)
    expect(repo.adminListAuditEvents({ path: 'surprise' })[0]).toMatchObject({ status: 'canceled' })
    expect(repo.getMeters()).toEqual(meters)
  })
})
