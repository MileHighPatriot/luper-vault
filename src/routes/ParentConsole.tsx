import { Link } from 'react-router-dom'
import { CirclePlus, Clock, Gauge, Gift, Inbox, ScrollText, Settings, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
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
  { to: '/admin/rewards', label: 'Rewards', description: 'Set the week, month, and quarter rewards. Announce unlocks.', icon: Gift },
  { to: '/admin/surprise', label: 'Surprise', description: 'Send an extra treat to one kid. Does not move the vault.', icon: Sparkles, primary: true },
  { to: '/admin/audit', label: 'Audit', description: 'Search approvals, Add earns, and surprises by kid, type, and date.', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', description: 'Family name, Sky log verse, kid sounds, and the admin PIN.', icon: Settings },
  { to: '/admin/clock', label: 'Clock', description: 'Denver time, go-live and earn-window status, FORCE_LIVE.', icon: Clock },
  { to: '/admin/verify', label: 'Verify', description: 'Meter engine and seed catalog checks.', icon: Gauge },
  { to: '/admin/dev', label: 'Dev tools', description: 'Queue demo claims and reset the store.', icon: Wrench },
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
      <p className="text-xs text-muted-foreground">
        Monday-ready core is in. Phase 7 added surprise drops; Phase 8 adds the admin PIN, Settings, and the Audit log.
      </p>
    </div>
  )
}
