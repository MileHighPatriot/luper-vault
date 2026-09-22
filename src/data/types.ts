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

/** Approved points only. Pending claims never touch this table. */
export interface LedgerEntry {
  id: string
  userId: string
  actId: string | null
  points: number
  note: string
  createdAt: string
}

export interface PendingClaim {
  id: string
  userId: string
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
