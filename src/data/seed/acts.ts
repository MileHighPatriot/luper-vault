import type { Band, EarnAct, EarnPath, KidBand } from '@/data/types'

/**
 * Locked Phase 1 catalog. Points live in the DB now; the kid-facing UI that
 * displays them arrives in Phase 4.
 */

type ActSpec = [id: string, title: string, points: number, path?: EarnPath, extra?: Partial<EarnAct>]

function build(band: Band, specs: ActSpec[]): EarnAct[] {
  return specs.map(([id, title, points, path = 'A', extra]) => ({
    id: `${band}.${id}`,
    title,
    band,
    points,
    path,
    pathBStamp: path === 'B',
    ...extra,
  }))
}

const LITTLE: ActSpec[] = [
  ['make-bed', 'Make bed', 2],
  ['pack-backpack', 'Pack backpack', 2],
  ['dogs', 'Dogs', 3],
  ['ready-school', 'Ready for school on time', 3],
  ['ready-bed', 'Ready for bed on time', 3],
  ['honest', 'Honest when it was easier to lie', 5, 'B'],
  ['read-20', 'Read 20 minutes', 3],
  ['homework-calm', 'Homework without lots of crying or complaining', 4],
  ['school-growth', 'School growth', 6, 'B'],
  ['help-food', 'Help with food', 3],
  ['room-reset', 'Clean room reset', 4],
  ['room-keep', 'Keep room clean', 2],
  ['teeth', 'Teeth without a fight', 2],
  ['shoes-coat-door', 'Shoes and coat by the door', 1],
  ['hamper', 'Hamper', 1],
  ['kind-sibling', 'Kind to a sibling', 3, 'B'],
  ['shoes-first-ask', 'Shoes on first ask', 2],
  ['bible-verse', 'Memorize and recite a Bible verse', 5, 'B'],
]

const TEEN: ActSpec[] = [
  ['laundry', 'Laundry start to finish', 5],
  ['trash-recycle', 'Trash and recycle', 2],
  ['kitchen-dinner', 'Kitchen after dinner', 4],
  ['solo-meal', 'Solo planned family meal', 8, 'B'],
  ['bathroom', 'Clean bathroom', 4],
  ['watch-kids', 'Watch the kids', 5, 'B'],
  ['homework-no-reminders', 'Homework with no repeated reminders', 1],
  ['alarm-ready', 'Alarm and ready', 3],
  ['follow-through', 'Follow through on a commitment or goal', 5, 'B'],
  ['own-mistake', 'Own a mistake', 5, 'B'],
  ['adult-skill', 'Adult skill practice', 4],
  ['teach-little', 'Teach a little a chore or skill', 6, 'B'],
  ['dogs', 'Dogs', 3],
  ['school-growth', 'School growth', 6, 'B'],
  ['help-food', 'Help with food', 2],
  ['fill-gas', 'Fill gas once', 3, 'B'],
  ['meal-plan', 'Meal-plan one dinner', 3],
  ['budget-errand', 'Budget a $20 errand', 4, 'B'],
  ['no-phone-focus', '30 minutes no-phone focus', 3],
  ['small-fix', 'Small fix', 3],
  ['own-trash-day', 'Own trash day', 2],
  ['help-fil', "Help at FIL's", 5, 'B', { rare: true }],
  ['bible-verse', 'Memorize and recite a Bible verse', 5, 'B'],
]

function conduct(id: string, title: string, little: number, teen: number): ActSpec[] {
  const forAudience = (audience: KidBand, points: number): ActSpec => [
    `${id}-${audience}`,
    title,
    points,
    'B',
    { audience },
  ]
  return [forAudience('little', little), forAudience('teen', teen)]
}

const CONDUCT: ActSpec[] = [
  ...conduct('caught-good', 'Caught being good', 4, 3),
  ...conduct('outstanding-day', 'Outstanding day', 7, 5),
  ...conduct('day-demerit', 'Day demerit', -5, -7),
  ...conduct('serious', 'Serious', -10, -14),
]

const PARENT: ActSpec[] = [
  ['gym', 'Gym', 3, 'B'],
  ['intentional-eating', 'Intentional eating', 2, 'B'],
  ['stick-to-word', 'Stick to your word', 5, 'B'],
  ['phone-down', 'Phone-down family block', 3, 'B'],
  ['us-time', 'Us-time', 4, 'B'],
  ['calm-talk', 'Calm talk', 4, 'B'],
  ['house-project', 'House project piece', 3, 'B'],
  ['sleep-respect', 'Sleep respect', 2, 'B'],
  ['morning-with-kid', 'Morning with a kid', 2, 'B'],
  ['one-on-one', 'One-on-one 10 minutes', 3, 'B'],
  ['no-yell-reboot', 'No-yell reboot', 3, 'B'],
  ['money-admin', 'Money admin same day', 3, 'B'],
  ['day-demerit', 'Parent day demerit', -5, 'B'],
]

export const SEED_ACTS: readonly EarnAct[] = [
  ...build('little', LITTLE),
  ...build('teen', TEEN),
  ...build('conduct', CONDUCT),
  ...build('parent', PARENT),
]

export const EXPECTED_ACT_COUNTS: Readonly<Record<Band, number>> = {
  little: 18,
  teen: 23,
  conduct: 8,
  parent: 13,
}

export function countActsByBand(acts: readonly EarnAct[]): Record<Band, number> {
  const counts: Record<Band, number> = { little: 0, teen: 0, conduct: 0, parent: 0 }
  for (const act of acts) counts[act.band] += 1
  return counts
}
