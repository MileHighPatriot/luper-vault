import { useState } from 'react'
import { Check, Hand, Hourglass, Lock } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import type { KidEarnAct } from '@/data/types'
import { ClaimError } from '@/data/repository'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ClaimableRow({
  act,
  pending,
  onClaim,
}: {
  act: KidEarnAct
  pending: boolean
  onClaim(): void
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <span className="font-medium">{act.title}</span>
        {act.rare && <Badge variant="outline">rare</Badge>}
      </span>
      {pending ? (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:self-auto"
        >
          <Hourglass className="size-3.5" aria-hidden />
          Waiting for Ground Control
        </span>
      ) : (
        <Button size="sm" onClick={onClaim} className="self-start sm:self-auto">
          <Check className="size-4" aria-hidden />I did it
        </Button>
      )}
    </li>
  )
}

function ParentStampRow({ act }: { act: KidEarnAct }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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

  const claimable = acts.filter((a) => a.path === 'A')
  const parentStamps = acts.filter((a) => a.path === 'B')
  const pendingSet = new Set(pendingActIds)

  function claim(act: KidEarnAct) {
    try {
      repo.queueClaim({ userId, actId: act.id })
      setError(null)
    } catch (err) {
      setError(err instanceof ClaimError ? err.message : 'Could not send that. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Earn</h1>
        <p className="text-sm text-muted-foreground">
          Did one of these? Tap “I did it” and a parent will check it. Everything you earn goes into the family vault.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hand className="size-5 text-primary" aria-hidden />
            You can claim these
          </CardTitle>
          <CardDescription>Tap once. It shows as waiting until a parent approves it.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {claimable.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted-foreground">Nothing to claim right now.</p>
          ) : (
            <ul className="divide-y border-t">
              {claimable.map((act) => (
                <ClaimableRow key={act.id} act={act} pending={pendingSet.has(act.id)} onClaim={() => claim(act)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5 text-muted-foreground" aria-hidden />
            Parents add these
          </CardTitle>
          <CardDescription>Big ones a parent notices and stamps for you. Nothing to tap here.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y border-t">
            {parentStamps.map((act) => (
              <ParentStampRow key={act.id} act={act} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
