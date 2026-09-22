import type {
  AuditEvent,
  AuditFilter,
  Band,
  Database,
  EarnAct,
  EarnPath,
  FamilySettings,
  KidEarnAct,
  KidPendingClaim,
  KidReward,
  KidSurprise,
  LedgerEntry,
  LedgerSource,
  PendingClaim,
  Reward,
  Settings,
  SurpriseDrop,
  Tier,
  User,
  VaultMeter,
  Win,
} from './types'
import { applyLedgerEntry, isMeterFull } from '@/engine/meters'
import { hashPin, isValidPinFormat, PIN_MAX_LENGTH, PIN_MIN_LENGTH, pinMatches } from '@/lib/pin'
import { earnWindow, type EarnWindow } from '@/lib/time/calendar'
import { denverDateKey } from '@/lib/time/denver'
import { calendarMonthKey, earnWeekKey } from '@/lib/time/surpriseWeek'
import { buildSeedDatabase, migrateDatabase, SCHEMA_VERSION, TIER_PERIOD } from './seed'

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
    | 'window-closed'
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

export class RewardError extends Error {
  readonly code: 'not-found' | 'empty-title'
  constructor(code: RewardError['code'], message: string) {
    super(message)
    this.name = 'RewardError'
    this.code = code
  }
}

/** Soft caps for surprise drops. Canceled drops do not count. */
export const SURPRISE_WEEK_CAP = 1
export const SURPRISE_MONTH_CAP = 3

export interface SendSurpriseInput {
  kidId: string
  title: string
  note?: string
  emoji?: string
  createdBy: string
}

export interface SurpriseAllowance {
  weekUsed: number
  weekCap: number
  monthUsed: number
  monthCap: number
  canSend: boolean
  /** Set when a cap blocks another drop for this kid right now. */
  message: string | null
}

export class SurpriseError extends Error {
  readonly code: 'not-a-kid' | 'empty-title' | 'week-cap' | 'month-cap' | 'not-found' | 'not-pending'
  constructor(code: SurpriseError['code'], message: string) {
    super(message)
    this.name = 'SurpriseError'
    this.code = code
  }
}

export class PinError extends Error {
  readonly code: 'wrong-current' | 'bad-format' | 'mismatch'
  constructor(code: PinError['code'], message: string) {
    super(message)
    this.name = 'PinError'
    this.code = code
  }
}

export class SettingsError extends Error {
  readonly code: 'empty-family-name' | 'empty-verse'
  constructor(code: SettingsError['code'], message: string) {
    super(message)
    this.name = 'SettingsError'
    this.code = code
  }
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
export interface RepositoryOptions {
  /** Build-time FORCE_LIVE (VITE_FORCE_LIVE=true). OR-ed with the settings toggle. */
  envForceLive?: boolean
  /**
   * Initial admin PIN (VITE_ADMIN_PIN). Used only when seeding or migrating a
   * snapshot that has no stored PIN yet; afterwards Settings owns the PIN.
   */
  defaultAdminPin?: string
}

export class Repository {
  private db: Database
  private readonly adapter: StorageAdapter
  private readonly listeners = new Set<Listener>()
  private readonly envForceLive: boolean
  private readonly defaultAdminPin: string | undefined

  constructor(adapter: StorageAdapter, options: RepositoryOptions = {}) {
    this.adapter = adapter
    this.envForceLive = options.envForceLive ?? false
    this.defaultAdminPin = options.defaultAdminPin
    this.db = this.loadOrSeed()
  }

  // --- clock + calendar gates ---------------------------------------------

  /** "Now" for every gate and countdown. Honors the dev clock override. */
  now(): Date {
    const override = this.db.settings.clockOverride
    if (override) {
      const parsed = new Date(override)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date()
  }

  isClockOverridden(): boolean {
    return Boolean(this.db.settings.clockOverride)
  }

  /** Effective FORCE_LIVE: settings toggle or build-time env. */
  isForceLive(): boolean {
    return this.db.settings.forceLive || this.envForceLive
  }

  /** Can a kid send a Path A claim right now? Family-wide; safe for kids. */
  getEarnWindow(now: Date = this.now()): EarnWindow {
    return earnWindow(now, { forceLive: this.isForceLive() })
  }

  /** ADMIN ONLY. Parent testing switch (persisted). */
  adminSetForceLive(on: boolean): void {
    this.commit({ ...this.db, settings: { ...this.db.settings, forceLive: on } })
  }

  /** ADMIN ONLY / DEV. Freeze "now" at an instant (or clear with null). */
  adminSetClockOverride(iso: string | null): void {
    if (iso !== null && Number.isNaN(new Date(iso).getTime())) {
      throw new RangeError(`Invalid clock override ${iso}`)
    }
    this.commit({ ...this.db, settings: { ...this.db.settings, clockOverride: iso } })
  }

  private loadOrSeed(): Database {
    const existing = this.adapter.load()
    if (existing && existing.settings?.schemaVersion === SCHEMA_VERSION) {
      return existing
    }
    if (existing) {
      const migrated = migrateDatabase(existing, new Date(), { adminPin: this.defaultAdminPin })
      if (migrated) {
        this.adapter.save(migrated)
        return migrated
      }
    }
    // Missing or too-old snapshot: reseed.
    const seeded = buildSeedDatabase(new Date(), { adminPin: this.defaultAdminPin })
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
   * KID-FACING. The "I did it" button. Same as `queueClaim` but enforces the
   * household calendar: closed before go-live (unless FORCE_LIVE), on Sundays,
   * and after the 8 PM Denver cutoff. Admin Dev tools use `queueClaim` directly.
   */
  claimForKid(input: QueueClaimInput): PendingClaim {
    const window = this.getEarnWindow()
    if (!window.open) {
      throw new ClaimError('window-closed', window.message)
    }
    return this.queueClaim({ ...input, createdAt: input.createdAt ?? this.now().toISOString() })
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
      ...this.applyPointsToDb(this.db, points, now),
      pendingClaims: this.db.pendingClaims.map((c) => (c.id === claim.id ? resolved : c)),
      ledger: [...this.db.ledger, entry],
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
  approveAllPendingOn(dateKey: string = denverDateKey(this.now())): LedgerEntry[] {
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
      ...this.applyPointsToDb(this.db, input.points, entry.createdAt),
      ledger: [...this.db.ledger, entry],
    })
    return entry
  }

  /**
   * Run points through the meter engine and record an unlock Win for any
   * meter that just reached its fill. The Win names the active reward for that
   * tier (first by creation) or falls back to a generic label.
   */
  private applyPointsToDb(db: Database, points: number, at: string): Database {
    const before = db.vaultMeters
    const after = applyLedgerEntry(before, points)
    const wins = [...db.wins]
    for (const meter of after) {
      const was = before.find((m) => m.tier === meter.tier)
      if (was && !isMeterFull(was) && isMeterFull(meter)) {
        const reward = db.rewards.find((r) => r.tier === meter.tier && r.active)
        wins.push({
          id: newId(),
          kind: 'unlock',
          tier: meter.tier,
          title: reward ? reward.title : `${TIER_PERIOD[meter.tier]} vault filled`,
          rewardId: reward?.id ?? null,
          createdAt: at,
        })
      }
    }
    return { ...db, vaultMeters: after, wins }
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

  /** ADMIN ONLY. Zero the meters, ledger, claims, and wins for engine verification. Rewards are kept. */
  adminResetMetersAndLedger(): void {
    const fresh = buildSeedDatabase()
    this.commit({ ...this.db, ledger: [], pendingClaims: [], wins: [], vaultMeters: fresh.vaultMeters })
  }

  // --- rewards + wins ------------------------------------------------------

  /** KID-FACING. Active rewards for the Rewards screen, by tier then creation order. */
  listRewardsForKids(): KidReward[] {
    return this.db.rewards
      .filter((r) => r.active)
      .map(({ id, tier, title, blurb, announcement }) => ({ id, tier, title, blurb, announced: Boolean(announcement) }))
  }

  /** KID-FACING. Announced, active rewards this kid has not been shown yet. */
  listUnseenAnnouncements(userId: string): KidReward[] {
    return this.db.rewards
      .filter((r) => r.active && r.announcement && !r.announcement.seenBy.includes(userId))
      .map(({ id, tier, title, blurb }) => ({ id, tier, title, blurb, announced: true }))
  }

  /** KID-FACING. Mark announcements as shown to this kid so the Home banner appears once. */
  markAnnouncementsSeen(userId: string, rewardIds: string[]): void {
    if (rewardIds.length === 0) return
    const ids = new Set(rewardIds)
    this.commit({
      ...this.db,
      rewards: this.db.rewards.map((r) =>
        ids.has(r.id) && r.announcement && !r.announcement.seenBy.includes(userId)
          ? { ...r, announcement: { ...r.announcement, seenBy: [...r.announcement.seenBy, userId] } }
          : r,
      ),
    })
  }

  /** KID-FACING. Unlock and announce events, newest first. Family-wide; no names or scores. */
  listWins(): Win[] {
    return [...this.db.wins].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** ADMIN ONLY. Every reward including inactive ones. */
  adminListRewards(): Reward[] {
    return [...this.db.rewards]
  }

  adminCreateReward(input: { tier: Tier; title: string; blurb: string }): Reward {
    const title = input.title.trim()
    if (!title) throw new RewardError('empty-title', 'Reward needs a title')
    const at = new Date().toISOString()
    const reward: Reward = {
      id: newId(),
      tier: input.tier,
      title,
      blurb: input.blurb.trim(),
      active: true,
      createdAt: at,
      updatedAt: at,
    }
    this.commit({ ...this.db, rewards: [...this.db.rewards, reward] })
    return reward
  }

  adminUpdateReward(id: string, patch: { title?: string; blurb?: string; active?: boolean }): Reward {
    const reward = this.requireReward(id)
    const title = patch.title === undefined ? reward.title : patch.title.trim()
    if (!title) throw new RewardError('empty-title', 'Reward needs a title')
    const next: Reward = {
      ...reward,
      title,
      blurb: patch.blurb === undefined ? reward.blurb : patch.blurb.trim(),
      active: patch.active ?? reward.active,
      updatedAt: new Date().toISOString(),
    }
    this.commit({ ...this.db, rewards: this.db.rewards.map((r) => (r.id === id ? next : r)) })
    return next
  }

  /**
   * ADMIN ONLY. Announce a reward: stamps it, records an announce Win, and
   * queues the one-time banner for every kid. Announcing twice is a no-op.
   */
  adminAnnounceReward(id: string): Reward {
    const reward = this.requireReward(id)
    if (reward.announcement) return reward
    const at = new Date().toISOString()
    const next: Reward = { ...reward, announcement: { at, seenBy: [] }, updatedAt: at }
    const win: Win = {
      id: newId(),
      kind: 'announce',
      tier: reward.tier,
      title: reward.title,
      rewardId: reward.id,
      createdAt: at,
    }
    this.commit({
      ...this.db,
      rewards: this.db.rewards.map((r) => (r.id === id ? next : r)),
      wins: [...this.db.wins, win],
    })
    return next
  }

  private requireReward(id: string): Reward {
    const reward = this.db.rewards.find((r) => r.id === id)
    if (!reward) throw new RewardError('not-found', `Reward ${id} not found`)
    return reward
  }

  // --- surprise drops (outside the vault) ----------------------------------

  /**
   * ADMIN ONLY. How many non-canceled surprises this kid already has in the
   * current earn week and Denver calendar month. Does not touch meters.
   */
  adminSurpriseAllowance(kidId: string, now: Date = this.now()): SurpriseAllowance {
    const kid = this.requireKid(kidId)
    const counts = this.surpriseCounts(kid.id, now)
    const weekBlocked = counts.week >= SURPRISE_WEEK_CAP
    const monthBlocked = counts.month >= SURPRISE_MONTH_CAP
    return {
      weekUsed: counts.week,
      weekCap: SURPRISE_WEEK_CAP,
      monthUsed: counts.month,
      monthCap: SURPRISE_MONTH_CAP,
      canSend: !weekBlocked && !monthBlocked,
      message: weekBlocked
        ? weekCapMessage(kid.name)
        : monthBlocked
          ? monthCapMessage(kid.name)
          : null,
    }
  }

  /**
   * ADMIN ONLY. Push an extra treat to one kid. Allowed any day, including
   * Sunday and before go-live. Never writes the ledger or moves meters.
   */
  adminSendSurprise(input: SendSurpriseInput): SurpriseDrop {
    const kid = this.requireKid(input.kidId)
    const title = input.title.trim()
    if (!title) throw new SurpriseError('empty-title', 'A surprise needs a title')
    const allowance = this.adminSurpriseAllowance(kid.id)
    if (!allowance.canSend) {
      const weekBlocked = allowance.weekUsed >= SURPRISE_WEEK_CAP
      throw new SurpriseError(weekBlocked ? 'week-cap' : 'month-cap', allowance.message ?? 'Surprise cap reached')
    }
    const note = input.note?.trim()
    const emoji = input.emoji?.trim()
    const drop: SurpriseDrop = {
      id: newId(),
      kidId: kid.id,
      title,
      ...(note ? { note } : {}),
      ...(emoji ? { emoji } : {}),
      createdAt: this.now().toISOString(),
      createdBy: input.createdBy,
      status: 'pending',
    }
    this.commit({ ...this.db, surpriseDrops: [...this.db.surpriseDrops, drop] })
    return drop
  }

  /** ADMIN ONLY. Every surprise, newest first. */
  adminListSurprises(): SurpriseDrop[] {
    return [...this.db.surpriseDrops].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /**
   * ADMIN ONLY. Take back a surprise the kid has not opened yet.
   * A seen treat stays on their Wins patch and cannot be canceled.
   */
  adminCancelSurprise(id: string): SurpriseDrop {
    const drop = this.db.surpriseDrops.find((d) => d.id === id)
    if (!drop) throw new SurpriseError('not-found', 'That surprise is not on the list')
    if (drop.status !== 'pending') {
      const kid = this.getUser(drop.kidId)
      const name = kid?.name ?? 'This kid'
      throw new SurpriseError(
        'not-pending',
        drop.status === 'seen'
          ? `${name} already saw this surprise, so it stays on their Wins.`
          : 'That surprise is already canceled.',
      )
    }
    const next: SurpriseDrop = { ...drop, status: 'canceled' }
    this.commit({
      ...this.db,
      surpriseDrops: this.db.surpriseDrops.map((d) => (d.id === id ? next : d)),
    })
    return next
  }

  /** KID-FACING. Unopened surprises for this kid only, newest first. */
  listPendingSurprisesForKid(kidId: string): KidSurprise[] {
    return this.db.surpriseDrops
      .filter((d) => d.kidId === kidId && d.status === 'pending')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toKidSurprise)
  }

  /** KID-FACING. Seen surprises for this kid's Wins patches, newest first. */
  listSeenSurprisesForKid(kidId: string): KidSurprise[] {
    return this.db.surpriseDrops
      .filter((d) => d.kidId === kidId && d.status === 'seen')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toKidSurprise)
  }

  /**
   * KID-FACING. Dismiss the Home flare. Only this kid's pending drops change;
   * other ids are ignored. Does not move meters.
   */
  markSurprisesSeen(kidId: string, ids: string[]): void {
    if (ids.length === 0) return
    const wanted = new Set(ids)
    const seenAt = this.now().toISOString()
    let changed = false
    const surpriseDrops = this.db.surpriseDrops.map((d) => {
      if (d.kidId !== kidId || d.status !== 'pending' || !wanted.has(d.id)) return d
      changed = true
      return { ...d, status: 'seen' as const, seenAt }
    })
    if (changed) this.commit({ ...this.db, surpriseDrops })
  }

  private requireKid(kidId: string): User {
    const user = this.getUser(kidId)
    if (!user || user.role === 'admin' || !user.band) {
      throw new SurpriseError('not-a-kid', 'Pick a kid to send the surprise to')
    }
    return user
  }

  private surpriseCounts(kidId: string, now: Date): { week: number; month: number } {
    const week = earnWeekKey(now)
    const month = calendarMonthKey(now)
    let weekCount = 0
    let monthCount = 0
    for (const drop of this.db.surpriseDrops) {
      if (drop.kidId !== kidId || drop.status === 'canceled') continue
      const at = new Date(drop.createdAt)
      if (earnWeekKey(at) === week) weekCount += 1
      if (calendarMonthKey(at) === month) monthCount += 1
    }
    return { week: weekCount, month: monthCount }
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

  /** ADMIN ONLY. Full settings including the PIN digest and dev switches. */
  getSettings(): Settings {
    return { ...this.db.settings }
  }

  /** KID-FACING. Family name, verse, and the sound flag. Nothing else. */
  getFamilySettings(): FamilySettings {
    const { familyName, verse, muteKidSounds } = this.db.settings
    return { familyName, verse, muteKidSounds }
  }

  updateSettings(patch: Partial<Omit<Settings, 'schemaVersion' | 'adminPinHash'>>): void {
    this.commit({ ...this.db, settings: { ...this.db.settings, ...patch } })
  }

  /** ADMIN ONLY. Family name, Sky log verse, and the kid-sound mute flag. */
  adminUpdateFamilySettings(patch: Partial<FamilySettings>): FamilySettings {
    const next: Partial<FamilySettings> = {}
    if (patch.familyName !== undefined) {
      const familyName = patch.familyName.trim()
      if (!familyName) throw new SettingsError('empty-family-name', 'Family name cannot be blank')
      next.familyName = familyName
    }
    if (patch.verse !== undefined) {
      const verse = patch.verse.trim()
      if (!verse) throw new SettingsError('empty-verse', 'The Sky log verse cannot be blank')
      next.verse = verse
    }
    if (patch.muteKidSounds !== undefined) next.muteKidSounds = patch.muteKidSounds
    this.updateSettings(next)
    return this.getFamilySettings()
  }

  // --- admin PIN -----------------------------------------------------------

  /** Does this PIN unlock the shared parent login? Trims whitespace. */
  verifyAdminPin(pin: string): boolean {
    return pinMatches(pin, this.db.settings.adminPinHash)
  }

  /**
   * ADMIN ONLY. Change the parent PIN. Requires the current PIN, a 4–8 digit
   * new PIN, and a matching confirmation.
   */
  adminChangePin(input: { currentPin: string; newPin: string; confirmPin: string }): void {
    if (!this.verifyAdminPin(input.currentPin)) {
      throw new PinError('wrong-current', 'Current PIN is wrong')
    }
    const newPin = input.newPin.trim()
    if (!isValidPinFormat(newPin)) {
      throw new PinError('bad-format', `New PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`)
    }
    if (newPin !== input.confirmPin.trim()) {
      throw new PinError('mismatch', 'New PIN and confirmation do not match')
    }
    this.commit({ ...this.db, settings: { ...this.db.settings, adminPinHash: hashPin(newPin) } })
  }

  // --- audit ---------------------------------------------------------------

  /**
   * ADMIN ONLY. Ledger entries and surprise drops as one searchable list,
   * newest first. View-only. TODO(audit-void): void/undo is a later ticket.
   */
  adminListAuditEvents(filter: AuditFilter = {}): AuditEvent[] {
    const nameOf = (id: string) => this.getUser(id)?.name ?? id
    const ledgerRows: AuditEvent[] = this.db.ledger.map((e) => ({
      id: e.id,
      kind: 'ledger',
      at: e.createdAt,
      userId: e.userId,
      userName: nameOf(e.userId),
      title: e.actId ? (this.getAct(e.actId)?.title ?? e.actId) : 'Simulated points',
      points: e.points,
      path: e.path,
      source: LEDGER_SOURCE_LABEL[e.source],
      note: e.note,
    }))
    const surpriseRows: AuditEvent[] = this.db.surpriseDrops.map((d) => ({
      id: d.id,
      kind: 'surprise',
      at: d.createdAt,
      userId: d.kidId,
      userName: nameOf(d.kidId),
      title: d.emoji ? `${d.emoji} ${d.title}` : d.title,
      points: null,
      path: 'surprise',
      source: 'Surprise',
      status: d.status,
      note: d.note ?? '',
    }))

    const path = filter.path ?? 'all'
    const query = filter.query?.trim().toLowerCase()
    const rows = [...ledgerRows, ...surpriseRows]
      .filter((row) => {
        if (filter.userId && row.userId !== filter.userId) return false
        if (path !== 'all' && row.path !== path) return false
        const day = denverDateKey(new Date(row.at))
        if (filter.from && day < filter.from) return false
        if (filter.to && day > filter.to) return false
        if (query) {
          const haystack = `${row.title} ${row.note} ${row.source} ${row.userName} ${row.status ?? ''}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        return true
      })
      .sort((a, b) => b.at.localeCompare(a.at))
    return filter.limit ? rows.slice(0, filter.limit) : rows
  }

  /** Wipe persisted data and reseed. The PIN goes back to the build default. */
  resetAll(): void {
    this.adapter.clear()
    this.commit(buildSeedDatabase(new Date(), { adminPin: this.defaultAdminPin }))
  }
}

const LEDGER_SOURCE_LABEL: Record<LedgerSource, string> = {
  inbox: 'Inbox',
  'add-earn': 'Add earn',
  simulate: 'Simulated',
}

function toKidSurprise(drop: SurpriseDrop): KidSurprise {
  return {
    id: drop.id,
    title: drop.title,
    ...(drop.note ? { note: drop.note } : {}),
    ...(drop.emoji ? { emoji: drop.emoji } : {}),
    createdAt: drop.createdAt,
  }
}

function weekCapMessage(name: string): string {
  return `${name} already has a surprise this earn week (Monday–Saturday; Sunday counts on that same week). One per kid per week.`
}

function monthCapMessage(name: string): string {
  return `${name} already has ${SURPRISE_MONTH_CAP} surprises this calendar month. Three per kid per month.`
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
