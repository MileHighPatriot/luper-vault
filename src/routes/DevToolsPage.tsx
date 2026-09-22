import { useMemo, useState, type FormEvent } from 'react'
import { ListPlus, RotateCcw, Sprout } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import type { ClaimStatus } from '@/data/types'
import { ClaimError } from '@/data/repository'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'

const STATUS_VARIANT: Record<ClaimStatus, 'accent' | 'secondary' | 'outline'> = {
  pending: 'accent',
  approved: 'secondary',
  denied: 'outline',
}

/**
 * ADMIN ONLY / DEV. Lets a parent queue Path A claims on a kid's behalf so
 * the Inbox has something to process without switching logins.
 */
export function DevToolsPage() {
  const repo = useRepository()
  const users = useRepositoryValue((r) => r.listUsers())
  const acts = useRepositoryValue((r) => r.listActs())
  const recent = useRepositoryValue((r) => r.adminListClaims(20))

  const kids = useMemo(() => users.filter((u) => u.band), [users])
  const [kidId, setKidId] = useState(kids[0]?.id ?? '')
  const kid = kids.find((k) => k.id === kidId) ?? kids[0]
  const pathAActs = useMemo(
    () => acts.filter((a) => a.band === kid?.band && a.path === 'A'),
    [acts, kid?.band],
  )
  const [actId, setActId] = useState('')
  const selectedActId = pathAActs.some((a) => a.id === actId) ? actId : (pathAActs[0]?.id ?? '')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  function queue(event: FormEvent) {
    event.preventDefault()
    if (!kid || !selectedActId) return
    try {
      const claim = repo.queueClaim({ userId: kid.id, actId: selectedActId })
      const act = acts.find((a) => a.id === claim.actId)
      setMessage({ tone: 'ok', text: `Queued "${act?.title}" for ${kid.name} (${claim.requestedPoints} pts).` })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ClaimError ? err.message : 'Could not queue that claim.' })
    }
  }

  function seedDemo() {
    const created = repo.adminSeedDemoClaims()
    setMessage({ tone: 'ok', text: `Queued ${created.length} demo claims across ${kids.length} kids.` })
  }

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const titleOf = (id: string) => acts.find((a) => a.id === id)?.title ?? id

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dev tools</h1>
        <p className="text-sm text-muted-foreground">
          Queue Path A claims on a kid's behalf for testing. Kids normally claim from their own Earn screen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListPlus className="size-5 text-primary" aria-hidden />
              Queue a Path A claim
            </CardTitle>
            <CardDescription>Pick a kid and one of their claimable acts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={queue} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="kid" className="text-xs font-medium text-muted-foreground">
                  Kid
                </label>
                <NativeSelect id="kid" value={kid?.id ?? ''} onChange={(e) => setKidId(e.target.value)}>
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.band})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="act" className="text-xs font-medium text-muted-foreground">
                  Act (Path A only)
                </label>
                <NativeSelect id="act" value={selectedActId} onChange={(e) => setActId(e.target.value)}>
                  {pathAActs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} · {a.points} pts
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" disabled={!selectedActId}>
                <ListPlus className="size-4" aria-hidden />
                Queue claim
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="size-5 text-primary" aria-hidden />
              Seed demo claims
            </CardTitle>
            <CardDescription>Two Path A claims per kid, staggered so the Inbox ordering is visible.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={seedDemo}>
              <Sprout className="size-4" aria-hidden />
              Seed demo claims
            </Button>
            <Button variant="ghost" onClick={() => repo.adminResetMetersAndLedger()}>
              <RotateCcw className="size-4" aria-hidden />
              Reset claims, ledger, meters
            </Button>
          </CardContent>
        </Card>
      </div>

      {message && (
        <p role="status" className={message.tone === 'error' ? 'text-sm font-medium text-destructive' : 'text-sm text-muted-foreground'}>
          {message.text}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent claims (all statuses)</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No claims yet.</p>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="px-4 py-2 font-medium">Created (Denver)</th>
                    <th scope="col" className="px-4 py-2 font-medium">Kid</th>
                    <th scope="col" className="px-4 py-2 font-medium">Act</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Pts</th>
                    <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {formatDenver(new Date(c.createdAt))}
                      </td>
                      <td className="px-4 py-2 font-medium">{nameOf(c.userId)}</td>
                      <td className="px-4 py-2">{titleOf(c.actId)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {c.editedPoints !== undefined && c.editedPoints !== c.requestedPoints ? (
                          <>
                            <span className="text-muted-foreground line-through">{c.requestedPoints}</span>{' '}
                            {c.editedPoints}
                          </>
                        ) : (
                          c.requestedPoints
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
