import type { Band, Database, EarnAct, LedgerEntry, PendingClaim, Settings, User, VaultMeter } from './types'
import { applyLedgerEntry } from '@/engine/meters'
import { buildSeedDatabase, SCHEMA_VERSION } from './seed'

/**
 * Persistence boundary. Anything that can load/save a whole `Database`
 * snapshot can back the app: localStorage today, SQLite behind a small
 * server later, without touching UI or the meter engine.
 */
export interface StorageAdapter {
  load(): Database | null
  save(db: Database): void
  clear(): void
}

export interface RecordApprovedPointsInput {
  userId: string
  actId: string | null
  points: number
  note?: string
}

type Listener = () => void

/**
 * Typed data access over a `StorageAdapter`.
 *
 * Deliberately absent: any method that returns per-user or per-sibling point
 * totals. Kids must never be able to see personal scores, so the only
 * aggregate this layer exposes is the family vault meters. Ledger reads exist
 * for admin tooling and are gated at the route level.
 */
export class Repository {
  private db: Database
  private readonly adapter: StorageAdapter
  private readonly listeners = new Set<Listener>()

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter
    this.db = this.loadOrSeed()
  }

  private loadOrSeed(): Database {
    const existing = this.adapter.load()
    if (existing && existing.settings?.schemaVersion === SCHEMA_VERSION) {
      return existing
    }
    // Missing or stale schema: reseed. There is no user data worth migrating in Phase 1.
    const seeded = buildSeedDatabase()
    this.adapter.save(seeded)
    return seeded
  }

  private commit(next: Database): void {
    this.db = next
    this.adapter.save(next)
    for (const listener of this.listeners) listener()
  }

  /** Subscribe to any write. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // --- users ---------------------------------------------------------------

  listUsers(): User[] {
    return [...this.db.users]
  }

  getUser(id: string): User | undefined {
    return this.db.users.find((u) => u.id === id)
  }

  // --- earn acts catalog ---------------------------------------------------

  listActs(): EarnAct[] {
    return [...this.db.earnActs]
  }

  listActsByBand(band: Band): EarnAct[] {
    return this.db.earnActs.filter((a) => a.band === band)
  }

  getAct(id: string): EarnAct | undefined {
    return this.db.earnActs.find((a) => a.id === id)
  }

  // --- pending claims (table exists; workflow arrives in Phase 2) ----------

  listPendingClaims(): PendingClaim[] {
    return [...this.db.pendingClaims]
  }

  // --- ledger + meters -----------------------------------------------------

  /**
   * Record approved points and push them into the family meters in one step.
   * This is the only write path into the ledger.
   */
  recordApprovedPoints(input: RecordApprovedPointsInput): LedgerEntry {
    const entry: LedgerEntry = {
      id: newId(),
      userId: input.userId,
      actId: input.actId,
      points: input.points,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    }
    this.commit({
      ...this.db,
      ledger: [...this.db.ledger, entry],
      vaultMeters: applyLedgerEntry(this.db.vaultMeters, input.points),
    })
    return entry
  }

  /** Family-wide meters. Safe to show to anyone. */
  getMeters(): VaultMeter[] {
    return this.db.vaultMeters.map((m) => ({ ...m }))
  }

  /** ADMIN ONLY. Raw ledger rows for dev/verify tooling. Never import from a kid route. */
  adminListLedger(): LedgerEntry[] {
    return [...this.db.ledger]
  }

  /** ADMIN ONLY. Zero the meters and ledger for engine verification. */
  adminResetMetersAndLedger(): void {
    const fresh = buildSeedDatabase()
    this.commit({ ...this.db, ledger: [], vaultMeters: fresh.vaultMeters })
  }

  // --- settings ------------------------------------------------------------

  getSettings(): Settings {
    return { ...this.db.settings }
  }

  updateSettings(patch: Partial<Omit<Settings, 'schemaVersion'>>): void {
    this.commit({ ...this.db, settings: { ...this.db.settings, ...patch } })
  }

  /** Wipe persisted data and reseed. */
  resetAll(): void {
    this.adapter.clear()
    this.commit(buildSeedDatabase())
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
