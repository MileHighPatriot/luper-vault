import { crewStyle } from '@/lib/crew'
import { cn } from '@/lib/utils'

/** A small planet in the person's crew color with a tilted ring. Decorative. */
export function PlanetAvatar({
  userId,
  name,
  size = 44,
  className,
  spinRing = false,
}: {
  userId: string
  name: string
  size?: number
  className?: string
  spinRing?: boolean
}) {
  const { color } = crewStyle(userId)
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }} aria-hidden>
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.85) 0%, ${color} 34%, color-mix(in oklab, ${color} 45%, #0b1020) 100%)`,
          boxShadow: `0 0 ${Math.round(size / 2)}px -${Math.round(size / 8)}px ${color}`,
        }}
      />
      <span
        className={cn(
          'absolute left-1/2 top-1/2 rounded-[50%] border-2 transition-transform duration-700',
          spinRing ? 'group-hover:rotate-[160deg]' : '',
        )}
        style={{
          width: size * 1.55,
          height: size * 0.5,
          borderColor: `color-mix(in oklab, ${color} 60%, #fff7de)`,
          transform: 'translate(-50%, -50%) rotate(-18deg)',
          opacity: 0.75,
        }}
      />
      <span className="relative font-extrabold text-sky-1" style={{ fontSize: Math.round(size * 0.42) }}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    </span>
  )
}
