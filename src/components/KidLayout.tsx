import { NavLink, Outlet } from 'react-router-dom'
import { Coins, Gift, Home, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KidTab {
  to: string
  label: string
  icon: LucideIcon
}

const TABS: KidTab[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/earn', label: 'Earn', icon: Coins },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/wins', label: 'Wins', icon: Trophy },
]

/**
 * Kid navigation. Rendered inside `RequireKid`. Nothing here, or in any route
 * below it, imports admin ledger helpers or shows personal totals.
 */
export function KidLayout() {
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Kid sections" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}
