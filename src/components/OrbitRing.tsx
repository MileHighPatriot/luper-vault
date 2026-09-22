import type { Tier } from '@/data/types'
import { cn } from '@/lib/utils'

const TIER_STROKE: Record<Tier, string> = { T1: 'stroke-tier-1', T2: 'stroke-tier-2', T3: 'stroke-tier-3' }
const TIER_GLOW: Record<Tier, string> = {
  T1: 'drop-shadow-[0_0_10px_rgb(127_216_180_/_0.55)]',
  T2: 'drop-shadow-[0_0_10px_rgb(91_141_239_/_0.55)]',
  T3: 'drop-shadow-[0_0_10px_rgb(196_138_245_/_0.55)]',
}

const SIZE = 132
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Family meter drawn as an orbit. Percent only: the same family-wide number
 * the old progress bar showed. Fill eases in; reduced-motion users see it snap.
 */
export function OrbitRing({
  tier,
  percent,
  label,
  valueNow,
  valueMax,
  children,
}: {
  tier: Tier
  percent: number
  label: string
  valueNow: number
  valueMax: number
  children?: React.ReactNode
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-label={label}
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={2} className="stroke-ivory/10" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none',
            TIER_STROKE[tier],
            TIER_GLOW[tier],
          )}
        />
        {clamped > 0 && clamped < 100 && (
          <circle
            cx={SIZE / 2 + RADIUS * Math.cos((clamped / 100) * 2 * Math.PI)}
            cy={SIZE / 2 + RADIUS * Math.sin((clamped / 100) * 2 * Math.PI)}
            r={3.5}
            className="fill-ivory"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
