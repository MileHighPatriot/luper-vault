import { useState } from 'react'
import { Search, ScrollText, X } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import type { AuditEvent, AuditFilter, AuditPath, SurpriseStatus } from '@/data/types'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

const PATH_OPTIONS: { value: AuditPath | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'A', label: 'Path A (Inbox approvals)' },
  { value: 'B', label: 'Path B (Add earn, simulated)' },
  { value: 'surprise', label: 'Surprises' },
]

const STATUS_LABEL: Record<SurpriseStatus, string> = {
  pending: 'not seen',
  seen: 'seen',
  canceled: 'canceled',
}

function PathBadge({ event }: { event: AuditEvent }) {
  if (event.path === 'surprise') {
    return (
      <Badge variant={event.status === 'canceled' ? 'outline' : 'accent'}>
        Surprise{event.status ? ` · ${STATUS_LABEL[event.status]}` : ''}
      </Badge>
    )
  }
  return <Badge variant="outline">Path {event.path}</Badge>
}

/**
 * ADMIN ONLY. Searchable audit of ledger writes and surprise drops.
 * View-only in Phase 8. TODO(audit-void): void/undo is a later ticket.
 */
export function AuditPage() {
  const users = useRepositoryValue((r) => r.listUsers())
  const [query, setQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [path, setPath] = useState<AuditPath | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filter: AuditFilter = {
    query: query || undefined,
    userId: userId || undefined,
    path,
    from: from || undefined,
    to: to || undefined,
    limit: 200,
  }
  const events = useRepositoryValue((r) => r.adminListAuditEvents(filter))
  const total = useRepositoryValue((r) => r.adminListAuditEvents().length)
  const filtering = Boolean(query || userId || path !== 'all' || from || to)

  function clearFilters() {
    setQuery('')
    setUserId('')
    setPath('all')
    setFrom('')
    setTo('')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
        <p className="text-sm text-muted-foreground">
          Every ledger write (Inbox approvals, Add earn stamps, simulated points) and every surprise drop, newest first.
          Points are shown here only. View-only for now; void comes later.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1.5 text-sm font-medium lg:col-span-2">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Act, note, or name"
                className="pl-9"
                data-testid="audit-search"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Who
            <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} data-testid="audit-kid">
              <option value="">Everyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.role === 'admin' ? 'Parent' : u.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type
            <NativeSelect value={path} onChange={(e) => setPath(e.target.value as AuditPath | 'all')} data-testid="audit-path">
              {PATH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              From
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="audit-from" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              To
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="audit-to" />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground sm:col-span-2 lg:col-span-5">
            <span data-testid="audit-count">
              {filtering ? `${events.length} of ${total} events` : `${total} events`}
              {events.length === 200 ? ' (showing the newest 200)' : ''}
            </span>
            {filtering && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4" aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <ScrollText className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{filtering ? 'Nothing matches those filters' : 'Nothing logged yet'}</p>
              <p className="text-sm text-muted-foreground">
                {filtering
                  ? 'Widen the date range or clear a filter.'
                  : 'Approve a claim, stamp an earn, or send a surprise and it will show up here.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[44rem] text-sm" data-testid="audit-table">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2 font-medium">When (Denver)</th>
                  <th scope="col" className="px-4 py-2 font-medium">Who</th>
                  <th scope="col" className="px-4 py-2 font-medium">What</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Points</th>
                  <th scope="col" className="px-4 py-2 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2 font-medium">Source</th>
                  <th scope="col" className="px-4 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={`${e.kind}:${e.id}`} className="border-b last:border-0" data-testid="audit-row" data-user={e.userId}>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{formatDenver(new Date(e.at))}</td>
                    <td className="px-4 py-2 font-medium">{e.userName}</td>
                    <td className="px-4 py-2">{e.title}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {e.points === null ? <span className="text-muted-foreground">—</span> : e.points > 0 ? `+${e.points}` : e.points}
                    </td>
                    <td className="px-4 py-2">
                      <PathBadge event={e} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{e.source}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground" title={e.note}>
                      {e.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
