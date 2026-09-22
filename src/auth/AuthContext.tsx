import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@/data/types'
import { useRepository } from '@/data/RepositoryContext'
import { clearSession, loadSession, saveSession, verifyAdminPin, type Session } from './session'

export type LoginResult = { ok: true } | { ok: false; reason: 'unknown-user' | 'bad-pin' }

interface AuthValue {
  session: Session | null
  user: User | null
  isAdmin: boolean
  login(userId: string, pin?: string): LoginResult
  logout(): void
}

const AuthContext = createContext<AuthValue | null>(null)

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const repo = useRepository()
  const storage = getStorage()
  const [session, setSession] = useState<Session | null>(() => (storage ? loadSession(storage) : null))

  const login = useCallback(
    (userId: string, pin?: string): LoginResult => {
      const target = repo.getUser(userId)
      if (!target) return { ok: false, reason: 'unknown-user' }
      if (target.role === 'admin' && !verifyAdminPin(pin ?? '')) {
        return { ok: false, reason: 'bad-pin' }
      }
      const next: Session = { userId: target.id, role: target.role, startedAt: new Date().toISOString() }
      if (storage) saveSession(storage, next)
      setSession(next)
      return { ok: true }
    },
    [repo, storage],
  )

  const logout = useCallback(() => {
    if (storage) clearSession(storage)
    setSession(null)
  }, [storage])

  const value = useMemo<AuthValue>(() => {
    const user = session ? (repo.getUser(session.userId) ?? null) : null
    return {
      session: user ? session : null,
      user,
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }
  }, [session, repo, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
