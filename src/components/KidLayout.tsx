import { NavLink, Outlet } from 'react-router-dom'
import { Gift, Home, Rocket, Trophy, type LucideIcon } from 'lucide-react'
import { useSounds } from '@/lib/useSounds'
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
 * Kid navigation: a floating dock at the bottom, sized for tablet thumbs.
 * Nothing here, or in any route below it, imports admin ledger helpers or
 * shows personal totals.
 */
export function KidLayout() {
  const play = useSounds()
  return (
    <div className="flex flex-col gap-6">
      <Outlet />
      <nav
        aria-label="Kid sections"
        className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="glass flex w-full max-w-md items-stretch justify-between gap-1 rounded-3xl border p-1.5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                onClick={() => play('tap')}
                className={({ isActive }) =>
                  cn(
                    'group relative flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-xs font-bold transition-all duration-300',
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-[0_8px_22px_-10px] shadow-accent'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'size-6 transition-transform duration-300',
                        isActive ? '-translate-y-0.5 scale-110' : 'group-hover:-translate-y-0.5',
                      )}
                      aria-hidden
                    />
                    {label}
                    {isActive && (
                      <span className="absolute -top-1.5 size-2 rounded-full bg-ivory shadow-[0_0_10px_2px] shadow-accent" aria-hidden />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
