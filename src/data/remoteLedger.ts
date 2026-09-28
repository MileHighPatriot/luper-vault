import type { Database } from './types'

/**
 * The shared family snapshot on the server. Every device reads and writes the
 * same one; writes are compare-and-swap on `version` (see supabase/ledger.sql).
 */
export interface LedgerRemote {
  /** Current version, plus the snapshot when it is newer than `since`. */
  pull(since: number): Promise<{ version: number; snapshot: Database | null }>
  /** Write if nobody else wrote since `expected`; otherwise get theirs back. */
  push(expected: number, snapshot: Database): Promise<PushResult>
}

export type PushResult = { ok: true; version: number } | { ok: false; version: number; snapshot: Database | null }

/** The family code did not match any family on the server. */
export class FamilyCodeError extends Error {
  constructor() {
    super('That family code is not recognised.')
    this.name = 'FamilyCodeError'
  }
}

export interface SupabaseConfig {
  url: string
  key: string
}

/** Build-time Supabase settings. Unset means the app runs local-only. */
export function supabaseConfigFromEnv(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_KEY?.trim()
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null
}

/** Talks to the two Postgres functions over PostgREST. No SDK needed. */
export function createSupabaseRemote(config: SupabaseConfig, familyCode: string): LedgerRemote {
  const code = familyCode.trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: config.key }
  // Legacy anon keys are JWTs and go in Authorization too; publishable keys do not.
  if (config.key.startsWith('eyJ')) headers.Authorization = `Bearer ${config.key}`

  async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      if (text.includes('unknown family code')) throw new FamilyCodeError()
      throw new Error(`Sync ${name} failed (${res.status}): ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }

  return {
    async pull(since) {
      const rows = await rpc<{ version: number; snapshot: Database | null }[]>('ledger_pull', {
        p_code: code,
        p_since: since,
      })
      const row = rows[0]
      if (!row) throw new FamilyCodeError()
      return { version: Number(row.version), snapshot: row.snapshot }
    },
    async push(expected, snapshot) {
      const rows = await rpc<{ ok: boolean; version: number; snapshot: Database | null }[]>('ledger_push', {
        p_code: code,
        p_expected: expected,
        p_snapshot: snapshot,
      })
      const row = rows[0]
      if (!row) throw new Error('Sync push returned nothing')
      return row.ok
        ? { ok: true, version: Number(row.version) }
        : { ok: false, version: Number(row.version), snapshot: row.snapshot }
    },
  }
}
