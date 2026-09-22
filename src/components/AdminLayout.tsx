import { NavLink, Outlet } from 'react-router-dom'
import { CirclePlus, Clock, Gauge, Gift, Inbox, ScrollText, Settings, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
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
  { to: '/admin/audit', label: 'Audit', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/clock', label: 'Clock', icon: Clock },
  { to: '/admin/verify', label: 'Verify', icon: Gauge },
  { to: '/admin/dev', label: 'Dev tools', icon: Wrench },
]

/** Sub-navigation for parent screens. Rendered inside `RequireAdmin`. */
export function AdminLayout() {
  const pendingCount = useRepositoryValue((r) => r.listPendingClaims().length)

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ground Control sections" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-ivory/10">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-accent text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {label === 'Inbox' && pendingCount > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground tabular-nums">
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
