import type { Reward, Tier } from '@/data/types'

export const TIER_PERIOD: Readonly<Record<Tier, string>> = {
  T1: 'Week',
  T2: 'Month',
  T3: 'Quarter',
}

type RewardSpec = [id: string, tier: Tier, title: string, blurb: string]

/** Placeholder rewards. Parents edit these in the Rewards builder. */
const SPECS: RewardSpec[] = [
  ['t1-movie-night', 'T1', 'Friday movie night', 'Family picks the movie, popcorn included.'],
  ['t1-late-bedtime', 'T1', 'Saturday late bedtime', 'Thirty extra minutes up for everyone.'],
  ['t2-family-outing', 'T2', 'Family outing', 'Trampoline park, zoo, or a hike. The family votes.'],
  ['t3-big-day-out', 'T3', 'Big day out', 'A whole-day adventure the family plans together.'],
]

export function buildSeedRewards(now: Date = new Date()): Reward[] {
  const at = now.toISOString()
  return SPECS.map(([id, tier, title, blurb]) => ({
    id: `reward.${id}`,
    tier,
    title,
    blurb,
    active: true,
    createdAt: at,
    updatedAt: at,
  }))
}
