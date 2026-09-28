import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { Repository } from './repository'
import { createLocalStorageRepository } from './localStorageRepository'
import { createMemoryRepository } from './memoryRepository'
import { supabaseConfigFromEnv } from './remoteLedger'
import type { SyncedLedger, SyncStatus } from './syncedLedger'
import { FamilyConnect } from '@/components/FamilyConnect'

const RepositoryContext = createContext<Repository | null>(null)
const SyncContext = createContext<SyncedLedger | null>(null)

/** VITE_FORCE_LIVE=true lets parents test claims before the 2026-09-28 go-live. */
const ENV_FORCE_LIVE = import.meta.env.VITE_FORCE_LIVE === 'true'

/** First-launch admin PIN. After that, Admin → Settings owns the PIN. */
const ENV_ADMIN_PIN: string | undefined = import.meta.env.VITE_ADMIN_PIN?.trim() || undefined

const REPOSITORY_OPTIONS = { envForceLive: ENV_FORCE_LIVE, defaultAdminPin: ENV_ADMIN_PIN }

function createDefaultRepository(): Repository {
  try {
    return createLocalStorageRepository(window.localStorage, REPOSITORY_OPTIONS)
  } catch {
    // Private mode / storage disabled: fall back so the app still runs.
    return createMemoryRepository(REPOSITORY_OPTIONS)
  }
}

/**
 * With VITE_SUPABASE_URL / VITE_SUPABASE_KEY set, every device shares one
 * family ledger on the server (after a one-time family code). Without them,
 * or when a `repository` is passed in (tests), data stays in this browser.
 */
export function RepositoryProvider({
  repository,
  children,
}: {
  repository?: Repository
  children: ReactNode
}) {
  const supabase = useMemo(() => (repository ? null : supabaseConfigFromEnv()), [repository])
  if (supabase) {
    return (
      <FamilyConnect config={supabase} options={REPOSITORY_OPTIONS}>
        {(ledger) => (
          <SyncContext.Provider value={ledger}>
            <RepositoryContext.Provider value={ledger.repository}>{children}</RepositoryContext.Provider>
          </SyncContext.Provider>
        )}
      </FamilyConnect>
    )
  }
  return <LocalRepositoryProvider repository={repository}>{children}</LocalRepositoryProvider>
}

function LocalRepositoryProvider({ repository, children }: { repository?: Repository; children: ReactNode }) {
  const value = useMemo(() => repository ?? createDefaultRepository(), [repository])
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>
}

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository must be used inside <RepositoryProvider>')
  return repo
}

const noSync = () => () => {}

/** Family sync status, or null when the app is running local-only. */
export function useSyncStatus(): SyncStatus | null {
  const ledger = useContext(SyncContext)
  return useSyncExternalStore(
    ledger ? (onChange) => ledger.subscribeStatus(onChange) : noSync,
    () => ledger?.getStatus() ?? null,
  )
}

/**
 * Read a derived value from the repository and re-render whenever it writes.
 * `select` should return a JSON-serialisable value; we compare by serialisation
 * so fresh array copies from the repository do not cause render loops.
 */
export function useRepositoryValue<T>(select: (repo: Repository) => T): T {
  const repo = useRepository()
  const snapshot = useSyncExternalStore(
    (onChange) => repo.subscribe(onChange),
    // `JSON.stringify(undefined)` is `undefined`, which `JSON.parse` rejects; map it to null.
    () => JSON.stringify(select(repo)) ?? 'null',
  )
  return useMemo(() => JSON.parse(snapshot) as T, [snapshot])
}
