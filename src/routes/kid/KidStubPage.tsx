import { Gift, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const COPY = {
  rewards: {
    icon: Gift,
    title: 'Rewards',
    body: 'When a vault fills, the family picks a reward together. The reward menu arrives in Phase 5.',
  },
  wins: {
    icon: Trophy,
    title: 'Wins',
    body: 'A running log of what the family has unlocked. Coming in Phase 5.',
  },
} as const

/** KID-FACING placeholder for Phase 5 screens. No data, no buttons. */
export function KidStubPage({ kind }: { kind: keyof typeof COPY }) {
  const { icon: Icon, title, body } = COPY[kind]
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Badge variant="outline">Phase 5</Badge>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Icon className="size-6" aria-hidden />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </div>
  )
}
