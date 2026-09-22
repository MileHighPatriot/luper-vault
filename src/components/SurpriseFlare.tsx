import { PartyPopper } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { Button } from '@/components/ui/button'

/**
 * KID-FACING. Pending surprises for this kid, shown on Home until dismissed.
 * Dismiss marks them seen. Leaving the page without dismissing keeps them pending.
 */
export function SurpriseFlare({ userId }: { userId: string }) {
  const repo = useRepository()
  const pending = useRepositoryValue((r) => r.listPendingSurprisesForKid(userId))

  if (pending.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="surprise-flare-title"
        data-testid="surprise-flare"
        className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <PartyPopper className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="surprise-flare-title" className="text-lg font-semibold">
              Extra treat for crushing it
            </h2>
            <p className="text-sm text-muted-foreground">
              A parent sent this just for you. It is outside the family vault.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {pending.map((surprise) => (
            <li key={surprise.id} className="rounded-xl border bg-secondary/40 px-4 py-3" data-testid="surprise-flare-item">
              <p className="text-base font-semibold">
                {surprise.emoji ? <span className="mr-2">{surprise.emoji}</span> : null}
                {surprise.title}
              </p>
              {surprise.note ? <p className="mt-1 text-sm text-muted-foreground">{surprise.note}</p> : null}
            </li>
          ))}
        </ul>
        <Button
          className="mt-4 w-full"
          autoFocus
          onClick={() => repo.markSurprisesSeen(userId, pending.map((s) => s.id))}
        >
          Got it
        </Button>
      </div>
    </div>
  )
}
