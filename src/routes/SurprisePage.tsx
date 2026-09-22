import { useState, type FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { SurpriseError } from '@/data/repository'
import type { SurpriseStatus } from '@/data/types'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

const EMOJI_CHOICES = ['🍬', '☕', '💵', '🍦', '🎬'] as const

const STATUS_LABEL: Record<SurpriseStatus, string> = {
  pending: 'Not seen yet',
  seen: 'Seen',
  canceled: 'Canceled',
}

/**
 * ADMIN ONLY. Send a mid-cycle treat to one kid. Caps are one per earn week
 * and three per calendar month. This screen never writes the ledger.
 */
export function SurprisePage() {
  const { user } = useAuth()
  const repo = useRepository()
  const kids = useRepositoryValue((r) => r.listUsers().filter((u) => u.role !== 'admin'))
  const surprises = useRepositoryValue((r) => r.adminListSurprises())
  const [kidId, setKidId] = useState(kids[0]?.id ?? 'kameron')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [emoji, setEmoji] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTitle, setSentTitle] = useState<string | null>(null)

  const allowance = useRepositoryValue((r) => r.adminSurpriseAllowance(kidId))
  const kid = kids.find((k) => k.id === kidId)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSentTitle(null)
    try {
      const drop = repo.adminSendSurprise({
        kidId,
        title,
        note,
        emoji,
        createdBy: user?.id ?? 'admin',
      })
      setSentTitle(drop.title)
      setTitle('')
      setNote('')
    } catch (err) {
      setError(err instanceof SurpriseError ? err.message : 'Could not send that surprise.')
    }
  }

  function onCancel(id: string) {
    setError(null)
    try {
      repo.adminCancelSurprise(id)
    } catch (err) {
      setError(err instanceof SurpriseError ? err.message : 'Could not cancel that surprise.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Send surprise</h1>
        <p className="text-sm text-muted-foreground">
          An extra treat for one kid — candy, a coffee, a few dollars. It does not move the vault and it does not show
          on the Week, Month, or Quarter board. One per kid each earn week, three per kid each calendar month. Sunday
          counts on the week that just finished.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-primary" aria-hidden />
            New surprise
          </CardTitle>
          <CardDescription>
            {kid?.name ?? 'Kid'}: {allowance.weekUsed} of {allowance.weekCap} this earn week, {allowance.monthUsed} of{' '}
            {allowance.monthCap} this month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Kid
              <NativeSelect value={kidId} onChange={(e) => setKidId(e.target.value)} data-testid="surprise-kid">
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Title
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Starbucks, candy bar, $5 at the store"
                maxLength={80}
                required
                data-testid="surprise-title"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For crushing the week"
                maxLength={280}
                data-testid="surprise-note"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Emoji <span className="font-normal text-muted-foreground">(optional)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {EMOJI_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={emoji === choice}
                    onClick={() => setEmoji((current) => (current === choice ? '' : choice))}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-lg border text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      emoji === choice ? 'border-primary bg-secondary' : 'bg-card hover:bg-secondary/60',
                    )}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="Or type one"
                maxLength={8}
                aria-label="Emoji"
                data-testid="surprise-emoji"
              />
            </fieldset>
            {allowance.message && (
              <p role="alert" className="text-sm font-medium text-destructive" data-testid="surprise-cap">
                {allowance.message}
              </p>
            )}
            {error && !allowance.message && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            {sentTitle && (
              <p role="status" className="text-sm font-medium text-primary" data-testid="surprise-sent">
                Sent “{sentTitle}”. {kid?.name} will see it the next time they open Home.
              </p>
            )}
            <Button type="submit" disabled={!allowance.canSend || title.trim().length === 0} data-testid="surprise-send">
              Send surprise
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="surprise-list-heading" className="space-y-3">
        <h2 id="surprise-list-heading" className="text-lg font-semibold">
          Sent
        </h2>
        {surprises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No surprises yet.</p>
        ) : (
          <Card>
            <ul className="divide-y">
              {surprises.map((drop) => {
                const name = kids.find((k) => k.id === drop.kidId)?.name ?? drop.kidId
                return (
                  <li key={drop.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {drop.emoji ? <span className="mr-1.5">{drop.emoji}</span> : null}
                        {drop.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {name} · {formatDenver(new Date(drop.createdAt))}
                        {drop.note ? ` · ${drop.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <Badge variant={drop.status === 'pending' ? 'accent' : 'outline'}>{STATUS_LABEL[drop.status]}</Badge>
                      {drop.status === 'pending' && (
                        <Button type="button" size="sm" variant="outline" onClick={() => onCancel(drop.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
