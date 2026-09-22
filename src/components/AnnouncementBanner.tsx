import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, X } from 'lucide-react'
import { useRepository } from '@/data/RepositoryContext'
import { TIER_PERIOD } from '@/data/seed'
import type { KidReward } from '@/data/types'
import { Button } from '@/components/ui/button'

/**
 * KID-FACING. Shows newly announced rewards once per kid. The unseen list is
 * captured on mount and marked seen immediately, so a reload or a second visit
 * will not show it again. In-app only; no push.
 */
export function AnnouncementBanner({ userId }: { userId: string }) {
  const repo = useRepository()
  const [announcements, setAnnouncements] = useState<KidReward[]>(() => repo.listUnseenAnnouncements(userId))
  const ids = announcements.map((a) => a.id).join(',')

  useEffect(() => {
    if (ids) repo.markAnnouncementsSeen(userId, ids.split(','))
  }, [repo, userId, ids])

  if (announcements.length === 0) return null

  return (
    <div
      role="status"
      className="glass flex animate-flare-in flex-col gap-3 rounded-2xl border border-accent/50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="text-sm">
          <p className="font-bold">
            {announcements.length === 1 ? 'Ground Control announced a reward' : 'New rewards announced'}
          </p>
          <ul className="mt-1 space-y-0.5">
            {announcements.map((a) => (
              <li key={a.id}>
                <span className="font-semibold">{a.title}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {TIER_PERIOD[a.tier]}
                  {a.blurb ? ` · ${a.blurb}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Button asChild size="sm" variant="star">
          <Link to="/rewards">See rewards</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAnnouncements([])} aria-label="Dismiss">
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
