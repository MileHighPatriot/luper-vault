import { NavLink, Outlet } from 'react-router-dom'
import { Gift, Home, Rocket, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KidTab {
  to: string
  label: string
  icon: LucideIcon
}

const TABS: KidTab[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/earn', label: 'Earn', icon: Rocket },
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
        <ul className="glass inline-flex gap-1 rounded-full border p-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-[0_6px_18px_-10px] shadow-accent'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
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
