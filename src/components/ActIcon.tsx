import { createElement } from 'react'
import { actIcon } from '@/lib/actIcons'

export function ActIcon({ actId, className }: { actId: string; className?: string }) {
  return createElement(actIcon(actId), { className, 'aria-hidden': true })
}
