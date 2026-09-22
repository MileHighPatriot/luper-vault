import { useEffect, useRef } from 'react'
import { Gift, Sparkles } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { burst, burstFrom } from '@/lib/fx'
import { useSounds } from '@/lib/useSounds'
import { Button } from '@/components/ui/button'

/**
 * KID-FACING. Pending surprises for this kid, shown on Home until dismissed.
 * Dismiss marks them seen. Leaving the page without dismissing keeps them pending.
 */
export function SurpriseFlare({ userId }: { userId: string }) {
  const repo = useRepository()
  const pending = useRepositoryValue((r) => r.listPendingSurprisesForKid(userId))
  const play = useSounds()
  const opened = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Swell + confetti once per flare. Browsers may hold audio before any gesture; that is fine.
  useEffect(() => {
    if (pending.length > 0 && !opened.current) {
      opened.current = true
      play('surprise')
      const timer = window.setTimeout(() => {
        const rect = dialogRef.current?.getBoundingClientRect()
        if (rect) burst(rect.left + rect.width / 2, rect.top + 28, { count: 28, distance: 180, size: 12, duration: 1200 })
      }, 260)
      return () => window.clearTimeout(timer)
    }
    if (pending.length === 0) opened.current = false
  }, [pending.length, play])

  if (pending.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sky-1/75 p-4 backdrop-blur-sm sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="surprise-flare-title"
        data-testid="surprise-flare"
        className="glass relative w-full max-w-md animate-flare-in overflow-hidden rounded-[2rem] border border-accent/60 p-6 shadow-[0_0_80px_-20px] shadow-accent/70"
      >
        <span
          className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span className="flex size-20 animate-float items-center justify-center rounded-3xl bg-accent text-accent-foreground shadow-[0_0_40px_-6px] shadow-accent">
            <Gift className="size-10 animate-star-tick" aria-hidden />
          </span>
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-accent">
            <Sparkles className="size-3.5" aria-hidden />
            Incoming transmission
          </p>
          <h2 id="surprise-flare-title" className="text-starlight text-2xl font-extrabold">
            Extra treat for crushing it
          </h2>
          <p className="text-sm text-muted-foreground">A parent sent this just for you. It is outside the family vault.</p>
        </div>
        <ul className="relative mt-5 space-y-3">
          {pending.map((surprise) => (
            <li
              key={surprise.id}
              className="animate-pop rounded-2xl border border-accent/40 bg-[linear-gradient(135deg,rgb(240_205_114_/_0.22),rgb(21_27_47_/_0.6))] px-4 py-4 text-center"
              data-testid="surprise-flare-item"
            >
              <p className="text-xl font-extrabold">
                {surprise.emoji ? <span className="mr-2 text-2xl">{surprise.emoji}</span> : null}
                {surprise.title}
              </p>
              {surprise.note ? <p className="mt-1 text-sm text-muted-foreground">{surprise.note}</p> : null}
            </li>
          ))}
        </ul>
        <Button
          className="relative mt-5 h-14 w-full rounded-2xl text-base"
          size="lg"
          variant="star"
          autoFocus
          onClick={(e) => {
            burstFrom(e.currentTarget, { count: 20, distance: 120 })
            play('approve')
            repo.markSurprisesSeen(userId, pending.map((s) => s.id))
          }}
        >
          Woohoo, got it!
        </Button>
      </div>
    </div>
  )
}
