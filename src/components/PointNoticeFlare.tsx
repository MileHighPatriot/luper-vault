import { useEffect, useRef } from 'react'
import { Radio, Sparkles, Star } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { burst, burstFrom } from '@/lib/fx'
import { useSounds } from '@/lib/useSounds'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * KID-FACING. Custom points a parent logged for this kid, shown on Home until
 * dismissed. Reasons only; the number stays with the parents. Waits while a
 * surprise flare is up so the two never stack.
 */
export function PointNoticeFlare({ userId }: { userId: string }) {
  const repo = useRepository()
  const notices = useRepositoryValue((r) => r.listUnseenPointNotices(userId))
  const surprisesUp = useRepositoryValue((r) => r.listPendingSurprisesForKid(userId).length > 0)
  const play = useSounds()
  const opened = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const visible = notices.length > 0 && !surprisesUp
  const anyUp = notices.some((n) => n.direction === 'up')
  const allDown = notices.length > 0 && !anyUp

  useEffect(() => {
    if (visible && !opened.current) {
      opened.current = true
      if (!anyUp) return
      play('surprise')
      const timer = window.setTimeout(() => {
        const rect = dialogRef.current?.getBoundingClientRect()
        if (rect) burst(rect.left + rect.width / 2, rect.top + 28, { count: 22, distance: 160, size: 11, duration: 1100 })
      }, 260)
      return () => window.clearTimeout(timer)
    }
    if (!visible) opened.current = false
  }, [visible, anyUp, play])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sky-1/75 p-4 backdrop-blur-sm sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="point-notice-title"
        data-testid="point-notice"
        className={cn(
          'glass relative w-full max-w-md animate-flare-in overflow-hidden rounded-[2rem] border p-6',
          allDown ? 'border-ivory/20' : 'border-accent/60 shadow-[0_0_80px_-20px] shadow-accent/70',
        )}
      >
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span
            className={cn(
              'flex size-16 items-center justify-center rounded-3xl',
              allDown ? 'bg-sky-1 text-muted-foreground ring-1 ring-ivory/15' : 'animate-float bg-accent text-accent-foreground',
            )}
          >
            {allDown ? <Radio className="size-8" aria-hidden /> : <Star className="size-8 animate-star-tick" aria-hidden />}
          </span>
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-accent">
            <Sparkles className="size-3.5" aria-hidden />
            Message from Ground Control
          </p>
          <h2 id="point-notice-title" className="text-starlight text-2xl font-extrabold">
            {allDown ? 'Heads up' : 'You earned points for the vault'}
          </h2>
        </div>
        <ul className="relative mt-5 space-y-3">
          {notices.map((notice) => (
            <li
              key={notice.id}
              data-testid="point-notice-item"
              className={cn(
                'animate-pop rounded-2xl border px-4 py-3 text-center',
                notice.direction === 'up' ? 'border-accent/40 bg-accent/10' : 'border-ivory/15 bg-sky-1/60',
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {notice.direction === 'up' ? 'Points added' : 'Points taken away'}
              </p>
              <p className="mt-1 text-lg font-bold">{notice.reason}</p>
            </li>
          ))}
        </ul>
        <Button
          className="relative mt-5 h-14 w-full rounded-2xl text-base"
          size="lg"
          variant={allDown ? 'outline' : 'star'}
          autoFocus
          onClick={(e) => {
            if (anyUp) {
              burstFrom(e.currentTarget, { count: 16, distance: 110 })
              play('approve')
            }
            repo.markPointNoticesSeen(userId, notices.map((n) => n.id))
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  )
}
