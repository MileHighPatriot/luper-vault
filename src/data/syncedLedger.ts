import type { Database } from './types'
import { Repository, type RepositoryOptions, type StorageAdapter } from './repository'
import type { LedgerRemote } from './remoteLedger'
import { SCHEMA_VERSION } from './seed'

export type SyncStatus = 'synced' | 'saving' | 'offline'

/** A top-level repository call that wrote, kept until the server has it. */
interface PendingOp {
  name: string
  args: unknown[]
}

/** Tells the sync layer when the repository commits. Nothing is stored here. */
class NotifyingAdapter implements StorageAdapter {
  onSave: () => void = () => {}
  private initial: Database | null

  constructor(initial: Database | null) {
    this.initial = initial
  }

  load(): Database | null {
    return this.initial
  }

  save(): void {
    this.onSave()
  }

  clear(): void {}
}

export interface SyncedLedgerOptions extends RepositoryOptions {
  /** Snapshot to upload when the family server has none yet (this device's local data). */
  localSnapshot?: Database | null
  pollMs?: number
  retryMs?: number
}

/**
 * One `Repository` shared by every family device.
 *
 * The app talks to `repository` exactly as before. Each call that writes is
 * recorded and the new snapshot is pushed with compare-and-swap. If another
 * device wrote first, we adopt its snapshot and replay our recorded calls on
 * top, so a kid's claim and a parent's approval made at the same moment both
 * land. A replay that no longer applies (the claim was already approved on
 * another phone) throws and is dropped, which is the right outcome.
 */
export class SyncedLedger {
  readonly repository: Repository
  private readonly target: Repository
  private readonly remote: LedgerRemote
  private version: number
  private pending: PendingOp[] = []
  private dirty = false
  private replaying = false
  private pushing = false
  private status: SyncStatus = 'synced'
  private readonly statusListeners = new Set<() => void>()
  private readonly pollMs: number
  private readonly retryMs: number
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  static async connect(remote: LedgerRemote, options: SyncedLedgerOptions = {}): Promise<SyncedLedger> {
    const { version, snapshot } = await remote.pull(-1)
    const ledger = new SyncedLedger(remote, version, snapshot ?? options.localSnapshot ?? null, options)
    // First device in: upload whatever it has (or the fresh seed).
    if (!snapshot) ledger.markDirty()
    void ledger.flush()
    return ledger
  }

  private constructor(remote: LedgerRemote, version: number, initial: Database | null, options: SyncedLedgerOptions) {
    this.remote = remote
    this.version = version
    this.pollMs = options.pollMs ?? 3000
    this.retryMs = options.retryMs ?? 5000
    const adapter = new NotifyingAdapter(initial)
    // Seeding or migrating in the constructor saves, which marks us dirty.
    adapter.onSave = () => {
      if (!this.replaying) this.dirty = true
    }
    this.target = new Repository(adapter, options)
    this.repository = this.recordingProxy(this.target)
  }

  getStatus(): SyncStatus {
    return this.status
  }

  subscribeStatus(listener: () => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  /** Poll for other devices' writes while the page is visible. */
  start(): () => void {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.poll()
    }
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.poll()
    }, this.pollMs)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      if (this.pollTimer) clearInterval(this.pollTimer)
      if (this.retryTimer) clearTimeout(this.retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }

  /** Fetch newer writes from other devices. Exposed for tests. */
  async poll(): Promise<void> {
    if (this.pushing || this.dirty) return
    try {
      const { version, snapshot } = await this.remote.pull(this.version)
      // A local write during the fetch wins the race; its push will rebase.
      if (this.pushing || this.dirty) return
      if (version > this.version && snapshot) {
        this.adopt(version, snapshot)
      }
      this.setStatus('synced')
    } catch {
      this.setStatus('offline')
    }
  }

  /** Push local writes until the server has them. Exposed for tests. */
  async flush(): Promise<void> {
    if (this.pushing || !this.dirty) return
    this.pushing = true
    this.setStatus('saving')
    try {
      while (this.dirty) {
        this.dirty = false
        const sent = this.pending.length
        const result = await this.remote.push(this.version, this.target.exportSnapshot())
        if (result.ok) {
          this.version = result.version
          this.pending.splice(0, sent)
        } else {
          this.rebase(result.version, result.snapshot)
        }
      }
      this.setStatus('synced')
    } catch {
      this.dirty = true
      this.setStatus('offline')
      this.scheduleRetry()
    } finally {
      this.pushing = false
    }
  }

  private markDirty(): void {
    this.dirty = true
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.flush()
    }, this.retryMs)
  }

  private adopt(version: number, snapshot: Database): void {
    // A newer app version wrote this; reload to pick up the new code.
    if ((snapshot.settings?.schemaVersion ?? 0) > SCHEMA_VERSION && typeof window !== 'undefined') {
      window.location.reload()
      return
    }
    this.version = version
    this.target.adoptSnapshot(snapshot)
  }

  /** Someone else wrote first: take theirs, then replay ours on top. */
  private rebase(version: number, snapshot: Database | null): void {
    if (!snapshot) {
      // Nothing to adopt; just retry our snapshot against their version.
      this.version = version
      this.dirty = true
      return
    }
    this.replaying = true
    try {
      this.adopt(version, snapshot)
      const kept: PendingOp[] = []
      for (const op of this.pending) {
        const before = this.target.exportSnapshot()
        try {
          const method = (this.target as unknown as Record<string, (...a: unknown[]) => unknown>)[op.name]
          method.apply(this.target, op.args)
          if (this.target.exportSnapshot() !== before) kept.push(op)
        } catch {
          // No longer applies on the newer snapshot; the other device's write stands.
        }
      }
      this.pending = kept
      this.dirty = kept.length > 0
    } finally {
      this.replaying = false
    }
  }

  private recordingProxy(target: Repository): Repository {
    return new Proxy(target, {
      get: (obj, prop, receiver) => {
        const value = Reflect.get(obj, prop, receiver)
        if (typeof value !== 'function' || typeof prop !== 'string') return value
        return (...args: unknown[]) => {
          const before = obj.exportSnapshot()
          const result = value.apply(obj, args)
          if (!this.replaying && obj.exportSnapshot() !== before) {
            this.pending.push({ name: prop, args })
            this.dirty = true
            void this.flush()
          }
          return result
        }
      },
    })
  }

  private setStatus(next: SyncStatus): void {
    if (next === this.status) return
    this.status = next
    for (const listener of this.statusListeners) listener()
  }
}
