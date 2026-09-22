import type { Database } from '@/data/types'
import { initialMeters } from '@/engine/meters'
import { FALLBACK_ADMIN_PIN, hashPin } from '@/lib/pin'
import { SEED_ACTS } from './acts'
import { buildSeedRewards } from './rewards'
import { SEED_USERS } from './users'

/**
 * v1 Phase 1 foundation · v2 Phase 2 claim status + ledger source ·
 * v3 Phase 5 rewards + wins tables · v4 Phase 6 forceLive + clockOverride settings ·
 * v5 Phase 7 surprise drops · v6 Phase 8 admin PIN digest, family name, mute flag.
 */
export const SCHEMA_VERSION = 6

/** Placeholder until a parent edits it in Settings. */
export const PLACEHOLDER_VERSE =
  'Whatever you do, work at it with all your heart. — Colossians 3:23 (placeholder)'

export const DEFAULT_FAMILY_NAME = 'The Lupers'

export interface SeedOptions {
  /** Initial admin PIN (from VITE_ADMIN_PIN). Only used when no PIN is stored yet. */
  adminPin?: string
}

export function buildSeedDatabase(now: Date = new Date(), options: SeedOptions = {}): Database {
  return {
    users: [...SEED_USERS],
    earnActs: [...SEED_ACTS],
    ledger: [],
    pendingClaims: [],
    vaultMeters: initialMeters(),
    rewards: buildSeedRewards(now),
    wins: [],
    surpriseDrops: [],
    settings: {
      schemaVersion: SCHEMA_VERSION,
      verse: PLACEHOLDER_VERSE,
      seededAt: now.toISOString(),
      forceLive: false,
      clockOverride: null,
      adminPinHash: hashPin(options.adminPin ?? FALLBACK_ADMIN_PIN),
      familyName: DEFAULT_FAMILY_NAME,
      muteKidSounds: false,
    },
  }
}

/**
 * Bring an older snapshot up to the current schema, or return null when it is
 * too old to migrate (caller reseeds). Only additive steps live here.
 */
export function migrateDatabase(db: Database, now: Date = new Date(), options: SeedOptions = {}): Database | null {
  let version = db.settings?.schemaVersion
  if (typeof version !== 'number' || version < 2) return null
  let next = db
  if (version === 2) {
    next = { ...next, rewards: buildSeedRewards(now), wins: [] }
    version = 3
  }
  if (version === 3) {
    next = { ...next, settings: { ...next.settings, forceLive: false, clockOverride: null } }
    version = 4
  }
  if (version === 4) {
    next = { ...next, surpriseDrops: next.surpriseDrops ?? [] }
    version = 5
  }
  if (version === 5) {
    next = {
      ...next,
      settings: {
        ...next.settings,
        adminPinHash: hashPin(options.adminPin ?? FALLBACK_ADMIN_PIN),
        familyName: DEFAULT_FAMILY_NAME,
        muteKidSounds: false,
      },
    }
    version = 6
  }
  if (version !== SCHEMA_VERSION) return null
  return { ...next, settings: { ...next.settings, schemaVersion: SCHEMA_VERSION } }
}

export { SEED_ACTS, EXPECTED_ACT_COUNTS, countActsByBand } from './acts'
export { SEED_USERS, ADMIN_USER_ID } from './users'
export { buildSeedRewards, TIER_PERIOD } from './rewards'
