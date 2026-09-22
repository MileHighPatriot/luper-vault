/**
 * Tiny WebAudio cues for the Constellation Crew skin: soft tap, approve
 * chime, surprise swell. No audio files. Callers pass `muted` from
 * Settings (Phase 8); when muted nothing is scheduled. Safe to call in
 * environments without AudioContext (tests, old browsers): it just no-ops.
 */

export type SoundName = 'tap' | 'approve' | 'surprise'

type Note = { at: number; freq: number; dur: number; gain?: number; type?: OscillatorType }

const CUES: Record<SoundName, Note[]> = {
  tap: [{ at: 0, freq: 660, dur: 0.07, gain: 0.05, type: 'triangle' }],
  approve: [
    { at: 0, freq: 587.33, dur: 0.12, gain: 0.06 },
    { at: 0.11, freq: 880, dur: 0.22, gain: 0.06 },
  ],
  surprise: [
    { at: 0, freq: 392, dur: 0.18, gain: 0.05 },
    { at: 0.12, freq: 523.25, dur: 0.18, gain: 0.055 },
    { at: 0.24, freq: 659.25, dur: 0.22, gain: 0.06 },
    { at: 0.36, freq: 783.99, dur: 0.42, gain: 0.065 },
  ],
}

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    context ??= new Ctor()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** Play a cue unless muted. Must be triggered from a user gesture on most browsers. */
export function playSound(name: SoundName, muted: boolean): void {
  if (muted) return
  const ctx = getContext()
  if (!ctx) return
  const start = ctx.currentTime + 0.01
  for (const note of CUES[name]) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = note.type ?? 'sine'
    osc.frequency.value = note.freq
    const t0 = start + note.at
    const peak = note.gain ?? 0.05
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(peak, t0 + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur)
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + note.dur + 0.02)
  }
}
