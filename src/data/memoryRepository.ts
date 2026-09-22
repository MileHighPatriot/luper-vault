import type { Database } from './types'
import { Repository, type StorageAdapter } from './repository'

/** In-memory snapshot. Used by tests and anywhere without `localStorage`. */
export class MemoryAdapter implements StorageAdapter {
  private snapshot: Database | null = null

  load(): Database | null {
    return this.snapshot ? structuredClone(this.snapshot) : null
  }

  save(db: Database): void {
    this.snapshot = structuredClone(db)
  }

  clear(): void {
    this.snapshot = null
  }
}

export function createMemoryRepository(): Repository {
  return new Repository(new MemoryAdapter())
}
