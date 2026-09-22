import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Lock, Moon, PartyPopper, Rocket, Satellite, Stamp } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import type { KidEarnAct } from '@/data/types'
import { ClaimError } from '@/data/repository'
import { burstFrom } from '@/lib/fx'
import { formatDenver } from '@/lib/time/denver'
import { useSounds } from '@/lib/useSounds'
import { cn } from '@/lib/utils'
import { ActIcon } from '@/components/ActIcon'
import { Button } from '@/components/ui/button'

const TILE_TINTS = ['text-tier-1', 'text-tier-2', 'text-tier-3', 'text-star'] as const

function ClaimTile({
  act,
  index,
  pending,
  open,
  onClaim,
}: {
  act: KidEarnAct
  index: number
  pending: boolean
  open: boolean
  onClaim(event: MouseEvent<HTMLButtonElement>): void
}) {
  return (
    <li
      className={cn(
        'glass flex min-h-[8.5rem] flex-col justify-between gap-3 rounded-3xl border p-4 transition-all duration-300',
        pending && 'border-dashed border-accent/60 bg-accent/5',
        !pending && open && 'hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-1 ring-1 ring-ivory/10',
            TILE_TINTS[index % TILE_TINTS.length],
          )}
        >
          <ActIcon actId={act.id} className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-snug">{act.title}</p>
          {act.rare && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">
              ✦ rare
            </span>
          )}
        </div>
      </div>
      {pending ? (
        <span
          role="status"
          className="inline-flex animate-pop items-center gap-2 self-start rounded-full border border-accent/60 bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent"
        >
          <Satellite className="size-4 animate-float" aria-hidden />
          Waiting for Ground Control
        </span>
      ) : open ? (
        <Button size="lg" variant="star" onClick={onClaim} className="h-11 w-full rounded-2xl">
          <Check className="size-5" aria-hidden />I did it
        </Button>
      ) : (
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-sky-1/70 px-3 py-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          Closed
        </span>
      )}
    </li>
  )
}

function ParentStampChip({ act }: { act: KidEarnAct }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-sky-1/50 px-3 py-1.5 text-sm text-muted-foreground">
      <ActIcon actId={act.id} className="size-4" />
      {act.title}
      {act.rare && <span className="text-[11px] font-bold text-accent">✦</span>}
    </li>
  )
}

/**
 * KID-FACING. Names only: no point values, no totals. Path A tiles create a
 * pending claim for the parent Inbox; Path B chips are read-only.
 */
export function KidEarnPage() {
  const { user } = useAuth()
  const repo = useRepository()
  const userId = user?.id ?? ''
  const acts = useRepositoryValue((r) => r.listEarnActsForKid(userId))
  const pendingActIds = useRepositoryValue((r) => r.listKidPendingClaims(userId).map((c) => c.actId))
  const [error, setError] = useState<string | null>(null)
  const { window: earn } = useHouseholdClock()
  const play = useSounds()

  const claimable = acts.filter((a) => a.path === 'A')
  const parentStamps = acts.filter((a) => a.path === 'B')
  const pendingSet = new Set(pendingActIds)

  function claim(act: KidEarnAct, event: MouseEvent<HTMLButtonElement>) {
    const origin = event.currentTarget
    try {
      repo.claimForKid({ userId, actId: act.id })
      burstFrom(origin, { count: 16, distance: 100 })
      play('tap')
      setError(null)
    } catch (err) {
      setError(err instanceof ClaimError ? err.message : 'Could not send that. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-rise-in">
        <h1 className="text-starlight text-4xl font-extrabold tracking-tight">Earn stars</h1>
        <p className="text-sm text-muted-foreground">
          Did one of these? Tap “I did it” and Ground Control will check it. Every star goes into the family sky.
        </p>
      </div>

      {earn.open ? (
        <p className="inline-flex items-center gap-2 self-start rounded-full border border-approve/40 bg-approve/10 px-3 py-1.5 text-xs font-bold text-approve">
          <Rocket className="size-3.5" aria-hidden />
          {earn.message}
        </p>
      ) : (
        <div
          role="status"
          data-testid="earn-closed"
          className={cn(
            'glass flex flex-col gap-3 rounded-3xl border p-4 sm:flex-row sm:items-center sm:justify-between',
            earn.reason === 'sunday' ? 'border-accent/40' : 'border-primary/30',
          )}
        >
          <div className="flex items-start gap-3">
            {earn.reason === 'sunday' ? (
              <PartyPopper className="mt-0.5 size-6 shrink-0 animate-wiggle text-accent" aria-hidden />
            ) : (
              <Moon className="mt-0.5 size-6 shrink-0 animate-float text-primary" aria-hidden />
            )}
            <div className="text-sm">
              <p className="font-bold">
                {earn.reason === 'sunday'
                  ? 'Reward day — no claims today'
                  : earn.reason === 'before-go-live'
                    ? 'Launch pad not open yet'
                    : 'Claims are closed for tonight'}
              </p>
              <p className="text-muted-foreground">
                {earn.message}
                {earn.reopensAt ? ` Opens ${formatDenver(earn.reopensAt)}.` : ''}
              </p>
            </div>
          </div>
          {earn.reason === 'sunday' && (
            <div className="flex gap-2 sm:shrink-0">
              <Button asChild size="sm" variant="star">
                <Link to="/rewards">Rewards</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/wins">Wins</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {pendingSet.size > 0 && (
        <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
          <Satellite className="size-4" aria-hidden />
          {pendingSet.size} on the way to Ground Control
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <section aria-labelledby="claim-heading" className="space-y-3">
        <div>
          <h2 id="claim-heading" className="flex items-center gap-2 text-xl font-extrabold">
            <Rocket className="size-5 text-star" aria-hidden />
            You can claim these
          </h2>
          <p className="text-xs text-muted-foreground">Tap once. It waits until a parent approves it.</p>
        </div>
        {claimable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to claim right now.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {claimable.map((act, i) => (
              <ClaimTile
                key={act.id}
                act={act}
                index={i}
                pending={pendingSet.has(act.id)}
                open={earn.open}
                onClaim={(e) => claim(act, e)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="stamp-heading" className="glass space-y-3 rounded-3xl border p-4 opacity-90">
        <div>
          <h2 id="stamp-heading" className="flex items-center gap-2 text-base font-bold text-muted-foreground">
            <Stamp className="size-5" aria-hidden />
            Parent stamps
          </h2>
          <p className="text-xs text-muted-foreground">Big ones a parent notices and stamps for you. Nothing to tap here.</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {parentStamps.map((act) => (
            <ParentStampChip key={act.id} act={act} />
          ))}
        </ul>
      </section>
    </div>
  )
}
