import type { Role } from '@/data/types'

export const SESSION_KEY = 'luper-ledger:session'

export interface Session {
  userId: string
  role: Role
  startedAt: string
}

// The admin PIN lives in repository settings (Phase 8). VITE_ADMIN_PIN only
// seeds the first launch; see `src/lib/pin.ts` for the TODO(prod-auth) note.

export function loadSession(storage: Storage): Session | null {
  const raw = storage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Session>
    if (typeof parsed.userId === 'string' && typeof parsed.role === 'string') {
      return parsed as Session
    }
  } catch {
    // fall through to clear
  }
  storage.removeItem(SESSION_KEY)
  return null
}

export function saveSession(storage: Storage, session: Session): void {
  storage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(storage: Storage): void {
  storage.removeItem(SESSION_KEY)
}
