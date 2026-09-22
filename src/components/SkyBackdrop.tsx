import { useEffect, useMemo } from 'react'
import { burst } from '@/lib/fx'

interface BackdropStar {
  left: number
  top: number
  size: number
  twinkle: number
  delay: number
}

/** Deterministic PRNG so the sky is the same on every render. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role="dialog"], [role="tab"], [role="switch"]'

/**
 * Kid surface backdrop: drifting nebula, twinkling stars, an occasional
 * shooting star, and a small sparkle wherever a kid taps empty sky.
 */
export function SkyBackdrop({ interactive = true }: { interactive?: boolean }) {
  const stars = useMemo<BackdropStar[]>(() => {
    const rand = mulberry32(20260928)
    return Array.from({ length: 70 }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      size: 1 + rand() * 2.2,
      twinkle: 2.5 + rand() * 5,
      delay: rand() * -6,
    }))
  }, [])

  useEffect(() => {
    if (!interactive) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null
      if (target?.closest(INTERACTIVE)) return
      burst(event.clientX, event.clientY, { count: 8, distance: 46, size: 7, duration: 650 })
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [interactive])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="sky-nebula left-[-10%] top-[-8%] h-[55vh] w-[55vw] bg-nebula" />
      <div className="sky-nebula bottom-[-15%] right-[-10%] h-[60vh] w-[50vw] bg-tier-2 [animation-delay:-9s]" />
      <div className="sky-nebula left-[35%] top-[40%] h-[35vh] w-[30vw] bg-tier-3 opacity-20 [animation-delay:-15s]" />
      {stars.map((s, i) => (
        <span
          key={i}
          className="sky-star"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              '--tw': `${s.twinkle}s`,
              '--delay': `${s.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="shooting-star" />
      <span className="shooting-star top-[38%] [animation-delay:-7s] [animation-duration:19s]" />
    </div>
  )
}
