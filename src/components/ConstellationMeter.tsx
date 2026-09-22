import type { Tier } from '@/data/types'
import { cn } from '@/lib/utils'

type Point = readonly [number, number]

/** One constellation per vault. More stars for longer periods. */
const SHAPES: Record<Tier, readonly Point[]> = {
  T1: [
    [22, 90],
    [54, 74],
    [86, 82],
    [112, 58],
    [148, 66],
    [174, 34],
  ],
  T2: [
    [16, 64],
    [40, 38],
    [70, 52],
    [96, 26],
    [124, 46],
    [152, 30],
    [178, 60],
    [144, 92],
  ],
  T3: [
    [14, 94],
    [34, 64],
    [60, 80],
    [80, 48],
    [104, 66],
    [122, 32],
    [146, 54],
    [170, 24],
    [184, 68],
    [156, 98],
  ],
}

const TIER_COLOR: Record<Tier, string> = { T1: '#7fd8b4', T2: '#6fa0ff', T3: '#c48af5' }

function sparklePath(x: number, y: number, r: number): string {
  const k = r * 0.28
  return `M ${x} ${y - r} L ${x + k} ${y - k} L ${x + r} ${y} L ${x + k} ${y + k} L ${x} ${y + r} L ${x - k} ${y + k} L ${x - r} ${y} L ${x - k} ${y - k} Z`
}

/**
 * Family meter drawn as a constellation. Stars light in order as the
 * family-wide percent grows; lines draw between lit stars. Same numbers as
 * the old bar/ring, just told as a sky.
 */
export function ConstellationMeter({
  tier,
  percent,
  label,
  valueNow,
  valueMax,
  className,
}: {
  tier: Tier
  percent: number
  label: string
  valueNow: number
  valueMax: number
  className?: string
}) {
  const points = SHAPES[tier]
  const color = TIER_COLOR[tier]
  const clamped = Math.max(0, Math.min(100, percent))
  const lit = (clamped / 100) * points.length
  const full = clamped >= 100
  const frontier = Math.min(points.length - 1, Math.floor(lit))
  const gradientId = `glow-${tier}`

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-label={label}
      className={cn('relative w-full', className)}
    >
      <svg viewBox="0 0 200 120" className={cn('w-full overflow-visible', full && 'drop-shadow-[0_0_14px_rgb(240_205_114_/_0.6)]')} aria-hidden>
        <defs>
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {points.slice(0, -1).map(([x1, y1], i) => {
          const [x2, y2] = points[i + 1]!
          const progress = Math.max(0, Math.min(1, lit - (i + 1)))
          return (
            <g key={`line-${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(243 239 228 / 0.1)" strokeWidth={1} strokeDasharray="2 4" />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - progress}
                className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
              />
            </g>
          )
        })}

        {points.map(([x, y], i) => {
          const brightness = Math.max(0, Math.min(1, lit - i))
          const on = brightness > 0.02
          const isFrontier = !full && i === frontier
          return (
            <g key={`star-${i}`}>
              {on && <circle cx={x} cy={y} r={12} fill={`url(#${gradientId})`} opacity={0.35 + brightness * 0.5} />}
              <circle
                cx={x}
                cy={y}
                r={on ? 2.6 + brightness * 1.6 : 2.2}
                fill={on ? '#fff7de' : 'transparent'}
                stroke={on ? color : 'rgb(243 239 228 / 0.35)'}
                strokeWidth={on ? 1 : 1.2}
                opacity={on ? 0.5 + brightness * 0.5 : 1}
                className="transition-all duration-700 motion-reduce:transition-none"
              />
              {brightness >= 1 && <path d={sparklePath(x, y, 7)} fill="#fff7de" opacity={0.85} />}
              {isFrontier && (
                <circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill="none"
                  stroke="#f0cd72"
                  strokeWidth={1.2}
                  className="origin-center animate-pulse-star [transform-box:fill-box]"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
