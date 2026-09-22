import { Link } from 'react-router-dom'
import { CirclePlus, Gauge, Gift, Inbox, ScrollText, Wrench, type LucideIcon } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConsoleCard {
  to: string
  label: string
  description: string
  icon: LucideIcon
  primary?: boolean
}

const CARDS: ConsoleCard[] = [
  { to: '/admin/inbox', label: 'Inbox', description: 'Approve, deny, or edit pending claims.', icon: Inbox, primary: true },
  { to: '/admin/add-earn', label: 'Add earn', description: 'Stamp Path B earns and demerits directly.', icon: CirclePlus, primary: true },
  { to: '/admin/ledger', label: 'Ledger', description: 'Recent approved events.', icon: ScrollText },
  { to: '/admin/verify', label: 'Verify', description: 'Meter engine and seed catalog checks.', icon: Gauge },
  { to: '/admin/dev', label: 'Dev tools', description: 'Queue demo claims and reset the store.', icon: Wrench },
]

const LATER: { label: string; icon: LucideIcon; phase: number }[] = [
  { label: 'Rewards builder', icon: Gift, phase: 5 },
]

/** ADMIN ONLY landing page. */
export function ParentConsole() {
  const pendingCount = useRepositoryValue((r) => r.listPendingClaims().length)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parent console</h1>
        <p className="text-sm text-muted-foreground">
          Approve Path A claims in the Inbox or stamp Path B earns and demerits in Add earn. Both write the family
          ledger and move the meters.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(({ to, label, description, icon: Icon, primary }) => (
          <Card key={to}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-5 text-primary" aria-hidden />
                {label}
                {label === 'Inbox' && pendingCount > 0 && <Badge>{pendingCount} waiting</Badge>}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant={primary ? 'default' : 'outline'}>
                <Link to={to}>Open {label}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Coming in later phases</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {LATER.map(({ label, icon: Icon, phase }) => (
            <li
              key={label}
              className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-muted-foreground"
              aria-disabled
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
              <Badge variant="outline">Phase {phase}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
