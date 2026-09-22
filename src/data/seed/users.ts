import type { User } from '@/data/types'

export const ADMIN_USER_ID = 'admin'

export const SEED_USERS: readonly User[] = [
  { id: 'kameron', name: 'Kameron', role: 'little', band: 'little' },
  { id: 'alea', name: 'Alea', role: 'little', band: 'little' },
  { id: 'christopher', name: 'Christopher', role: 'teen', band: 'teen' },
  { id: ADMIN_USER_ID, name: 'Admin', role: 'admin', band: null },
]
