import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { Repository } from './repository'
import { createLocalStorageRepository } from './localStorageRepository'
import { createMemoryRepository } from './memoryRepository'

const RepositoryContext = createContext<Repository | null>(null)

/** VITE_FORCE_LIVE=true lets parents test claims before the 2026-09-28 go-live. */
const ENV_FORCE_LIVE = import.meta.env.VITE_FORCE_LIVE === 'true'

/** First-launch admin PIN. After that, Admin → Settings owns the PIN. */
const ENV_ADMIN_PIN: string | undefined = import.meta.env.VITE_ADMIN_PIN?.trim() || undefined

function createDefaultRepository(): Repository {
  const options = { envForceLive: ENV_FORCE_LIVE, defaultAdminPin: ENV_ADMIN_PIN }
  try {
    return createLocalStorageRepository(window.localStorage, options)
  } catch {
    // Private mode / storage disabled: fall back so the app still runs.
    return createMemoryRepository(options)
  }
}

export function RepositoryProvider({
  repository,
  children,
}: {
  repository?: Repository
  children: ReactNode
}) {
  const value = useMemo(() => repository ?? createDefaultRepository(), [repository])
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>
}

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository must be used inside <RepositoryProvider>')
  return repo
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
