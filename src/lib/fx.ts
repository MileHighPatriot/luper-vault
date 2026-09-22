/**
 * Star bursts for taps, approvals, unlocks, and surprises. Plain DOM +
 * Web Animations API, no library. Does nothing under reduced motion or
 * where `Element.animate` is missing.
 */

export const STAR_COLORS = ['#f0cd72', '#fff7de', '#7fd8b4', '#6fa0ff', '#c48af5']

export interface BurstOptions {
  count?: number
  colors?: string[]
  /** Max travel in px. */
  distance?: number
  /** Base particle size in px. */
  size?: number
  duration?: number
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

let layer: HTMLDivElement | null = null

function getLayer(): HTMLDivElement {
  if (!layer || !document.body.contains(layer)) {
    layer = document.createElement('div')
    layer.className = 'fx-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)
  }
  return layer
}

export function burst(x: number, y: number, options: BurstOptions = {}): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return
  if (typeof HTMLElement.prototype.animate !== 'function') return
  const { count = 14, colors = STAR_COLORS, distance = 90, size = 10, duration = 800 } = options
  const host = getLayer()
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('span')
    const star = i % 3 !== 0
    el.className = `fx-particle ${star ? 'fx-star' : 'fx-dot'}`
    const s = size * (0.6 + Math.random() * 0.8) * (star ? 1.4 : 0.7)
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.width = `${s}px`
    el.style.height = `${s}px`
    el.style.background = colors[i % colors.length]!
    host.appendChild(el)
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6
    const travel = distance * (0.45 + Math.random() * 0.75)
    const dx = Math.cos(angle) * travel
    const dy = Math.sin(angle) * travel - distance * 0.15
    const spin = (Math.random() - 0.5) * 360
    const animation = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1.1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 24}px)) scale(0.2) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: duration * (0.8 + Math.random() * 0.4), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
    animation.onfinish = () => el.remove()
  }
}

/** Burst from the center of an element (e.g. the button that was tapped). */
export function burstFrom(target: Element | null | undefined, options?: BurstOptions): void {
  if (!target) return
  const rect = target.getBoundingClientRect()
  burst(rect.left + rect.width / 2, rect.top + rect.height / 2, options)
}
