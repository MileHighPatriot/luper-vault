import type { Database } from '@/data/types'
import { initialMeters } from '@/engine/meters'
import { SEED_ACTS } from './acts'
import { SEED_USERS } from './users'

export const SCHEMA_VERSION = 1

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
    settings: {
      schemaVersion: SCHEMA_VERSION,
      verse: PLACEHOLDER_VERSE,
      seededAt: now.toISOString(),
    },
  }
}

export { SEED_ACTS, EXPECTED_ACT_COUNTS, countActsByBand } from './acts'
export { SEED_USERS, ADMIN_USER_ID } from './users'
