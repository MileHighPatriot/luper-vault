import { useEffect, useMemo, useState } from 'react'
import { useRepositoryValue } from './RepositoryContext'
import { earnWindow, type EarnWindow } from '@/lib/time/calendar'

export interface HouseholdClock {
  /** Current instant per the household clock (honors the dev clock override). */
  now: Date
  window: EarnWindow
  isOverridden: boolean
  forceLive: boolean
}

/**
 * Shared "now" for gates and countdowns. Re-renders once a minute, and
 * immediately when the clock override or FORCE_LIVE setting changes. Mirrors
 * `Repository.now()` / `getEarnWindow()` so UI and writes agree.
 */
export function useHouseholdClock(intervalMs = 60_000): HouseholdClock {
  const override = useRepositoryValue((r) => r.getSettings().clockOverride)
  const forceLive = useRepositoryValue((r) => r.isForceLive())
  const [realNowMs, setRealNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setRealNowMs(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  const now = useMemo(() => {
    if (override) {
      const parsed = new Date(override)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date(realNowMs)
  }, [override, realNowMs])

  const earn = useMemo(() => earnWindow(now, { forceLive }), [now, forceLive])

  return { now, window: earn, isOverridden: Boolean(override), forceLive }
}
