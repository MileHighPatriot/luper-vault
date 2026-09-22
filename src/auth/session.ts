import type { Role } from '@/data/types'

export const SESSION_KEY = 'luper-ledger:session'

export interface Session {
  userId: string
  role: Role
  startedAt: string
}

// TODO(prod-auth): Phase 1 only. The PIN is a build-time constant so the
// family can start using the app; real hashing / server-side auth is a later
// (non-Phase 1) ticket. Override locally with VITE_ADMIN_PIN in .env.local.
export const ADMIN_PIN: string = import.meta.env.VITE_ADMIN_PIN ?? '1234'

export function verifyAdminPin(pin: string): boolean {
  return pin.trim() === ADMIN_PIN
}

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
