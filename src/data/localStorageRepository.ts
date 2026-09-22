import type { Database } from './types'
import { Repository, type StorageAdapter } from './repository'

export const STORAGE_KEY = 'luper-ledger:db'

/** Whole-database snapshot in `window.localStorage`. Phase 1 persistence. */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: Storage
  private readonly key: string

  constructor(storage: Storage, key: string = STORAGE_KEY) {
    this.storage = storage
    this.key = key
  }

  load(): Database | null {
    const raw = this.storage.getItem(this.key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Database
    } catch {
      // Corrupt snapshot: treat as empty so the app reseeds instead of crashing.
      this.storage.removeItem(this.key)
      return null
    }
  }

  save(db: Database): void {
    this.storage.setItem(this.key, JSON.stringify(db))
  }

  clear(): void {
    this.storage.removeItem(this.key)
  }
}

export function createLocalStorageRepository(storage: Storage = window.localStorage): Repository {
  return new Repository(new LocalStorageAdapter(storage))
}
