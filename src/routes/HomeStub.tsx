import { Link } from 'react-router-dom'
import { Coins, Gauge, Gift, Home, Inbox, Trophy, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
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

const ADMIN_NAV: StubItem[] = [
  { label: 'Inbox', icon: Inbox, phase: 2 },
  { label: 'Add earn', icon: Coins, phase: 3 },
  { label: 'Rewards builder', icon: Gift, phase: 5 },
]

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
  if (!user) return null

  if (isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parent console</h1>
          <p className="text-sm text-muted-foreground">
            Phase 1 ships the data layer and meter engine. Use Verify to watch the engine work.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-primary" aria-hidden />
              Verify screen
            </CardTitle>
            <CardDescription>Family vault meters, simulated approved points, and seed catalog counts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin/verify">Open Verify</Link>
            </Button>
          </CardContent>
        </Card>
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
