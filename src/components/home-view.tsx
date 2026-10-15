import { CheckIcon, PlusIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { DeckDialog } from '@/components/dialogs'
import { Pill } from '@/components/pill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { dayKey, plural } from '@/lib/format'
import { langInfo } from '@/lib/languages'
import { currentStreak, deckCounts, useStore, type Deck } from '@/lib/store'

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card size="sm" className="gap-1 text-center">
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

export function HomeView() {
  const state = useStore()
  const [newDeckOpen, setNewDeckOpen] = useState(false)
  useEffect(() => {
    document.title = 'LingoCards'
  }, [])

  const now = Date.now()
  const counts = state.decks.map(d => deckCounts(d.id, now))
  const due = counts.reduce((n, c) => n + c.due + c.new, 0)

  return (
    <div className="grid gap-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="To study today" value={due} />
        <Stat label="Day streak" value={`${currentStreak()} 🔥`} />
        <Stat label="Reviewed today" value={state.stats.reviews[dayKey()] || 0} />
        <Stat label="Cards learned" value={`${state.cards.filter(c => c.seen).length} / ${state.cards.length}`} />
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Your decks</h1>
          <Button onClick={() => setNewDeckOpen(true)}>
            <PlusIcon data-icon="inline-start" /> New deck
          </Button>
        </div>

        {state.decks.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.decks.map((d, i) => (
              <DeckTile key={d.id} deck={d} counts={counts[i]} />
            ))}
          </div>
        ) : (
          <Card className="items-center py-12 text-center">
            <CardContent className="grid justify-items-center gap-4">
              <p className="text-muted-foreground">No decks yet.</p>
              <Button onClick={() => setNewDeckOpen(true)}>Create your first deck</Button>
            </CardContent>
          </Card>
        )}
      </section>

      <DeckDialog open={newDeckOpen} onOpenChange={setNewDeckOpen} />
    </div>
  )
}

function DeckTile({ deck, counts: c }: { deck: Deck; counts: ReturnType<typeof deckCounts> }) {
  const from = langInfo(deck.frontLang)
  const to = langInfo(deck.backLang)
  const toStudy = c.due + c.new

  return (
    <Card className="relative transition-shadow hover:shadow-md">
      <CardHeader>
        <a href={`#/deck/${deck.id}`} className="grid gap-1.5 outline-none after:absolute after:inset-0 focus-visible:underline">
          <div className="flex items-center gap-1 text-2xl" aria-hidden="true">
            {from.flag}
            <span className="text-sm text-muted-foreground">→</span>
            {to.flag}
          </div>
          <CardTitle className="text-lg">
            <h2>{deck.name}</h2>
          </CardTitle>
          <CardDescription>
            {from.name} → {to.name} · {plural(c.total, 'card')}
          </CardDescription>
        </a>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        <Pill tone="new">{c.new} new</Pill>
        <Pill tone="due">{c.due} due</Pill>
        {c.mature > 0 && <Pill tone="mature">{c.mature} mastered</Pill>}
      </CardContent>
      <CardFooter className="relative mt-auto">
        {toStudy ? (
          <Button asChild className="w-full">
            <a href={`#/deck/${deck.id}/study`}>Study {toStudy}</a>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <a href={`#/deck/${deck.id}`}>
              All caught up <CheckIcon data-icon="inline-end" />
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
