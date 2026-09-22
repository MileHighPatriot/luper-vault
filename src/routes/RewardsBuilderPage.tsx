import { useState, type FormEvent } from 'react'
import { Gift, Megaphone, Pencil, Plus, Power } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { RewardError } from '@/data/repository'
import { TIER_PERIOD } from '@/data/seed'
import type { Reward, Tier } from '@/data/types'
import { FILLS, TIERS, isMeterFull } from '@/engine/meters'
import { formatDenver } from '@/lib/time/denver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function RewardRow({ reward, onError }: { reward: Reward; onError(message: string): void }) {
  const repo = useRepository()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(reward.title)
  const [blurb, setBlurb] = useState(reward.blurb)

  function run(action: () => void) {
    try {
      action()
      onError('')
    } catch (err) {
      onError(err instanceof RewardError ? err.message : 'Something went wrong. Try again.')
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    run(() => {
      repo.adminUpdateReward(reward.id, { title, blurb })
      setEditing(false)
    })
  }

  return (
    <li className={cn('flex flex-col gap-3 p-4', !reward.active && 'opacity-60')}>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2">
          <label htmlFor={`title-${reward.id}`} className="text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input id={`title-${reward.id}`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <label htmlFor={`blurb-${reward.id}`} className="text-xs font-medium text-muted-foreground">
            Blurb
          </label>
          <Input id={`blurb-${reward.id}`} value={blurb} onChange={(e) => setBlurb(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setTitle(reward.title)
                setBlurb(reward.blurb)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{reward.title}</span>
              {!reward.active && <Badge variant="outline">inactive</Badge>}
              {reward.announcement && (
                <Badge variant="accent" title={formatDenver(new Date(reward.announcement.at))}>
                  announced
                </Badge>
              )}
            </div>
            {reward.blurb && <p className="text-sm text-muted-foreground">{reward.blurb}</p>}
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => repo.adminUpdateReward(reward.id, { active: !reward.active }))}
            >
              <Power className="size-4" aria-hidden />
              {reward.active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={Boolean(reward.announcement) || !reward.active}
              onClick={() => run(() => repo.adminAnnounceReward(reward.id))}
              title={reward.announcement ? 'Already announced' : 'Kids see a banner on Home once'}
            >
              <Megaphone className="size-4" aria-hidden />
              {reward.announcement ? 'Announced' : 'Announce'}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function AddRewardForm({ tier, onError }: { tier: Tier; onError(message: string): void }) {
  const repo = useRepository()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      repo.adminCreateReward({ tier, title, blurb })
      setTitle('')
      setBlurb('')
      setOpen(false)
      onError('')
    } catch (err) {
      onError(err instanceof RewardError ? err.message : 'Could not add that reward.')
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add {TIER_PERIOD[tier].toLowerCase()} reward
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
      <label htmlFor={`new-title-${tier}`} className="text-xs font-medium text-muted-foreground">
        Title
      </label>
      <Input
        id={`new-title-${tier}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Pancake breakfast"
        className="bg-card"
        autoFocus
      />
      <label htmlFor={`new-blurb-${tier}`} className="text-xs font-medium text-muted-foreground">
        Blurb (optional)
      </label>
      <Input
        id={`new-blurb-${tier}`}
        value={blurb}
        onChange={(e) => setBlurb(e.target.value)}
        placeholder="Saturday morning, everyone helps."
        className="bg-card"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={title.trim().length === 0}>
          <Plus className="size-4" aria-hidden />
          Add reward
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** ADMIN ONLY. Set the reward list per vault tier and announce unlocks. */
export function RewardsBuilderPage() {
  const rewards = useRepositoryValue((r) => r.adminListRewards())
  const meters = useRepositoryValue((r) => r.getMeters())
  const [error, setError] = useState('')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rewards builder</h1>
        <p className="text-sm text-muted-foreground">
          One list per vault. Kids see active rewards as locked until the family meter reaches its fill. Announce shows a
          banner on each kid's Home once.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {TIERS.map((tier) => {
          const meter = meters.find((m) => m.tier === tier)
          const list = rewards.filter((r) => r.tier === tier)
          return (
            <Card key={tier}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Gift className="size-5 text-primary" aria-hidden />
                  {TIER_PERIOD[tier]} · {tier}
                  {meter && isMeterFull(meter) ? (
                    <Badge>unlocked</Badge>
                  ) : (
                    <Badge variant="secondary">locked</Badge>
                  )}
                </CardTitle>
                <CardDescription>Unlocks when {tier} reaches {FILLS[tier]} points.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-0 pb-4">
                {list.length === 0 ? (
                  <p className="px-4 text-sm text-muted-foreground">No rewards yet for this vault.</p>
                ) : (
                  <ul className="divide-y border-t border-b">
                    {list.map((reward) => (
                      <RewardRow key={reward.id} reward={reward} onError={setError} />
                    ))}
                  </ul>
                )}
                <div className="px-4">
                  <AddRewardForm tier={tier} onError={setError} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
