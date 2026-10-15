import { ArrowLeftIcon, ChevronDownIcon, DownloadIcon, PencilIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm-provider'
import { CardDialog, DeckDialog } from '@/components/dialogs'
import { Pill } from '@/components/pill'
import { SpeakButton } from '@/components/speak-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { download, navigate, plural, relTime } from '@/lib/format'
import { langInfo } from '@/lib/languages'
import {
  deckCards,
  deckCounts,
  isDuplicate,
  makeCard,
  nextDue,
  parseBulk,
  update,
  useStore,
  type Card as CardType,
  type Deck,
  type Direction,
  type StudyMode,
} from '@/lib/store'

export function DeckView({ deck }: { deck: Deck }) {
  useStore()
  const confirm = useConfirm()
  const [editDeckOpen, setEditDeckOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CardType>()
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.title = `${deck.name} · LingoCards`
  }, [deck.name])

  const now = Date.now()
  const c = deckCounts(deck.id, now)
  const from = langInfo(deck.frontLang)
  const to = langInfo(deck.backLang)
  const cards = deckCards(deck.id).sort((a, b) => b.createdAt - a.createdAt)
  const toStudy = c.due + c.new
  const next = nextDue(deck.id, now)
  const q = query.trim().toLowerCase()
  const visible = q ? cards.filter(card => `${card.front} ${card.back} ${card.example}`.toLowerCase().includes(q)) : cards

  const deleteDeck = async () => {
    const ok = await confirm({
      title: `Delete “${deck.name}”?`,
      description: `This deletes the deck and its ${plural(cards.length, 'card')}. This can’t be undone.`,
      confirmLabel: 'Delete deck',
      destructive: true,
    })
    if (!ok) return
    navigate('#/')
    update(s => {
      s.decks = s.decks.filter(d => d.id !== deck.id)
      s.cards = s.cards.filter(card => card.deckId !== deck.id)
    })
    toast.success('Deck deleted')
  }

  const exportDeck = () => {
    const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ')
    const tsv = cards.map(card => [card.front, card.back, card.example].map(clean).join('\t')).join('\n')
    download(`${deck.name.replace(/[^\w-]+/g, '_')}.tsv`, tsv, 'text/tab-separated-values')
  }

  const deleteCard = async (card: CardType) => {
    const ok = await confirm({ title: `Delete “${card.front}”?`, confirmLabel: 'Delete', destructive: true })
    if (ok) update(s => (s.cards = s.cards.filter(x => x.id !== card.id)))
  }

  const setOption = (fields: Partial<Pick<Deck, 'direction' | 'mode'>>) => update(() => Object.assign(deck, fields))

  return (
    <div className="grid gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit text-muted-foreground">
        <a href="#/">
          <ArrowLeftIcon data-icon="inline-start" /> All decks
        </a>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-1 text-3xl" aria-hidden="true">
            {from.flag}
            <span className="text-base text-muted-foreground">→</span>
            {to.flag}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{deck.name}</h1>
          <p className="text-muted-foreground">
            {from.name} → {to.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditDeckOpen(true)}>
            <PencilIcon data-icon="inline-start" /> Edit
          </Button>
          <Button variant="outline" onClick={exportDeck} disabled={!cards.length}>
            <DownloadIcon data-icon="inline-start" /> Export
          </Button>
          <Button variant="destructive" onClick={deleteDeck}>
            <Trash2Icon data-icon="inline-start" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="new">{c.new} new today</Pill>
            <Pill tone="due">{c.due} due</Pill>
            <Pill>{c.unseen} unseen</Pill>
            <Pill tone="mature">{c.mature} mastered</Pill>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="direction">Direction</FieldLabel>
              <Select value={deck.direction} onValueChange={v => setOption({ direction: v as Direction })}>
                <SelectTrigger id="direction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">
                    {from.name} → {to.name}
                  </SelectItem>
                  <SelectItem value="reverse">
                    {to.name} → {from.name}
                  </SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="mode">Mode</FieldLabel>
              <Select value={deck.mode} onValueChange={v => setOption({ mode: v as StudyMode })}>
                <SelectTrigger id="mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flip">Flip cards</SelectItem>
                  <SelectItem value="type">Type the answer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toStudy ? (
              <Button asChild size="lg">
                <a href={`#/deck/${deck.id}/study`}>Study now ({toStudy})</a>
              </Button>
            ) : (
              <span className="text-muted-foreground">🎉 All caught up{next ? ` — next review ${relTime(next, now)}` : ''}.</span>
            )}
            {cards.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild size="lg" variant="outline">
                    <a href={`#/deck/${deck.id}/cram`}>Practice all</a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Review every card without affecting your schedule</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      <AddCardPanel deck={deck} />

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base" role="heading" aria-level={2}>
            Cards <span className="font-normal text-muted-foreground">({cards.length})</span>
          </CardTitle>
          {cards.length > 0 && (
            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search cards…" aria-label="Search cards" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {cards.length ? (
            <ul className="divide-y">
              {visible.map(card => (
                <CardRow key={card.id} card={card} deck={deck} now={now} onEdit={() => setEditingCard(card)} onDelete={() => deleteCard(card)} />
              ))}
              {!visible.length && <li className="py-3 text-muted-foreground">No cards match “{query}”.</li>}
            </ul>
          ) : (
            <p className="text-muted-foreground">No cards yet — add your first one above.</p>
          )}
        </CardContent>
      </Card>

      <DeckDialog deck={deck} open={editDeckOpen} onOpenChange={setEditDeckOpen} />
      <CardDialog card={editingCard} open={!!editingCard} onOpenChange={o => !o && setEditingCard(undefined)} />
    </div>
  )
}

function CardRow({ card, deck, now, onEdit, onDelete }: { card: CardType; deck: Deck; now: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[1fr_auto_auto]">
      <div className="grid min-w-0 gap-0.5">
        <strong className="font-semibold break-words">{card.front}</strong>
        <span className="break-words">{card.back}</span>
        {card.example && <em className="text-xs text-muted-foreground">{card.example}</em>}
      </div>
      {!card.seen ? <Pill tone="new">New</Pill> : card.due <= now ? <Pill tone="due">Due</Pill> : <Pill>{relTime(card.due, now)}</Pill>}
      <div className="col-span-2 flex justify-end sm:col-span-1">
        <SpeakButton text={card.front} lang={deck.frontLang} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Edit" className="text-muted-foreground" onClick={onEdit}>
              <PencilIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </li>
  )
}

function AddCardPanel({ deck }: { deck: Deck }) {
  const from = langInfo(deck.frontLang)
  const to = langInfo(deck.backLang)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')
  const [bulk, setBulk] = useState('')
  const frontRef = useRef<HTMLInputElement>(null)

  const addCard = (e: FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    if (isDuplicate(deck.id, front, back)) {
      toast.warning('That card is already in this deck')
      return
    }
    update(s => s.cards.push(makeCard(deck.id, front, back, example)))
    setFront('')
    setBack('')
    setExample('')
    frontRef.current?.focus()
    toast.success('Card added')
  }

  const importBulk = (e: FormEvent) => {
    e.preventDefault()
    const { rows, skipped } = parseBulk(bulk)
    let added = 0
    let dupes = 0
    update(s => {
      rows.forEach(([f, b, ex], i) => {
        if (isDuplicate(deck.id, f, b)) return dupes++
        s.cards.push(makeCard(deck.id, f, b, ex, i))
        added++
      })
    })
    setBulk('')
    const extra = [skipped && `${skipped} unreadable`, dupes && `${dupes} duplicate`].filter(Boolean).join(', ')
    toast.success(`Imported ${plural(added, 'card')}${extra ? ` (skipped ${extra})` : ''}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" role="heading" aria-level={2}>
          Add a card
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={addCard} autoComplete="off" className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <Input ref={frontRef} required value={front} onChange={e => setFront(e.target.value)} placeholder={`${from.name} (e.g. word or phrase)`} aria-label={from.name} />
          <Input required value={back} onChange={e => setBack(e.target.value)} placeholder={`${to.name} translation`} aria-label={`${to.name} translation`} />
          <Input value={example} onChange={e => setExample(e.target.value)} placeholder="Example sentence (optional)" aria-label="Example sentence" />
          <Button type="submit">Add</Button>
        </form>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group -ml-2 text-muted-foreground">
              <ChevronDownIcon data-icon="inline-start" className="transition-transform group-data-[state=open]:rotate-180" /> Bulk import
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <form onSubmit={importBulk} className="mt-2 grid gap-3">
              <Field>
                <FieldDescription>
                  One card per line: <code className="rounded bg-muted px-1">front ; back ; example</code>. Tab-separated (from a spreadsheet) or{' '}
                  <code className="rounded bg-muted px-1">front = back</code> also work.
                </FieldDescription>
                <Textarea
                  rows={6}
                  value={bulk}
                  onChange={e => setBulk(e.target.value)}
                  placeholder={'la manzana ; apple ; Me como una manzana.\nel queso ; cheese'}
                  aria-label="Cards to import"
                />
              </Field>
              <Button type="submit" variant="outline" className="w-fit" disabled={!bulk.trim()}>
                Import cards
              </Button>
            </form>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
