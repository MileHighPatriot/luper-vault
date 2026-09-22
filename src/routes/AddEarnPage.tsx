import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CircleMinus, CirclePlus, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import type { EarnAct, LedgerEntry, User } from '@/data/types'
import { AddEarnError } from '@/data/repository'
import { splitPoints, tenthsToPoints } from '@/engine/meters'
import { MeterStrip } from '@/components/MeterStrip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function signed(points: number): string {
  return points > 0 ? `+${points}` : String(points)
}

function earnerLabel(user: User): string {
  if (user.role === 'admin') return 'Parent'
  return user.name
}

function earnerHint(user: User): string {
  if (user.role === 'admin') return 'Admin as parent'
  return user.band === 'teen' ? 'Teen' : 'Little'
}

interface Confirmation {
  entry: LedgerEntry
  earnerName: string
  actTitle: string
}

function ActOption({
  act,
  selected,
  onSelect,
}: {
  act: EarnAct
  selected: boolean
  onSelect(): void
}) {
  const demerit = act.points < 0
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-secondary' : 'bg-card hover:bg-secondary/60',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{act.title}</span>
        {act.rare && (
          <Badge variant="outline" className="shrink-0">
            rare
          </Badge>
        )}
      </span>
      <span className={cn('shrink-0 font-semibold tabular-nums', demerit ? 'text-destructive' : 'text-primary')}>
        {signed(act.points)}
      </span>
    </button>
  )
}

/**
 * ADMIN ONLY. Stamp Path B earns and demerits straight into the ledger.
 * Path A acts are deliberately absent: kids claim those and parents approve
 * them in the Inbox.
 */
export function AddEarnPage() {
  const repo = useRepository()
  const users = useRepositoryValue((r) => r.listUsers())
  const [earnerId, setEarnerId] = useState(users[0]?.id ?? '')
  const earner = users.find((u) => u.id === earnerId) ?? users[0]
  const acts = useRepositoryValue((r) => (earner ? r.adminListPathBActsFor(earner.id) : []))
  const [actId, setActId] = useState<string | null>(null)
  const selectedAct = acts.find((a) => a.id === actId) ?? null
  const [note, setNote] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const earns = useMemo(() => acts.filter((a) => a.points > 0), [acts])
  const demerits = useMemo(() => acts.filter((a) => a.points < 0), [acts])

  function pickEarner(id: string) {
    setEarnerId(id)
    setActId(null)
    setError(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!earner || !selectedAct) return
    try {
      const entry = repo.adminAddEarn({ earnerId: earner.id, actId: selectedAct.id, note })
      setConfirmation({ entry, earnerName: earnerLabel(earner), actTitle: selectedAct.title })
      setActId(null)
      setNote('')
      setError(null)
    } catch (err) {
      setError(err instanceof AddEarnError ? err.message : 'Could not add that earn. Try again.')
    }
  }

  const split = confirmation ? splitPoints(confirmation.entry.points) : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add earn</h1>
        <p className="text-sm text-muted-foreground">
          Parent-stamped Path B earns and demerits go straight into the family ledger. Path A acts are claimed by kids
          and handled in the Inbox.
        </p>
      </div>

      <MeterStrip testIdPrefix="add-earn-meter" />

      {confirmation && split && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">
                Vault updated: {signed(confirmation.entry.points)} pts for {confirmation.earnerName}
              </p>
              <p className="text-muted-foreground">
                {confirmation.actTitle} → T1 {signed(tenthsToPoints(split.T1))}, T2 {signed(tenthsToPoints(split.T2))},
                T3 {signed(tenthsToPoints(split.T3))}
                {confirmation.entry.note ? ` · “${confirmation.entry.note}”` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/ledger">View ledger</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmation(null)} aria-label="Dismiss">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Who earned it?</CardTitle>
            <CardDescription>Kids get their band's Path B acts plus conduct. Parent gets the parent list.</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" aria-label="Earner" className="grid gap-2 sm:grid-cols-4">
              {users.map((u) => {
                const selected = u.id === earner?.id
                const Icon = u.role === 'admin' ? ShieldCheck : u.band === 'teen' ? Sparkles : UserRound
                return (
                  <button
                    key={u.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => pickEarner(u.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary bg-secondary' : 'bg-card hover:bg-secondary/60',
                    )}
                  >
                    <Icon className="size-4 text-primary" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold">{earnerLabel(u)}</span>
                      <span className="block text-xs text-muted-foreground">{earnerHint(u)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CirclePlus className="size-5 text-primary" aria-hidden />
                Earns
              </CardTitle>
              <CardDescription>Path B stamps for {earner ? earnerLabel(earner) : '—'}.</CardDescription>
            </CardHeader>
            <CardContent>
              {earns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Path B earns for this earner.</p>
              ) : (
                <div role="radiogroup" aria-label="Earn acts" className="flex flex-col gap-2">
                  {earns.map((act) => (
                    <ActOption key={act.id} act={act} selected={act.id === actId} onSelect={() => setActId(act.id)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleMinus className="size-5 text-destructive" aria-hidden />
                Demerits
              </CardTitle>
              <CardDescription>Negative points drain the meters through the same engine.</CardDescription>
            </CardHeader>
            <CardContent>
              {demerits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No demerits for this earner.</p>
              ) : (
                <div role="radiogroup" aria-label="Demerit acts" className="flex flex-col gap-2">
                  {demerits.map((act) => (
                    <ActOption key={act.id} act={act} selected={act.id === actId} onSelect={() => setActId(act.id)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="add-earn-note" className="text-xs font-medium text-muted-foreground">
                Note (optional)
              </label>
              <Input
                id="add-earn-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened, or a word for the ledger"
              />
            </div>
            <Button
              type="submit"
              disabled={!selectedAct}
              variant={selectedAct && selectedAct.points < 0 ? 'destructive' : 'default'}
              className="sm:min-w-56"
            >
              {selectedAct
                ? selectedAct.points < 0
                  ? `Apply ${signed(selectedAct.points)} demerit`
                  : `Add ${signed(selectedAct.points)} to vault`
                : 'Pick an act'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
