import { Link } from 'react-router-dom'
import { Crown, LockOpen, Megaphone, Trophy } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { TIER_PERIOD } from '@/data/seed'
import type { WinKind } from '@/data/types'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const KIND_LABEL: Record<WinKind, string> = {
  unlock: 'Unlocked',
  announce: 'Announced',
}

/** KID-FACING. Family unlocks and announcements. No names, no scores. */
export function KidWinsPage() {
  const wins = useRepositoryValue((r) => r.listWins())

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wins</h1>
        <p className="text-sm text-muted-foreground">Everything the family has unlocked together.</p>
      </div>

      {wins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Trophy className="size-6" aria-hidden />
            </span>
            <p className="font-semibold">No wins yet — fill the vault on Home</p>
            <Link to="/home" className="text-sm underline underline-offset-4">
              Back to Home
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ol className="divide-y">
            {wins.map((win) => {
              const Icon = win.kind === 'unlock' ? LockOpen : Megaphone
              return (
                <li key={win.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{win.title}</span>
                      <Badge variant={win.kind === 'unlock' ? 'default' : 'accent'}>{KIND_LABEL[win.kind]}</Badge>
                      <Badge variant="outline">{TIER_PERIOD[win.tier]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDenver(new Date(win.createdAt))}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <Crown className="size-4" aria-hidden />
        Top earner crowns — Phase later
      </div>
    </div>
  )
}
