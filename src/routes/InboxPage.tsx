import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCheck, Inbox, Pencil, X } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import type { PendingClaim } from '@/data/types'
import { ClaimError } from '@/data/repository'
import { meterPercent, meterPoints } from '@/engine/meters'
import { denverDateKey, formatDenver } from '@/lib/time/denver'
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
  const [editing, setEditing] = useState(false)
  const [points, setPoints] = useState(String(claim.requestedPoints))
  const [note, setNote] = useState('')

  function run(action: () => void) {
    try {
      action()
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
    run(() => repo.approveClaim(claim.id, { points: parsed, note: note.trim() || undefined }))
  }

  const edited = Number(points) !== claim.requestedPoints && Number.isInteger(Number(points))

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{kidName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate">{actTitle}</span>
            <Badge variant="secondary" className="tabular-nums">
              {signed(claim.requestedPoints)} pts
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{formatDenver(new Date(claim.createdAt))}</div>
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run(() => repo.approveClaim(claim.id))}>
              <Check className="size-4" aria-hidden />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => run(() => repo.denyClaim(claim.id))}>
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
        <form onSubmit={approveEdited} className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3 sm:flex-row sm:items-end">
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
              className="w-24 bg-card"
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
              className="bg-card"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              <Check className="size-4" aria-hidden />
              Approve {edited ? `at ${signed(Number(points))}` : ''}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => run(() => repo.denyClaim(claim.id, note.trim() || undefined))}
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
  const meters = useRepositoryValue((r) => r.getMeters())
  const [error, setError] = useState<string | null>(null)

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const titleOf = (id: string) => acts.find((a) => a.id === id)?.title ?? id
  const today = denverDateKey()
  const todayCount = claims.filter((c) => denverDateKey(new Date(c.createdAt)) === today).length

  function approveAllToday() {
    try {
      repo.approveAllPendingOn(today)
      setError(null)
    } catch (err) {
      setError(err instanceof ClaimError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Path A claims waiting on a parent. Approve writes the family ledger and moves the meters; Deny does neither.
          </p>
        </div>
        {todayCount > 0 && (
          <Button variant="secondary" onClick={approveAllToday}>
            <CheckCheck className="size-4" aria-hidden />
            Approve all today ({todayCount})
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3" aria-label="Family meters">
        {meters.map((m) => (
          <div key={m.tier} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">{m.tier}</span>
            <span className="tabular-nums">
              <span className="font-semibold" data-testid={`inbox-meter-${m.tier}`}>
                {meterPoints(m)}
              </span>
              <span className="text-muted-foreground"> / {m.fill} · {meterPercent(m)}%</span>
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Inbox className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">All clear</p>
              <p className="text-sm text-muted-foreground">
                No claims waiting. Until the kid Earn button ships (Phase 4), queue some from{' '}
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
          <ul className="divide-y">
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
