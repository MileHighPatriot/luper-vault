import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from './memoryRepository'
import { AddEarnError } from './repository'

function meterValues(repo: ReturnType<typeof createMemoryRepository>) {
  return Object.fromEntries(repo.getMeters().map((m) => [m.tier, m.valueTenths])) as Record<
    'T1' | 'T2' | 'T3',
    number
  >
}

describe('adminListPathBActsFor', () => {
  it('gives a little kid their band Path B acts plus little conduct acts, never Path A', () => {
    const repo = createMemoryRepository()
    const acts = repo.adminListPathBActsFor('kameron')
    const ids = acts.map((a) => a.id)

    expect(acts.every((a) => a.path === 'B')).toBe(true)
    expect(ids).toEqual(
      expect.arrayContaining([
        'little.honest',
        'little.school-growth',
        'little.kind-sibling',
        'little.bible-verse',
        'conduct.caught-good-little',
        'conduct.day-demerit-little',
        'conduct.serious-little',
      ]),
    )
    expect(ids).not.toContain('little.make-bed')
    expect(ids).not.toContain('conduct.day-demerit-teen')
    expect(ids.some((id) => id.startsWith('parent.'))).toBe(false)
    expect(acts).toHaveLength(4 + 4)
  })

  it('gives the teen their Path B acts plus teen conduct values', () => {
    const repo = createMemoryRepository()
    const acts = repo.adminListPathBActsFor('christopher')
    const byId = Object.fromEntries(acts.map((a) => [a.id, a.points]))
    expect(byId['teen.school-growth']).toBe(6)
    expect(byId['teen.bible-verse']).toBe(5)
    expect(byId['conduct.day-demerit-teen']).toBe(-7)
    expect(byId['conduct.serious-teen']).toBe(-14)
    expect(byId['conduct.day-demerit-little']).toBeUndefined()
    expect(acts).toHaveLength(10 + 4)
  })

  it('gives the admin the parent band only, including the parent day demerit', () => {
    const repo = createMemoryRepository()
    const acts = repo.adminListPathBActsFor('admin')
    expect(acts).toHaveLength(13)
    expect(acts.every((a) => a.band === 'parent')).toBe(true)
    expect(acts.find((a) => a.id === 'parent.day-demerit')?.points).toBe(-5)
  })

  it('returns nothing for unknown users', () => {
    expect(createMemoryRepository().adminListPathBActsFor('nobody')).toEqual([])
  })
})

describe('adminAddEarn', () => {
  it('writes a Path B ledger row with source add-earn and moves meters 50/30/20', () => {
    const repo = createMemoryRepository()
    const entry = repo.adminAddEarn({ earnerId: 'christopher', actId: 'teen.school-growth', note: 'Math up a grade' })

    expect(entry).toMatchObject({
      userId: 'christopher',
      actId: 'teen.school-growth',
      points: 6,
      path: 'B',
      source: 'add-earn',
      note: 'Math up a grade',
    })
    expect(entry.claimId).toBeUndefined()
    expect(meterValues(repo)).toEqual({ T1: 30, T2: 18, T3: 12 })
    expect(repo.adminListLedger()).toHaveLength(1)
    expect(repo.listPendingClaims()).toEqual([])
  })

  it('applies demerits as negative points through the same engine', () => {
    const repo = createMemoryRepository()
    repo.adminAddEarn({ earnerId: 'christopher', actId: 'teen.school-growth' }) // +6 -> 30/18/12
    const entry = repo.adminAddEarn({ earnerId: 'kameron', actId: 'conduct.day-demerit-little' }) // -5

    expect(entry.points).toBe(-5)
    expect(meterValues(repo)).toEqual({ T1: 5, T2: 3, T3: 2 })
  })

  it('lets the admin log a parent earn and a parent demerit', () => {
    const repo = createMemoryRepository()
    repo.adminAddEarn({ earnerId: 'admin', actId: 'parent.stick-to-word' }) // +5
    repo.adminAddEarn({ earnerId: 'admin', actId: 'parent.day-demerit' }) // -5
    expect(meterValues(repo)).toEqual({ T1: 0, T2: 0, T3: 0 })
    expect(repo.adminListLedger().map((e) => e.points)).toEqual([5, -5])
  })

  it('refuses Path A acts', () => {
    const repo = createMemoryRepository()
    expect(() => repo.adminAddEarn({ earnerId: 'kameron', actId: 'little.make-bed' })).toThrow(AddEarnError)
    expect(() => repo.adminAddEarn({ earnerId: 'kameron', actId: 'little.make-bed' })).toThrow(/Path A/)
    expect(repo.adminListLedger()).toEqual([])
  })

  it('refuses acts from another band or audience', () => {
    const repo = createMemoryRepository()
    expect(() => repo.adminAddEarn({ earnerId: 'kameron', actId: 'teen.school-growth' })).toThrow(/does not apply/)
    expect(() => repo.adminAddEarn({ earnerId: 'kameron', actId: 'conduct.day-demerit-teen' })).toThrow(
      /does not apply/,
    )
    expect(() => repo.adminAddEarn({ earnerId: 'admin', actId: 'little.honest' })).toThrow(/does not apply/)
    expect(() => repo.adminAddEarn({ earnerId: 'christopher', actId: 'parent.gym' })).toThrow(/does not apply/)
    expect(meterValues(repo)).toEqual({ T1: 0, T2: 0, T3: 0 })
  })

  it('refuses unknown users and acts', () => {
    const repo = createMemoryRepository()
    expect(() => repo.adminAddEarn({ earnerId: 'nobody', actId: 'little.honest' })).toThrow(/Unknown earner/)
    expect(() => repo.adminAddEarn({ earnerId: 'alea', actId: 'nope' })).toThrow(/Unknown act/)
  })

  it('coexists with inbox approvals in the same ledger', () => {
    const repo = createMemoryRepository()
    repo.approveClaim(repo.queueClaim({ userId: 'alea', actId: 'little.dogs' }).id) // +3
    repo.adminAddEarn({ earnerId: 'alea', actId: 'little.bible-verse' }) // +5
    expect(repo.adminListLedger().map((e) => e.source)).toEqual(['inbox', 'add-earn'])
    expect(meterValues(repo)).toEqual({ T1: 40, T2: 24, T3: 16 })
  })
})
