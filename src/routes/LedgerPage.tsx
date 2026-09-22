import { ScrollText } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import type { LedgerSource } from '@/data/types'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const SOURCE_LABEL: Record<LedgerSource, string> = {
  inbox: 'Inbox',
  simulate: 'Simulated',
}

/** ADMIN ONLY. Recent approved events. Full audit tooling is a later phase. */
export function LedgerPage() {
  const entries = useRepositoryValue((r) => r.adminListRecentLedger(50))
  const users = useRepositoryValue((r) => r.listUsers())
  const acts = useRepositoryValue((r) => r.listActs())

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const titleOf = (id: string | null) => (id ? (acts.find((a) => a.id === id)?.title ?? id) : '—')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Approved events only, newest first (last 50). Pending and denied claims never appear here.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <ScrollText className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">Nothing approved yet</p>
              <p className="text-sm text-muted-foreground">Approve a claim in the Inbox and it will show up here.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2 font-medium">When (Denver)</th>
                  <th scope="col" className="px-4 py-2 font-medium">Who</th>
                  <th scope="col" className="px-4 py-2 font-medium">Act</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Points</th>
                  <th scope="col" className="px-4 py-2 font-medium">Path</th>
                  <th scope="col" className="px-4 py-2 font-medium">Source</th>
                  <th scope="col" className="px-4 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                      {formatDenver(new Date(e.createdAt))}
                    </td>
                    <td className="px-4 py-2 font-medium">{nameOf(e.userId)}</td>
                    <td className="px-4 py-2">{titleOf(e.actId)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {e.points > 0 ? `+${e.points}` : e.points}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">Path {e.path}</Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{SOURCE_LABEL[e.source]}</td>
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
