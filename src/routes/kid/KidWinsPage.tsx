import { Link } from 'react-router-dom'
import { Crown, LockOpen, Megaphone, Sparkles, Trophy } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { TIER_PERIOD } from '@/data/seed'
import type { Tier, WinKind } from '@/data/types'
import { burstFrom } from '@/lib/fx'
import { formatDenver } from '@/lib/time/denver'
import { useSounds } from '@/lib/useSounds'
import { cn } from '@/lib/utils'
import { ConstellationMeter } from '@/components/ConstellationMeter'

const KIND_LABEL: Record<WinKind, string> = {
  unlock: 'Unlocked',
  announce: 'Announced',
}

const TIER_RING: Record<Tier, string> = {
  T1: 'ring-tier-1/60',
  T2: 'ring-tier-2/60',
  T3: 'ring-tier-3/60',
}

function MissionBadge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('mission-badge flex size-16 shrink-0 items-center justify-center text-2xl font-bold', className)}>
      {children}
    </span>
  )
}

function BadgeTile({
  badge,
  title,
  chips,
  when,
  note,
  className,
  testId,
}: {
  badge: React.ReactNode
  title: string
  chips: React.ReactNode
  when: string
  note?: string
  className?: string
  testId?: string
}) {
  const play = useSounds()
  return (
    <li data-testid={testId}>
      <button
        type="button"
        onClick={(e) => {
          burstFrom(e.currentTarget.querySelector('.mission-badge'), { count: 12, distance: 70 })
          play('tap')
        }}
        className={cn(
          'glass group flex h-full w-full flex-col items-center gap-2 rounded-3xl border p-4 text-center transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-1deg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0 motion-reduce:hover:rotate-0',
          className,
        )}
      >
        <MissionBadge className="transition-transform duration-500 group-hover:rotate-[10deg] group-hover:scale-110">{badge}</MissionBadge>
        <span className="font-extrabold leading-snug">{title}</span>
        <span className="flex flex-wrap justify-center gap-1.5">{chips}</span>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
        <span className="text-[11px] text-muted-foreground">{when}</span>
      </button>
    </li>
  )
}

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'gold' | 'blue' | 'plain' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-bold',
        tone === 'gold' && 'bg-accent text-accent-foreground',
        tone === 'blue' && 'bg-primary text-primary-foreground',
        tone === 'plain' && 'border border-ivory/20 text-foreground/85',
      )}
    >
      {children}
    </span>
  )
}

/** KID-FACING. Family unlocks and announcements, plus this kid's seen surprise patches. */
export function KidWinsPage() {
  const { user } = useAuth()
  const wins = useRepositoryValue((r) => r.listWins())
  const surprises = useRepositoryValue((r) => (user ? r.listSeenSurprisesForKid(user.id) : []))

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-rise-in">
        <h1 className="text-starlight text-4xl font-extrabold tracking-tight">Wins</h1>
        <p className="text-sm text-muted-foreground">Mission badges the crew has earned together. Tap one to make it sparkle.</p>
      </div>

      {surprises.length > 0 && (
        <section aria-labelledby="surprise-patches-heading" className="space-y-3">
          <h2 id="surprise-patches-heading" className="text-xl font-extrabold">
            Surprise patches
          </h2>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {surprises.map((surprise) => (
              <BadgeTile
                key={surprise.id}
                testId="surprise-patch"
                className="border-accent/40"
                badge={surprise.emoji ?? <Sparkles className="size-7" aria-hidden />}
                title={surprise.title}
                chips={<Chip tone="gold">Surprise</Chip>}
                note={surprise.note}
                when={formatDenver(new Date(surprise.createdAt))}
              />
            ))}
          </ol>
        </section>
      )}

      {wins.length === 0 && surprises.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-3xl border px-6 py-10 text-center">
          <div className="w-full max-w-xs opacity-80">
            <ConstellationMeter tier="T2" percent={0} label="Empty constellation" valueNow={0} valueMax={1} />
          </div>
          <p className="font-extrabold">No wins yet — light up the sky on Home</p>
          <Link to="/home" className="text-sm font-semibold text-accent underline underline-offset-4">
            Back to Home
          </Link>
        </div>
      ) : wins.length > 0 ? (
        <section aria-labelledby="crew-wins-heading" className="space-y-3">
          <h2 id="crew-wins-heading" className="text-xl font-extrabold">
            Crew wins
          </h2>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {wins.map((win) => {
              const Icon = win.kind === 'unlock' ? LockOpen : Megaphone
              return (
                <BadgeTile
                  key={win.id}
                  className={cn('ring-1 ring-inset', TIER_RING[win.tier])}
                  badge={<Icon className="size-7" aria-hidden />}
                  title={win.title}
                  chips={
                    <>
                      <Chip tone={win.kind === 'unlock' ? 'blue' : 'gold'}>{KIND_LABEL[win.kind]}</Chip>
                      <Chip>{TIER_PERIOD[win.tier]}</Chip>
                    </>
                  }
                  when={formatDenver(new Date(win.createdAt))}
                />
              )
            })}
          </ol>
        </section>
      ) : null}

      <div className="flex items-center gap-3 rounded-3xl border border-dashed border-ivory/20 px-4 py-3 text-sm text-muted-foreground">
        <Crown className="size-4" aria-hidden />
        Top earner crowns — Phase later
        <Trophy className="ml-auto size-4 opacity-50" aria-hidden />
      </div>
    </div>
  )
}
