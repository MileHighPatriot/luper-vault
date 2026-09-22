import type { Database } from '@/data/types'
import { initialMeters } from '@/engine/meters'
import { SEED_ACTS } from './acts'
import { buildSeedRewards } from './rewards'
import { SEED_USERS } from './users'

/**
 * v1 Phase 1 foundation · v2 Phase 2 claim status + ledger source ·
 * v3 Phase 5 rewards + wins tables.
 */
export const SCHEMA_VERSION = 3

/** Placeholder until the settings screen lands in a later phase. */
export const PLACEHOLDER_VERSE =
  'Whatever you do, work at it with all your heart. — Colossians 3:23 (placeholder)'

export function buildSeedDatabase(now: Date = new Date()): Database {
  return {
    users: [...SEED_USERS],
    earnActs: [...SEED_ACTS],
    ledger: [],
    pendingClaims: [],
    vaultMeters: initialMeters(),
    rewards: buildSeedRewards(now),
    wins: [],
    settings: {
      schemaVersion: SCHEMA_VERSION,
      verse: PLACEHOLDER_VERSE,
      seededAt: now.toISOString(),
    },
  }
}

/**
 * Bring an older snapshot up to the current schema, or return null when it is
 * too old to migrate (caller reseeds). Only additive steps live here.
 */
export function migrateDatabase(db: Database, now: Date = new Date()): Database | null {
  let version = db.settings?.schemaVersion
  if (typeof version !== 'number' || version < 2) return null
  let next = db
  if (version === 2) {
    next = { ...next, rewards: buildSeedRewards(now), wins: [] }
    version = 3
  }
  if (version !== SCHEMA_VERSION) return null
  return { ...next, settings: { ...next.settings, schemaVersion: SCHEMA_VERSION } }
}

export { SEED_ACTS, EXPECTED_ACT_COUNTS, countActsByBand } from './acts'
export { SEED_USERS, ADMIN_USER_ID } from './users'
export { buildSeedRewards, TIER_PERIOD } from './rewards'
