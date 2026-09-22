import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCheck, Inbox, Pencil, X } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { useHouseholdClock } from '@/data/useHouseholdClock'
import type { PendingClaim } from '@/data/types'
import { ClaimError } from '@/data/repository'
import { denverDateKey, formatDenver } from '@/lib/time/denver'
import { burstFrom } from '@/lib/fx'
import { useSounds } from '@/lib/useSounds'
import { MeterStrip } from '@/components/MeterStrip'
import { PlanetAvatar } from '@/components/PlanetAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function signed(points: number): string {
  return points > 0 ? `+${points}` : String(points)
}

interface RowProps {
  claim: PendingClaim
  kidName: string
  actTitle: string
  onError(message: string): void
}

function ClaimRow({ claim, kidName, actTitle, onError }: RowProps) {
  const repo = useRepository()
  const play = useSounds()
  const [editing, setEditing] = useState(false)
  const [points, setPoints] = useState(String(claim.requestedPoints))
  const [note, setNote] = useState('')

  function run(action: () => void, sound?: 'approve' | 'tap') {
    try {
      action()
      if (sound) play(sound)
    } catch (err) {
      onError(err instanceof ClaimError ? err.message : 'Something went wrong. Try again.')
    }
  }

  function approveEdited(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(points)
    if (!Number.isInteger(parsed)) {
      onError('Points must be a whole number.')
      return
    }
    run(() => repo.approveClaim(claim.id, { points: parsed, note: note.trim() || undefined }), 'approve')
  }

  const edited = Number(points) !== claim.requestedPoints && Number.isInteger(Number(points))

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <PlanetAvatar userId={claim.userId} name={kidName} size={32} />
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{kidName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate">{actTitle}</span>
            <Badge variant="accent" className="tabular-nums">
              {signed(claim.requestedPoints)} pts
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{formatDenver(new Date(claim.createdAt))}</div>
          </div>
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="approve"
              onClick={(e) => {
                burstFrom(e.currentTarget, { count: 10, distance: 60, colors: ['#7fd8b4', '#f0cd72', '#fff7de'] })
                run(() => repo.approveClaim(claim.id), 'approve')
              }}
            >
              <Check className="size-4" aria-hidden />
              Approve
            </Button>
            <Button size="sm" variant="deny" onClick={() => run(() => repo.denyClaim(claim.id), 'tap')}>
              <X className="size-4" aria-hidden />
              Deny
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <form onSubmit={approveEdited} className="flex flex-col gap-3 rounded-xl bg-sky-1/50 p-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor={`points-${claim.id}`} className="text-xs font-medium text-muted-foreground">
              Points
            </label>
            <Input
              id={`points-${claim.id}`}
              type="number"
              step={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-24"
              autoFocus
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={`note-${claim.id}`} className="text-xs font-medium text-muted-foreground">
              Note (optional)
            </label>
            <Input
              id={`note-${claim.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why the change, or a word for the kid"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="approve">
              <Check className="size-4" aria-hidden />
              Approve {edited ? `at ${signed(Number(points))}` : ''}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="deny"
              onClick={() => run(() => repo.denyClaim(claim.id, note.trim() || undefined), 'tap')}
            >
              <X className="size-4" aria-hidden />
              Deny
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

export function InboxPage() {
  const repo = useRepository()
  const claims = useRepositoryValue((r) => r.listPendingClaims())
  const users = useRepositoryValue((r) => r.listUsers())
  const acts = useRepositoryValue((r) => r.listActs())
  const [error, setError] = useState<string | null>(null)
  const play = useSounds()

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const titleOf = (id: string) => acts.find((a) => a.id === id)?.title ?? id
  const today = denverDateKey(useHouseholdClock().now)
  const todayCount = claims.filter((c) => denverDateKey(new Date(c.createdAt)) === today).length

  function approveAllToday() {
    try {
      repo.approveAllPendingOn(today)
      play('approve')
      setError(null)
    } catch (err) {
      setError(err instanceof ClaimError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Path A claims waiting on a parent. Approve writes the family ledger and moves the meters; Deny does neither.
          </p>
        </div>
        {todayCount > 0 && (
          <Button variant="approve" onClick={approveAllToday}>
            <CheckCheck className="size-4" aria-hidden />
            Approve all today ({todayCount})
          </Button>
        )}
      </div>

      <MeterStrip testIdPrefix="inbox-meter" />

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-sky-1 text-star ring-1 ring-accent/40">
              <Inbox className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-bold">All clear</p>
              <p className="text-sm text-muted-foreground">
                No claims waiting. Kids send them from their Earn screen, or queue test ones from{' '}
                <Link to="/admin/dev" className="underline underline-offset-4">
                  Dev tools
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-ivory/10">
            {claims.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                kidName={nameOf(claim.userId)}
                actTitle={titleOf(claim.actId)}
                onError={setError}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
