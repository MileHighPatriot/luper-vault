import { NavLink, Outlet } from 'react-router-dom'
import { CirclePlus, Clock, Gauge, Gift, Inbox, ScrollText, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { cn } from '@/lib/utils'

interface AdminTab {
  to: string
  label: string
  icon: LucideIcon
}

const TABS: AdminTab[] = [
  { to: '/admin/inbox', label: 'Inbox', icon: Inbox },
  { to: '/admin/add-earn', label: 'Add earn', icon: CirclePlus },
  { to: '/admin/rewards', label: 'Rewards', icon: Gift },
  { to: '/admin/surprise', label: 'Surprise', icon: Sparkles },
  { to: '/admin/ledger', label: 'Ledger', icon: ScrollText },
  { to: '/admin/clock', label: 'Clock', icon: Clock },
  { to: '/admin/verify', label: 'Verify', icon: Gauge },
  { to: '/admin/dev', label: 'Dev tools', icon: Wrench },
]

/** Sub-navigation for parent screens. Rendered inside `RequireAdmin`. */
export function AdminLayout() {
  const pendingCount = useRepositoryValue((r) => r.listPendingClaims().length)

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Parent sections" className="-mx-4 overflow-x-auto px-4">
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
                {label === 'Inbox' && pendingCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}
