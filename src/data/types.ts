export type Role = 'little' | 'teen' | 'admin'

/** Catalog bands. Kids belong to `little` or `teen`; `conduct` and `parent` acts are logged by the admin. */
export type Band = 'little' | 'teen' | 'conduct' | 'parent'

export type KidBand = Extract<Band, 'little' | 'teen'>

/**
 * Path A: kid claims it, parent approves (Phase 2–4 flow).
 * Path B: parent-stamped only; kids cannot self-claim.
 */
export type EarnPath = 'A' | 'B'

export type Tier = 'T1' | 'T2' | 'T3'

export interface User {
  id: string
  name: string
  role: Role
  /** Which catalog band this user earns from. Admin has none. */
  band: KidBand | null
}

export interface EarnAct {
  id: string
  title: string
  band: Band
  /** Positive earns, negative demerits. Stored in DB now; kid-facing display comes in a later phase. */
  points: number
  path: EarnPath
  /** Mirrors `path === 'B'`; kept explicit so seeds and queries can assert it. */
  pathBStamp: boolean
  /** Conduct acts have separate little/teen values; other bands omit this. */
  audience?: KidBand
  rare?: boolean
}

/**
 * Where a ledger entry came from.
 * `inbox` = approved Path A claim, `add-earn` = parent-stamped Path B earn or
 * demerit, `simulate` = admin verify screen.
 */
export type LedgerSource = 'inbox' | 'add-earn' | 'simulate'

/** Approved points only. Pending claims never touch this table. */
export interface LedgerEntry {
  id: string
  userId: string
  actId: string | null
  /** Final approved points (edited value if the parent changed it). */
  points: number
  path: EarnPath
  source: LedgerSource
  /** Set when the entry came from approving a claim. */
  claimId?: string
  note: string
  createdAt: string
}

export type ClaimStatus = 'pending' | 'approved' | 'denied'

/** A kid's Path A "I did it" waiting for a parent. Phase 4 adds the kid button; Phase 2 queues from the admin dev panel. */
export interface PendingClaim {
  id: string
  userId: string
  actId: string
  /** Catalog points at the time the claim was made. */
  requestedPoints: number
  status: ClaimStatus
  createdAt: string
  resolvedAt?: string
  parentNote?: string
  /** Parent-adjusted points; used instead of `requestedPoints` on approve. */
  editedPoints?: number
}

/**
 * Kid-facing view of a catalog act. Deliberately has no `points`: kids see
 * names only. Demerits are never projected into this shape.
 */
export interface KidEarnAct {
  id: string
  title: string
  path: EarnPath
  band: Band
  rare?: boolean
}

/** Kid-facing view of their own pending claim. No points, no totals. */
export interface KidPendingClaim {
  id: string
  actId: string
  createdAt: string
}

export interface VaultMeter {
  tier: Tier
  /** Points needed to fill this meter. */
  fill: number
  /** Current fill, in tenths of a point, clamped to [0, fill * 10]. */
  valueTenths: number
  /** Points (in tenths) that landed after the meter was already full. Never shortens a period. */
  overflowTenths: number
}

export interface Settings {
  schemaVersion: number
  verse: string
  seededAt: string
}

export interface Database {
  users: User[]
  earnActs: EarnAct[]
  ledger: LedgerEntry[]
  pendingClaims: PendingClaim[]
  vaultMeters: VaultMeter[]
  settings: Settings
}
