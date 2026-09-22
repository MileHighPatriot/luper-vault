import type {
  Band,
  Database,
  EarnAct,
  EarnPath,
  KidEarnAct,
  KidPendingClaim,
  LedgerEntry,
  LedgerSource,
  PendingClaim,
  Settings,
  User,
  VaultMeter,
} from './types'
import { applyLedgerEntry } from '@/engine/meters'
import { denverDateKey } from '@/lib/time/denver'
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
  path: EarnPath
  source: LedgerSource
  claimId?: string
  note?: string
}

export interface QueueClaimInput {
  userId: string
  actId: string
  createdAt?: string
}

export interface ApproveClaimInput {
  /** Overrides the claim's requested points. Must be an integer. */
  points?: number
  note?: string
}

export class ClaimError extends Error {
  readonly code:
    | 'not-found'
    | 'not-pending'
    | 'not-path-a'
    | 'not-a-kid'
    | 'bad-points'
    | 'unknown-act'
    | 'already-pending'
  constructor(code: ClaimError['code'], message: string) {
    super(message)
    this.name = 'ClaimError'
    this.code = code
  }
}

export interface AddEarnInput {
  /** Kid user id, or the admin id to log a parent earn/demerit. */
  earnerId: string
  actId: string
  note?: string
}

export class AddEarnError extends Error {
  readonly code: 'unknown-user' | 'unknown-act' | 'not-path-b' | 'wrong-band'
  constructor(code: AddEarnError['code'], message: string) {
    super(message)
    this.name = 'AddEarnError'
    this.code = code
  }
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

  /**
   * Path B acts a parent may stamp for this earner. Kids get their band's Path B
   * acts plus conduct acts for their audience; the admin (as parent) gets the
   * parent band. Path A acts never appear here: those go through the inbox.
   */
  adminListPathBActsFor(earnerId: string): EarnAct[] {
    const user = this.getUser(earnerId)
    if (!user) return []
    return this.db.earnActs.filter((act) => act.path === 'B' && this.actAppliesTo(act, user))
  }

  /**
   * KID-FACING. The acts a kid sees on their Earn screen: their band's Path A
   * and Path B acts plus positive conduct stamps for their audience, projected
   * to names only. Demerits (negative points) are never included.
   */
  listEarnActsForKid(userId: string): KidEarnAct[] {
    const user = this.getUser(userId)
    if (!user || user.role === 'admin' || !user.band) return []
    return this.db.earnActs
      .filter((act) => act.points > 0 && this.actAppliesTo(act, user))
      .map(({ id, title, path, band, rare }) => ({ id, title, path, band, ...(rare ? { rare } : {}) }))
  }

  /** KID-FACING. The kid's own pending claims, without points. */
  listKidPendingClaims(userId: string): KidPendingClaim[] {
    return this.db.pendingClaims
      .filter((c) => c.userId === userId && c.status === 'pending')
      .map(({ id, actId, createdAt }) => ({ id, actId, createdAt }))
  }

  /** When the family vault last moved, or null. Family-wide; safe for kids. */
  getVaultLastMovedAt(): string | null {
    const last = this.db.ledger[this.db.ledger.length - 1]
    return last?.createdAt ?? null
  }

  private actAppliesTo(act: EarnAct, user: User): boolean {
    if (user.role === 'admin') return act.band === 'parent'
    if (!user.band) return false
    if (act.band === user.band) return true
    return act.band === 'conduct' && act.audience === user.band
  }

  /**
   * ADMIN ONLY. Stamp a Path B earn or demerit straight into the ledger and
   * meters. No claim, no pending state: this is the parent's word.
   */
  adminAddEarn(input: AddEarnInput): LedgerEntry {
    const user = this.getUser(input.earnerId)
    if (!user) throw new AddEarnError('unknown-user', `Unknown earner ${input.earnerId}`)
    const act = this.getAct(input.actId)
    if (!act) throw new AddEarnError('unknown-act', `Unknown act ${input.actId}`)
    if (act.path !== 'B') {
      throw new AddEarnError('not-path-b', `${act.title} is Path A; kids claim it and parents approve it in the Inbox`)
    }
    if (!this.actAppliesTo(act, user)) {
      throw new AddEarnError('wrong-band', `${act.title} does not apply to ${user.name}`)
    }
    return this.recordApprovedPoints({
      userId: user.id,
      actId: act.id,
      points: act.points,
      path: 'B',
      source: 'add-earn',
      note: input.note?.trim() || undefined,
    })
  }

  // --- claims (Path A "I did it" -> parent inbox) -------------------------

  /** Claims still waiting on a parent, newest first. */
  listPendingClaims(): PendingClaim[] {
    return this.db.pendingClaims
      .filter((c) => c.status === 'pending')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getClaim(id: string): PendingClaim | undefined {
    return this.db.pendingClaims.find((c) => c.id === id)
  }

  /** ADMIN ONLY. Claims of every status, newest first, for dev tooling. */
  adminListClaims(limit = 50): PendingClaim[] {
    return [...this.db.pendingClaims].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  }

  /**
   * Queue a Path A claim for a kid. Path B acts are parent-stamped and cannot
   * be claimed; the admin user has no band and cannot claim either.
   */
  queueClaim(input: QueueClaimInput): PendingClaim {
    const user = this.getUser(input.userId)
    if (!user || user.role === 'admin' || !user.band) {
      throw new ClaimError('not-a-kid', `Only kids can claim acts (got ${input.userId})`)
    }
    const act = this.getAct(input.actId)
    if (!act) throw new ClaimError('unknown-act', `Unknown act ${input.actId}`)
    if (act.path !== 'A') {
      throw new ClaimError('not-path-a', `${act.title} is Path B (parent-stamped) and cannot be claimed`)
    }
    if (this.db.pendingClaims.some((c) => c.userId === user.id && c.actId === act.id && c.status === 'pending')) {
      throw new ClaimError('already-pending', `${act.title} is already waiting for a parent`)
    }
    const claim: PendingClaim = {
      id: newId(),
      userId: user.id,
      actId: act.id,
      requestedPoints: act.points,
      status: 'pending',
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
    this.commit({ ...this.db, pendingClaims: [...this.db.pendingClaims, claim] })
    return claim
  }

  /**
   * ADMIN ONLY. Approve a pending claim: write the ledger, move the meters,
   * mark the claim approved. Edited points win over the catalog value.
   */
  approveClaim(claimId: string, input: ApproveClaimInput = {}): LedgerEntry {
    const claim = this.requirePendingClaim(claimId)
    const points = input.points ?? claim.editedPoints ?? claim.requestedPoints
    if (!Number.isInteger(points)) {
      throw new ClaimError('bad-points', `Points must be a whole number (got ${points})`)
    }
    const act = this.getAct(claim.actId)
    const now = new Date().toISOString()
    const entry: LedgerEntry = {
      id: newId(),
      userId: claim.userId,
      actId: claim.actId,
      points,
      path: act?.path ?? 'A',
      source: 'inbox',
      claimId: claim.id,
      note: input.note ?? claim.parentNote ?? '',
      createdAt: now,
    }
    const resolved: PendingClaim = {
      ...claim,
      status: 'approved',
      resolvedAt: now,
      ...(points !== claim.requestedPoints ? { editedPoints: points } : {}),
      ...(input.note !== undefined ? { parentNote: input.note } : {}),
    }
    this.commit({
      ...this.db,
      pendingClaims: this.db.pendingClaims.map((c) => (c.id === claim.id ? resolved : c)),
      ledger: [...this.db.ledger, entry],
      vaultMeters: applyLedgerEntry(this.db.vaultMeters, points),
    })
    return entry
  }

  /** ADMIN ONLY. Deny a pending claim. No ledger write, no meter movement. */
  denyClaim(claimId: string, note?: string): PendingClaim {
    const claim = this.requirePendingClaim(claimId)
    const resolved: PendingClaim = {
      ...claim,
      status: 'denied',
      resolvedAt: new Date().toISOString(),
      ...(note !== undefined ? { parentNote: note } : {}),
    }
    this.commit({
      ...this.db,
      pendingClaims: this.db.pendingClaims.map((c) => (c.id === claim.id ? resolved : c)),
    })
    return resolved
  }

  /**
   * ADMIN ONLY. Approve every pending claim created on the given Denver
   * calendar day (default: today) at its requested/edited points.
   */
  approveAllPendingOn(dateKey: string = denverDateKey()): LedgerEntry[] {
    const targets = this.listPendingClaims().filter((c) => denverDateKey(new Date(c.createdAt)) === dateKey)
    // Oldest first so the ledger reads chronologically.
    return targets.reverse().map((c) => this.approveClaim(c.id))
  }

  private requirePendingClaim(claimId: string): PendingClaim {
    const claim = this.getClaim(claimId)
    if (!claim) throw new ClaimError('not-found', `Claim ${claimId} not found`)
    if (claim.status !== 'pending') {
      throw new ClaimError('not-pending', `Claim ${claimId} is already ${claim.status}`)
    }
    return claim
  }

  // --- ledger + meters -----------------------------------------------------

  /**
   * Record approved points and push them into the family meters in one step.
   * Used by the verify screen's simulate buttons; inbox approvals go through
   * `approveClaim` so the claim is resolved in the same commit.
   */
  recordApprovedPoints(input: RecordApprovedPointsInput): LedgerEntry {
    const entry: LedgerEntry = {
      id: newId(),
      userId: input.userId,
      actId: input.actId,
      points: input.points,
      path: input.path,
      source: input.source,
      ...(input.claimId ? { claimId: input.claimId } : {}),
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

  /** ADMIN ONLY. Raw ledger rows, oldest first. Never import from a kid route. */
  adminListLedger(): LedgerEntry[] {
    return [...this.db.ledger]
  }

  /** ADMIN ONLY. Most recent approved events, newest first. */
  adminListRecentLedger(limit = 50): LedgerEntry[] {
    return [...this.db.ledger].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  }

  /** ADMIN ONLY. Zero the meters, ledger, and claims for engine verification. */
  adminResetMetersAndLedger(): void {
    const fresh = buildSeedDatabase()
    this.commit({ ...this.db, ledger: [], pendingClaims: [], vaultMeters: fresh.vaultMeters })
  }

  /**
   * ADMIN ONLY / DEV. Queue a handful of Path A claims across the kids so the
   * inbox has something to process without logging in as each kid.
   */
  adminSeedDemoClaims(): PendingClaim[] {
    const kids = this.db.users.filter((u) => u.band)
    const created: PendingClaim[] = []
    const base = Date.now()
    kids.forEach((kid, kidIndex) => {
      const alreadyPending = new Set(this.listKidPendingClaims(kid.id).map((c) => c.actId))
      const pathA = this.db.earnActs.filter(
        (a) => a.band === kid.band && a.path === 'A' && !alreadyPending.has(a.id),
      )
      // Two acts per kid, offset through the catalog so siblings get different ones.
      for (let i = 0; i < 2; i += 1) {
        const act = pathA[(kidIndex * 3 + i * 5) % pathA.length]
        if (!act || alreadyPending.has(act.id)) continue
        alreadyPending.add(act.id)
        created.push(
          this.queueClaim({
            userId: kid.id,
            actId: act.id,
            // Stagger so newest-first ordering is visible in the inbox.
            createdAt: new Date(base - (created.length + 1) * 60_000).toISOString(),
          }),
        )
      }
    })
    return created
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
