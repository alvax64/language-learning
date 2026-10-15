import { CheckIcon, XIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Stat } from '@/components/home-view'
import { SpeakButton } from '@/components/speak-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { relTime, shuffle } from '@/lib/format'
import { langInfo } from '@/lib/languages'
import { speak } from '@/lib/speech'
import * as SRS from '@/lib/srs'
import { setStudyCard } from '@/lib/tutor-context'
import { currentStreak, deckCards, getCard, getState, newRemaining, nextDue, recordReview, update, useStore, type Deck } from '@/lib/store'
import { cn } from '@/lib/utils'

const { GRADES } = SRS

interface Session {
  queue: { id: string; reverse: boolean }[]
  total: number
  finished: number
  firstTry: number
  missed: Set<string>
  turn: number
}

interface Reveal {
  flipped: boolean
  showBack: boolean
  suggested: SRS.Grade | null
  result: (SRS.AnswerResult & { input: string }) | null
}

const HIDDEN: Reveal = { flipped: false, showBack: false, suggested: null, result: null }

const GRADE_BUTTONS = [
  { label: 'Again', grade: GRADES.AGAIN, className: 'border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400', ring: 'ring-red-500' },
  { label: 'Hard', grade: GRADES.HARD, className: 'border-orange-500/40 text-orange-700 hover:bg-orange-500/10 dark:text-orange-400', ring: 'ring-orange-500' },
  { label: 'Good', grade: GRADES.GOOD, className: 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400', ring: 'ring-emerald-500' },
  { label: 'Easy', grade: GRADES.EASY, className: 'border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400', ring: 'ring-sky-500' },
]

const ALMOST_REASONS = { accents: 'watch the accents', article: 'don’t forget the article', typo: 'small typo' }

function startSession(deck: Deck, cram: boolean): Session {
  const cards = deckCards(deck.id)
  const items = cram ? shuffle(cards.slice()) : SRS.buildQueue(cards, Date.now(), newRemaining(deck.id))
  const reverse = () => deck.direction === 'reverse' || (deck.direction === 'mixed' && Math.random() < 0.5)
  return { queue: items.map(c => ({ id: c.id, reverse: reverse() })), total: items.length, finished: 0, firstTry: 0, missed: new Set(), turn: 0 }
}

export function StudyView({ deck, cram }: { deck: Deck; cram: boolean }) {
  const { settings } = useStore()
  const [session, setSession] = useState(() => startSession(deck, cram))
  const [rv, setRv] = useState<Reveal>(HIDDEN)

  useEffect(() => {
    document.title = `Studying ${deck.name} · LingoCards`
  }, [deck.name])

  // Skip cards that were deleted mid-session.
  const queue = session.queue.filter(i => getCard(i.id))
  const item = queue[0]
  const card = item && getCard(item.id)!
  const side = card && (item.reverse
    ? { q: card.back, a: card.front, qLang: deck.backLang, aLang: deck.frontLang }
    : { q: card.front, a: card.back, qLang: deck.frontLang, aLang: deck.backLang })

  useEffect(() => {
    if (side && settings.autoSpeak && side.qLang === deck.frontLang) speak(side.q, side.qLang)
  }, [session.turn])

  // Let the AI tutor see the card on screen.
  useEffect(() => {
    setStudyCard(side ? { deckId: deck.id, q: side.q, a: side.a, example: card.example, flipped: rv.flipped } : null)
  })
  useEffect(() => () => setStudyCard(null), [])

  const reveal = (patch: Partial<Reveal> = {}) => {
    if (!side || rv.flipped) return
    setRv({ ...HIDDEN, ...patch, flipped: true, showBack: true })
    if (settings.autoSpeak && side.aLang === deck.frontLang) speak(side.a, side.aLang)
  }

  const checkTyped = (value: string) => {
    const result = SRS.checkAnswer(value, side!.a)
    const suggested = ({ correct: GRADES.GOOD, almost: GRADES.HARD, wrong: GRADES.AGAIN } as const)[result.verdict]
    reveal({ result: { ...result, input: value.trim() }, suggested })
  }

  // Giving up in type mode counts as a wrong answer.
  const giveUp = () => (deck.mode === 'type' ? checkTyped('') : reveal())

  const grade = (g: number) => {
    if (!card || !rv.flipped) return
    const wasNew = !card.seen
    update(s => {
      if (!cram) Object.assign(card, SRS.schedule(card, g))
      recordReview(s, deck.id, wasNew && !cram)
    })
    const [current, ...rest] = queue
    const next = { ...session, queue: rest, turn: session.turn + 1 }
    if (g === GRADES.AGAIN) {
      // Show it again a few cards later.
      next.missed = new Set(session.missed).add(current.id)
      rest.splice(Math.min(rest.length, 3), 0, current)
    } else {
      next.finished++
      if (!session.missed.has(current.id)) next.firstTry++
    }
    setSession(next)
    setRv(HIDDEN)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      const target = e.target as HTMLElement
      if (target.matches('input, textarea, select, button, [role="combobox"]') || e.ctrlKey || e.metaKey || e.altKey) return
      const isSpace = e.code === 'Space' || e.key === ' '

      if (!rv.flipped) {
        if (isSpace || e.key === 'Enter') {
          e.preventDefault()
          giveUp()
        }
        return
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        grade(Number(e.key) - 1)
      } else if (e.key === 'Enter' || isSpace) {
        e.preventDefault()
        grade(rv.suggested ?? GRADES.GOOD)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!card || !side) return <Summary deck={deck} cram={cram} session={session} />

  const pct = session.total ? Math.round((session.finished / session.total) * 100) : 0
  const ql = langInfo(side.qLang)
  const al = langInfo(side.aLang)

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" aria-label="End session">
              <a href={`#/deck/${deck.id}`}>
                <XIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>End session</TooltipContent>
        </Tooltip>
        <Progress value={pct} className="h-2 flex-1" aria-label="Session progress" />
        <span className="text-sm text-muted-foreground tabular-nums">
          {session.finished} / {session.total}
        </span>
      </div>
      {cram && <p className="text-center text-sm text-muted-foreground">Practice mode — your review schedule won’t change.</p>}

      <div className="perspective-[1400px]">
        <div
          role="button"
          tabIndex={-1}
          aria-label={rv.flipped ? 'Flip card' : 'Reveal answer'}
          onClick={() => (rv.flipped ? setRv({ ...rv, showBack: !rv.showBack }) : giveUp())}
          className={cn(
            'relative h-72 cursor-pointer transition-transform duration-500 ease-[cubic-bezier(.3,.7,.3,1)] transform-3d motion-reduce:transition-none sm:h-80',
            rv.showBack && 'rotate-y-180',
          )}
        >
          <Face>
            <span className="absolute top-4 left-4 text-xs text-muted-foreground">
              {ql.flag} {ql.name}
            </span>
            {!card.seen && !cram && <Badge className="absolute top-4 left-1/2 -translate-x-1/2">New</Badge>}
            <div className="text-[clamp(1.8rem,6vw,2.6rem)] font-bold break-words">{side.q}</div>
            <SpeakButton text={side.q} lang={side.qLang} className="absolute top-3 right-3" />
            {deck.mode === 'flip' && (
              <p className="absolute bottom-4 text-sm text-muted-foreground">
                Click or press <Kbd>Space</Kbd> to reveal
              </p>
            )}
          </Face>
          <Face back>
            <span className="absolute top-4 left-4 text-xs text-muted-foreground">
              {al.flag} {al.name}
            </span>
            <div className="text-muted-foreground">{side.q}</div>
            <div className="text-[clamp(1.8rem,6vw,2.6rem)] font-bold break-words text-primary">{side.a}</div>
            {card.example && <p className="max-w-[90%] text-muted-foreground italic">“{card.example}”</p>}
            <SpeakButton text={side.a} lang={side.aLang} className="absolute top-3 right-3" />
          </Face>
        </div>
      </div>

      <div className="flex min-h-32 flex-col items-center gap-3">
        {!rv.flipped ? (
          deck.mode === 'type' ? (
            <AnswerForm key={session.turn} onSubmit={checkTyped} onGiveUp={giveUp} />
          ) : (
            <Button size="lg" onClick={giveUp}>
              Show answer <Kbd className="bg-primary-foreground/20 text-primary-foreground">Space</Kbd>
            </Button>
          )
        ) : (
          <>
            {rv.result && <Feedback result={rv.result} answer={side.a} />}
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADE_BUTTONS.map(b => (
                <Button
                  key={b.grade}
                  variant="outline"
                  onClick={() => grade(b.grade)}
                  className={cn('h-auto flex-col gap-0.5 py-2.5', b.className, rv.suggested === b.grade && `ring-2 ${b.ring}`)}
                >
                  <span className="font-semibold">{b.label}</span>
                  {!cram && <span className="text-xs opacity-80">{SRS.previewLabel(card, b.grade)}</span>}
                  <Kbd>{b.grade + 1}</Kbd>
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              How well did you know it? Press <Kbd>1</Kbd>–<Kbd>4</Kbd>
              {rv.suggested !== null && (
                <>
                  {' '}
                  or <Kbd>Enter</Kbd> for the highlighted choice
                </>
              )}
              .
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Face({ back, children }: { back?: boolean; children: React.ReactNode }) {
  return (
    <Card
      className={cn(
        'absolute inset-0 items-center justify-center gap-2 px-6 py-10 text-center shadow-sm backface-hidden',
        back && 'rotate-y-180',
      )}
    >
      {children}
    </Card>
  )
}

function AnswerForm({ onSubmit, onGiveUp }: { onSubmit: (value: string) => void; onGiveUp: () => void }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(value)
  }
  return (
    <form onSubmit={submit} autoComplete="off" className="flex w-full flex-wrap gap-2">
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Type the translation…"
        aria-label="Your answer"
        autoCapitalize="off"
        spellCheck={false}
        className="h-10 min-w-56 flex-1 text-base"
      />
      <Button type="submit" size="lg" className="h-10">
        Check
      </Button>
      <Button type="button" variant="ghost" size="lg" className="h-10" onClick={onGiveUp}>
        I don’t know
      </Button>
    </form>
  )
}

function Feedback({ result: r, answer }: { result: NonNullable<Reveal['result']>; answer: string }) {
  if (r.verdict === 'correct') {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2.5 font-medium text-emerald-700 dark:text-emerald-300">
        <CheckIcon className="size-4" /> Correct!
      </div>
    )
  }
  if (r.verdict === 'almost') {
    return (
      <div className="w-full rounded-lg bg-amber-500/15 px-4 py-2.5 text-center text-amber-800 dark:text-amber-200">
        ≈ Almost — {ALMOST_REASONS[r.reason]}. You wrote <strong>{r.input}</strong>, answer: <strong>{answer}</strong>
      </div>
    )
  }
  return (
    <div className="w-full rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-destructive">
      ✗{' '}
      {r.input ? (
        <>
          You wrote <strong>{r.input}</strong>
        </>
      ) : (
        'No answer'
      )}{' '}
      — answer: <strong>{answer}</strong>
    </div>
  )
}

function Summary({ deck, cram, session: s }: { deck: Deck; cram: boolean; session: Session }) {
  const empty = s.total === 0
  const acc = s.finished ? Math.round((s.firstTry / s.finished) * 100) : 0
  const next = nextDue(deck.id)
  const hasCards = getState().cards.some(c => c.deckId === deck.id)

  return (
    <Card className="mx-auto w-full max-w-xl text-center">
      <CardContent className="grid justify-items-center gap-4 py-6">
        <div className="text-5xl">{empty ? '☕' : '🎉'}</div>
        <h1 className="text-2xl font-bold tracking-tight">{empty ? 'Nothing to review right now' : 'Session complete!'}</h1>
        {empty ? (
          <p className="text-muted-foreground">
            {!hasCards ? 'Add some cards to get started.' : next ? `Next review ${relTime(next)}.` : 'You’ve reached today’s limit for new cards.'}
          </p>
        ) : (
          <>
            <div className="grid w-full grid-cols-3 gap-3">
              <Stat label="Cards reviewed" value={s.finished} />
              <Stat label="First-try accuracy" value={`${acc}%`} />
              <Stat label="Day streak" value={`${currentStreak()} 🔥`} />
            </div>
            {!cram && next && <p className="text-muted-foreground">Next review {relTime(next)}.</p>}
          </>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href={`#/deck/${deck.id}`}>Back to deck</a>
          </Button>
          <Button asChild variant="outline">
            {empty && hasCards ? <a href={`#/deck/${deck.id}/cram`}>Practice all anyway</a> : <a href="#/">All decks</a>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
