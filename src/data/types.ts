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

/** A period reward tied to one vault meter: T1 = week, T2 = month, T3 = quarter. */
export interface Reward {
  id: string
  tier: Tier
  title: string
  blurb: string
  /** Inactive rewards are hidden from kids but kept for history. */
  active: boolean
  createdAt: string
  updatedAt: string
  /** Set when a parent announces it. Kids see the banner on Home once each. */
  announcement?: {
    at: string
    seenBy: string[]
  }
}

/** Kid-facing reward projection. No costs, no per-person data. */
export interface KidReward {
  id: string
  tier: Tier
  title: string
  blurb: string
  announced: boolean
}

export type SurpriseStatus = 'pending' | 'seen' | 'canceled'

/**
 * A mid-cycle treat a parent pushes to one kid. Not a vault reward: it never
 * moves T1/T2/T3 and it is not Path A or B. `pending` until that kid dismisses
 * the Home flare, then `seen`. Parents can cancel only while it is still unseen.
 */
export interface SurpriseDrop {
  id: string
  kidId: string
  title: string
  note?: string
  emoji?: string
  createdAt: string
  createdBy: string
  status: SurpriseStatus
  seenAt?: string
}

/** Kid-facing surprise. No kid id, no sender, no meter data. */
export interface KidSurprise {
  id: string
  title: string
  note?: string
  emoji?: string
  createdAt: string
}

export type WinKind = 'unlock' | 'announce'

/** Something the family unlocked or a parent announced. Family-wide; no names, no scores. */
export interface Win {
  id: string
  kind: WinKind
  tier: Tier
  title: string
  rewardId: string | null
  createdAt: string
}

export interface Settings {
  schemaVersion: number
  verse: string
  seededAt: string
  /** Digest of the shared parent PIN. See `src/lib/pin.ts`. Never shown to kids. */
  adminPinHash: string
  /** Shown in the header and on the login screen. */
  familyName: string
  /** Kid UI sounds arrive with the Phase 9 skin; the switch exists now so parents can pre-set it. */
  muteKidSounds: boolean
  /**
   * Parent testing switch: treat the app as live before go-live (2026-09-28).
   * Never bypasses Sunday or the 8 PM cutoff. Also settable via VITE_FORCE_LIVE.
   */
  forceLive: boolean
  /**
   * DEV ONLY. When set, every gate and countdown treats this instant as "now"
   * so parents can preview Sunday mode or the cutoff. Cleared from the Clock panel.
   */
  clockOverride: string | null
}

/** KID-FACING slice of settings. No PIN digest, no dev switches. */
export interface FamilySettings {
  familyName: string
  verse: string
  muteKidSounds: boolean
}

export type AuditKind = 'ledger' | 'surprise'

/** Audit filter value: Path A approvals, Path B stamps, or surprise drops. */
export type AuditPath = 'A' | 'B' | 'surprise'

/**
 * ADMIN ONLY. One row of the audit log: a ledger entry (points) or a surprise
 * drop (no points). Read-only in Phase 8; void/undo is a later ticket.
 */
export interface AuditEvent {
  id: string
  kind: AuditKind
  at: string
  userId: string
  userName: string
  title: string
  /** Approved points for ledger rows; null for surprises. */
  points: number | null
  path: AuditPath
  /** Human label: Inbox, Add earn, Simulated, or Surprise. */
  source: string
  status?: SurpriseStatus
  note: string
}

export interface AuditFilter {
  userId?: string
  path?: AuditPath | 'all'
  /** Denver `YYYY-MM-DD`, inclusive. */
  from?: string
  to?: string
  /** Case-insensitive match on title, note, source, or name. */
  query?: string
  limit?: number
}

export interface Database {
  users: User[]
  earnActs: EarnAct[]
  ledger: LedgerEntry[]
  pendingClaims: PendingClaim[]
  vaultMeters: VaultMeter[]
  rewards: Reward[]
  wins: Win[]
  surpriseDrops: SurpriseDrop[]
  settings: Settings
}
