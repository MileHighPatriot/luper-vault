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

// Ids are stable: renaming an act keeps its id so past ledger rows and pending
// claims stay linked. Removed acts live on as `retired` rows (see migrateDatabase).
const LITTLE: ActSpec[] = [
  ['make-bed', 'Make bed', 2],
  ['pack-backpack', 'Pack backpack', 2],
  ['ready-school', 'Ready for school on time', 3],
  ['teeth', 'Brush teeth', 2],
  ['shoes-coat-door', 'Shoes and coat by the door', 1],
  ['dogs', 'Feed the dogs', 2],
  ['dogs-water', "Fill the dogs' water", 2],
  ['hamper', 'Pick up dirty clothes', 1],
  ['room-reset', 'Clean room', 4],
  ['parents-room', "Clean up your stuff in Mom and Dad's room", 3],
  ['unload-dishwasher', 'Unload the dishwasher', 3],
  ['vacuum-living', 'Vacuum the living room', 4],
  ['trash', 'Take out the trash', 4],
  ['balcony', 'Clean up the balcony', 4],
  ['homework-calm', 'Homework', 4],
  ['read-20', 'Read 20 minutes', 3],
  ['ready-bed', 'Ready for bed on time', 3],
  ['honest', 'Honest when it was easier to lie', 5, 'B'],
  ['school-growth', 'School growth', 6, 'B'],
  ['kind-sibling', 'Kind to a sibling', 3, 'B'],
  ['bible-verse', 'Memorize and recite a Bible verse', 5, 'B'],
]

const TEEN: ActSpec[] = [
  ['wake-on-time', 'Wake up on time', 2],
  ['alarm-ready', 'Wake up with your own alarm', 4],
  ['make-bed', 'Make bed', 2],
  ['teeth', 'Brush teeth', 1],
  ['hamper', 'Dirty clothes in the hamper', 1],
  ['room-clean', 'Clean room', 4],
  ['closet', 'Clean and organize closet', 5],
  ['parents-room', "Clean up your mess in Mom and Dad's room", 3],
  ['laundry', 'Laundry start to finish', 5],
  ['kitchen-dinner', 'Empty and load the dishwasher', 4],
  ['bathroom', 'Clean bathroom', 7],
  ['own-trash-day', 'Take out the trash', 2],
  ['dogs', 'Take the dogs out', 3],
  ['dogs-feed', 'Feed the dogs', 2],
  ['dogs-water', "Fill the dogs' water", 2],
  ['kids-outside', 'Take the kids outside without being asked', 5],
  ['homework-no-reminders', 'Homework with no repeated reminders', 1],
  ['read-30', 'Read 30 minutes', 3],
  ['test-90', '90% or above on a test', 5],
  ['ready-bed', 'Go to bed on time', 3],
  ['help-food', 'Help with food', 2],
  ['meal-plan', 'Meal-plan one dinner', 3],
  ['adult-skill', 'Adult skill practice', 4],
  ['no-phone-focus', '30 minutes no-phone focus', 3],
  ['solo-meal', 'Solo planned family meal', 8, 'B'],
  ['watch-kids', 'Watch the kids', 5, 'B'],
  ['follow-through', 'Follow through on a commitment or goal', 5, 'B'],
  ['own-mistake', 'Own a mistake', 5, 'B'],
  ['teach-little', 'Teach a little a chore or skill', 6, 'B'],
  ['school-growth', 'School growth', 6, 'B'],
  ['fill-gas', 'Fill gas once', 3, 'B'],
  ['budget-errand', 'Budget a $20 errand', 4, 'B'],
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
  little: 21,
  teen: 34,
  conduct: 8,
  parent: 13,
}

/** Active acts per band. Retired acts are kept for history and not counted. */
export function countActsByBand(acts: readonly EarnAct[]): Record<Band, number> {
  const counts: Record<Band, number> = { little: 0, teen: 0, conduct: 0, parent: 0 }
  for (const act of acts) if (!act.retired) counts[act.band] += 1
  return counts
}
