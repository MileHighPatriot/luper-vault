import { Link } from 'react-router-dom'
import { CirclePlus, Coins, Gauge, Gift, Home, Inbox, ScrollText, Trophy, Wrench, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface StubItem {
  label: string
  icon: LucideIcon
  phase: number
}

const KID_NAV: StubItem[] = [
  { label: 'Home', icon: Home, phase: 4 },
  { label: 'Earn', icon: Coins, phase: 4 },
  { label: 'Rewards', icon: Gift, phase: 5 },
  { label: 'Wins', icon: Trophy, phase: 5 },
]

const ADMIN_NAV: StubItem[] = [{ label: 'Rewards builder', icon: Gift, phase: 5 }]

function StubNav({ items }: { items: StubItem[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map(({ label, icon: Icon, phase }) => (
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
  )
}

export function HomeStub() {
  const { user, isAdmin } = useAuth()
  const pendingCount = useRepositoryValue((r) => r.listPendingClaims().length)
  if (!user) return null

  if (isAdmin) {
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-5 text-primary" aria-hidden />
                Inbox
                {pendingCount > 0 && <Badge>{pendingCount} waiting</Badge>}
              </CardTitle>
              <CardDescription>Approve, deny, or edit pending claims.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/admin/inbox">Open Inbox</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CirclePlus className="size-5 text-primary" aria-hidden />
                Add earn
              </CardTitle>
              <CardDescription>Stamp Path B earns and demerits directly.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/admin/add-earn">Open Add earn</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="size-5 text-primary" aria-hidden />
                Ledger
              </CardTitle>
              <CardDescription>Recent approved events.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/admin/ledger">Open Ledger</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5 text-primary" aria-hidden />
                Verify
              </CardTitle>
              <CardDescription>Meter engine and seed catalog checks.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/admin/verify">Open Verify</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="size-5 text-primary" aria-hidden />
                Dev tools
              </CardTitle>
              <CardDescription>Queue Path A claims until the kid Earn button ships.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/admin/dev">Open Dev tools</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Coming in later phases</h2>
          <StubNav items={ADMIN_NAV} />
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {user.name}.</h1>
        <p className="text-sm text-muted-foreground">
          Your screens are still being built. You are logged in and the app remembers you.
        </p>
      </div>
      <StubNav items={KID_NAV} />
    </div>
  )
}
