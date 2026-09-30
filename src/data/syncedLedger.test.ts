import { describe, expect, it } from 'vitest'
import type { Database } from './types'
import { FamilyCodeError, type LedgerRemote } from './remoteLedger'
import { SyncedLedger } from './syncedLedger'
import { createMemoryRepository } from './memoryRepository'

/** Stand-in for supabase/ledger.sql: one row, compare-and-swap on version. */
class FakeServer {
  version = 0
  snapshot: Database | null = null
  offline = false
  pushes = 0

  remote(code = 'maple'): LedgerRemote {
    const check = () => {
      if (this.offline) throw new TypeError('Failed to fetch')
      if (code !== 'maple') throw new FamilyCodeError()
    }
    return {
      pull: async (since) => {
        check()
        return { version: this.version, snapshot: this.version > since ? structuredClone(this.snapshot) : null }
      },
      push: async (expected, snapshot) => {
        check()
        this.pushes++
        if (expected !== this.version) {
          return { ok: false, version: this.version, snapshot: structuredClone(this.snapshot) }
        }
        this.version++
        this.snapshot = structuredClone(snapshot)
        return { ok: true, version: this.version }
      },
    }
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

async function device(server: FakeServer, localSnapshot?: Database) {
  const ledger = await SyncedLedger.connect(server.remote(), { localSnapshot, retryMs: 1 })
  await settle()
  return ledger
}

describe('SyncedLedger', () => {
  it('uploads the first device and hands the same ledger to the next', async () => {
    const server = new FakeServer()
    const parent = await device(server)
    expect(server.version).toBe(1)

    const kid = await device(server)
    expect(kid.repository.listUsers()).toEqual(parent.repository.listUsers())
  })

  it("seeds the server from the first device's local data", async () => {
    const local = createMemoryRepository()
    local.adminUpdateFamilySettings({ familyName: 'Luper HQ' })
    const server = new FakeServer()
    await device(server, local.exportSnapshot())

    const other = await device(server)
    expect(other.repository.getFamilySettings().familyName).toBe('Luper HQ')
  })

  it('keeps both writes when two devices save at the same moment', async () => {
    const server = new FakeServer()
    const kameron = await device(server)
    const alea = await device(server)

    kameron.repository.queueClaim({ userId: 'kameron', actId: 'little.ready-school' })
    alea.repository.queueClaim({ userId: 'alea', actId: 'little.hamper' })
    await settle()
    await settle()

    const parent = await device(server)
    expect(parent.repository.listPendingClaims().map((c) => c.userId).sort()).toEqual(['alea', 'kameron'])
  })

  it('counts a claim once when two parents approve it on different phones', async () => {
    const server = new FakeServer()
    const kid = await device(server)
    const claim = kid.repository.queueClaim({ userId: 'christopher', actId: 'teen.laundry' })
    await settle()

    const mom = await device(server)
    const dad = await device(server)
    mom.repository.approveClaim(claim.id)
    dad.repository.approveClaim(claim.id)
    await settle()
    await settle()

    const check = await device(server)
    expect(check.repository.adminListLedger()).toHaveLength(1)
    expect(check.repository.getClaim(claim.id)?.status).toBe('approved')
  })

  it("shows another device's write after a poll", async () => {
    const server = new FakeServer()
    const kid = await device(server)
    const parent = await device(server)

    let notified = 0
    parent.repository.subscribe(() => notified++)
    kid.repository.queueClaim({ userId: 'kameron', actId: 'little.ready-school' })
    await settle()
    await parent.poll()

    expect(parent.repository.listPendingClaims()).toHaveLength(1)
    expect(notified).toBeGreaterThan(0)
  })

  it('reads do not push', async () => {
    const server = new FakeServer()
    const ledger = await device(server)
    const before = server.pushes
    ledger.repository.listPendingClaims()
    ledger.repository.getMeters()
    await settle()
    expect(server.pushes).toBe(before)
  })

  it('goes offline, keeps the write, and pushes it when the server is back', async () => {
    const server = new FakeServer()
    const kid = await device(server)

    server.offline = true
    kid.repository.queueClaim({ userId: 'kameron', actId: 'little.ready-school' })
    await settle()
    expect(kid.getStatus()).toBe('offline')

    server.offline = false
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(kid.getStatus()).toBe('synced')
    expect(server.snapshot?.pendingClaims).toHaveLength(1)
  })

  it('rejects a wrong family code', async () => {
    const server = new FakeServer()
    await expect(SyncedLedger.connect(server.remote('nope'))).rejects.toBeInstanceOf(FamilyCodeError)
  })
})
