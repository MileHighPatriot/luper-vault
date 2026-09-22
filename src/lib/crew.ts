/**
 * Crew look per person: planet color and a playful callsign. Skin only; no
 * points or rankings live here. Edit freely.
 */

export interface CrewStyle {
  callsign: string
  color: string
}

const CREW: Record<string, CrewStyle> = {
  kameron: { callsign: 'Comet Pilot', color: '#7fd8b4' },
  alea: { callsign: 'Nova Navigator', color: '#f4a7c8' },
  christopher: { callsign: 'Orion Commander', color: '#6fa0ff' },
  admin: { callsign: 'Ground Control', color: '#f0cd72' },
}

const FALLBACK: CrewStyle = { callsign: 'Crew member', color: '#c48af5' }

export function crewStyle(userId: string | undefined | null): CrewStyle {
  return (userId && CREW[userId]) || FALLBACK
}

/** Greeting by Denver hour. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Night watch'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Night watch'
}
