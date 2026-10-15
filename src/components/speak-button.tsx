import { Volume2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { canSpeak, speak } from '@/lib/speech'
import { cn } from '@/lib/utils'

export function SpeakButton({ text, lang, className }: { text: string; lang: string; className?: string }) {
  if (!canSpeak) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Listen"
          className={cn('text-muted-foreground', className)}
          onClick={e => {
            e.stopPropagation()
            speak(text, lang)
          }}
        >
          <Volume2Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Listen</TooltipContent>
    </Tooltip>
  )
}
