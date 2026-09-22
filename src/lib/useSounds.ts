import { useCallback } from 'react'
import { useRepositoryValue } from '@/data/RepositoryContext'
import { playSound, type SoundName } from './sound'

/** Sound cues that honor Admin → Settings → Kid sounds. */
export function useSounds(): (name: SoundName) => void {
  const muted = useRepositoryValue((r) => r.getFamilySettings().muteKidSounds)
  return useCallback((name: SoundName) => playSound(name, muted), [muted])
}
