import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Hourglass, Lock, Moon, PartyPopper, Rocket } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import type { KidEarnAct } from '@/data/types'
import { ClaimError } from '@/data/repository'
import { formatDenver } from '@/lib/time/denver'
import { useSounds } from '@/lib/useSounds'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function ClaimableRow({
  act,
  pending,
  open,
  onClaim,
}: {
  act: KidEarnAct
  pending: boolean
  open: boolean
  onClaim(): void
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <span className="font-semibold">{act.title}</span>
        {act.rare && (
          <Badge variant="accent" className="gap-1">
            <Sparkle />
            rare
          </Badge>
        )}
      </span>
      {pending ? (
        <span
          role="status"
          className="inline-flex animate-pop items-center gap-1.5 self-start rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-bold text-foreground sm:self-auto"
        >
          <Hourglass className="size-3.5 text-accent" aria-hidden />
          Waiting for Ground Control
        </span>
      ) : open ? (
        <Button size="sm" variant="star" onClick={onClaim} className="self-start sm:self-auto">
          <Check className="size-4" aria-hidden />I did it
        </Button>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          Closed
        </span>
      )}
    </li>
  )
}

function Sparkle() {
  return <span aria-hidden>✦</span>
}

function ParentStampRow({ act }: { act: KidEarnAct }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <span className="font-medium">{act.title}</span>
        {act.rare && <Badge variant="outline">rare</Badge>}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Parent adds this
      </span>
    </li>
  )
}

/**
 * KID-FACING. Names only: no point values, no totals. Path A rows create a
 * pending claim for the parent Inbox; Path B rows are read-only.
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

  function claim(act: KidEarnAct) {
    try {
      repo.claimForKid({ userId, actId: act.id })
      play('tap')
      setError(null)
    } catch (err) {
      setError(err instanceof ClaimError ? err.message : 'Could not send that. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Earn</h1>
        <p className="text-sm text-muted-foreground">
          Did one of these? Tap “I did it” and a parent will check it. Everything you earn goes into the family vault.
        </p>
      </div>

      {earn.open ? (
        <p className="text-xs text-muted-foreground">{earn.message}</p>
      ) : (
        <div
          role="status"
          data-testid="earn-closed"
          className={cn(
            'glass flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
            earn.reason === 'sunday' ? 'border-accent/40' : 'border-primary/30',
          )}
        >
          <div className="flex items-start gap-3">
            {earn.reason === 'sunday' ? (
              <PartyPopper className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            ) : (
              <Moon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            )}
            <div className="text-sm">
              <p className="font-bold">
                {earn.reason === 'sunday'
                  ? 'Reward day — no claims today'
                  : earn.reason === 'before-go-live'
                    ? 'Not open yet'
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
        <p role="status" className="text-sm text-muted-foreground">
          {pendingSet.size} waiting for Ground Control.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Card className="border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Rocket className="size-5 text-star" aria-hidden />
            You can claim these
          </CardTitle>
          <CardDescription>Tap once. It shows as waiting until a parent approves it.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {claimable.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted-foreground">Nothing to claim right now.</p>
          ) : (
            <ul className="divide-y divide-ivory/10 border-t border-ivory/10">
              {claimable.map((act) => (
                <ClaimableRow
                  key={act.id}
                  act={act}
                  pending={pendingSet.has(act.id)}
                  open={earn.open}
                  onClaim={() => claim(act)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="opacity-90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
            <Lock className="size-5" aria-hidden />
            Parents add these
          </CardTitle>
          <CardDescription>Big ones a parent notices and stamps for you. Nothing to tap here.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-ivory/10 border-t border-ivory/10">
            {parentStamps.map((act) => (
              <ParentStampRow key={act.id} act={act} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
