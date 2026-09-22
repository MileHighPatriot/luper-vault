import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
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
  const swelled = useRef(false)

  // Swell once per flare. Browsers may block audio before any gesture; that is fine.
  useEffect(() => {
    if (pending.length > 0 && !swelled.current) {
      swelled.current = true
      play('surprise')
    }
    if (pending.length === 0) swelled.current = false
  }, [pending.length, play])

  if (pending.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sky-1/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="surprise-flare-title"
        data-testid="surprise-flare"
        className="glass w-full max-w-md animate-flare-in rounded-3xl border border-accent/50 p-6 shadow-[0_0_60px_-20px] shadow-accent/60"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 animate-star-tick items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_24px_-6px] shadow-accent">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <div>
            <h2 id="surprise-flare-title" className="text-xl font-extrabold">
              Extra treat for crushing it
            </h2>
            <p className="text-sm text-muted-foreground">
              A parent sent this just for you. It is outside the family vault.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {pending.map((surprise) => (
            <li
              key={surprise.id}
              className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,rgb(232_197_107_/_0.18),rgb(21_27_47_/_0.6))] px-4 py-3"
              data-testid="surprise-flare-item"
            >
              <p className="text-lg font-bold">
                {surprise.emoji ? <span className="mr-2">{surprise.emoji}</span> : null}
                {surprise.title}
              </p>
              {surprise.note ? <p className="mt-1 text-sm text-muted-foreground">{surprise.note}</p> : null}
            </li>
          ))}
        </ul>
        <Button
          className="mt-5 w-full"
          size="lg"
          variant="star"
          autoFocus
          onClick={() => {
            play('tap')
            repo.markSurprisesSeen(userId, pending.map((s) => s.id))
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  )
}
