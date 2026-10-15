import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TONES = {
  new: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  due: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  mature: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  neutral: '',
}

export function Pill({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <Badge variant="secondary" className={cn(TONES[tone])}>
      {children}
    </Badge>
  )
}
