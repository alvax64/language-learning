import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm-provider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator, FieldSet, FieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { dayKey, download, navigate, plural } from '@/lib/format'
import { LANGUAGES, langInfo } from '@/lib/languages'
import { canSpeak } from '@/lib/speech'
import * as SRS from '@/lib/srs'
import { freshState, getState, makeDeck, normalizeState, replaceState, update, type Card, type Deck } from '@/lib/store'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DialogActions({ label }: { label: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </DialogClose>
      <Button type="submit">{label}</Button>
    </DialogFooter>
  )
}

function LanguageSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map(([code, name, flag]) => (
          <SelectItem key={code} value={code}>
            {flag} {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------- deck ----------

export function DeckDialog({ deck, ...props }: DialogProps & { deck?: Deck }) {
  return (
    <Dialog {...props}>
      <DialogContent>
        <DeckForm deck={deck} onDone={() => props.onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function DeckForm({ deck, onDone }: { deck?: Deck; onDone: () => void }) {
  const [name, setName] = useState(deck?.name ?? '')
  const [frontLang, setFrontLang] = useState(deck?.frontLang ?? 'es-ES')
  const [backLang, setBackLang] = useState(deck?.backLang ?? 'en-US')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const fields = { name: trimmed, frontLang, backLang }
    if (deck) {
      update(() => Object.assign(deck, fields))
    } else {
      const d = makeDeck(fields)
      update(s => s.decks.push(d))
      navigate(`#/deck/${d.id}`)
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>{deck ? 'Edit deck' : 'New deck'}</DialogTitle>
        <DialogDescription>{deck ? 'Rename the deck or change its languages.' : 'Pick a name and the languages for your new deck.'}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="deck-name">Deck name</FieldLabel>
          <Input id="deck-name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Italian – Food" autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="deck-front">Language you’re learning</FieldLabel>
          <LanguageSelect id="deck-front" value={frontLang} onChange={setFrontLang} />
        </Field>
        <Field>
          <FieldLabel htmlFor="deck-back">Translate into</FieldLabel>
          <LanguageSelect id="deck-back" value={backLang} onChange={setBackLang} />
        </Field>
      </FieldGroup>
      <DialogActions label={deck ? 'Save' : 'Create deck'} />
    </form>
  )
}

// ---------- card ----------

export function CardDialog({ card, ...props }: DialogProps & { card?: Card }) {
  return (
    <Dialog {...props}>
      <DialogContent>{card && <CardForm card={card} onDone={() => props.onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function CardForm({ card, onDone }: { card: Card; onDone: () => void }) {
  const deck = getState().decks.find(d => d.id === card.deckId)!
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [example, setExample] = useState(card.example)
  const [reset, setReset] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    update(() => {
      Object.assign(card, { front: front.trim(), back: back.trim(), example: example.trim() })
      if (reset) Object.assign(card, SRS.newCardState())
    })
    toast.success('Card updated')
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>Edit card</DialogTitle>
        <DialogDescription>Update the card’s text or reset its progress.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="card-front">{langInfo(deck.frontLang).name}</FieldLabel>
          <Input id="card-front" required value={front} onChange={e => setFront(e.target.value)} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="card-back">{langInfo(deck.backLang).name}</FieldLabel>
          <Input id="card-back" required value={back} onChange={e => setBack(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="card-example">Example sentence</FieldLabel>
          <Input id="card-example" value={example} onChange={e => setExample(e.target.value)} />
        </Field>
        {card.seen && (
          <Field orientation="horizontal">
            <Checkbox id="card-reset" checked={reset} onCheckedChange={v => setReset(v === true)} />
            <FieldLabel htmlFor="card-reset" className="font-normal">
              Reset learning progress
            </FieldLabel>
          </Field>
        )}
      </FieldGroup>
      <DialogActions label="Save" />
    </form>
  )
}

// ---------- settings ----------

export function SettingsDialog(props: DialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent>
        <SettingsForm onDone={() => props.onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const confirm = useConfirm()
  const st = getState().settings
  const [newPerDay, setNewPerDay] = useState(String(st.newPerDay))
  const [autoSpeak, setAutoSpeak] = useState(st.autoSpeak)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update(s => {
      s.settings.newPerDay = Math.max(0, Math.min(999, parseInt(newPerDay, 10) || 0))
      s.settings.autoSpeak = autoSpeak
    })
    toast.success('Settings saved')
    onDone()
  }

  const importBackup = () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' })
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return
      let data
      try {
        data = normalizeState(JSON.parse(await file.text()))
      } catch {
        toast.error('That file isn’t a valid LingoCards backup')
        return
      }
      const ok = await confirm({
        title: 'Restore this backup?',
        description: `All current data will be replaced with this backup (${plural(data.decks.length, 'deck')}, ${plural(data.cards.length, 'card')}).`,
        confirmLabel: 'Replace data',
        destructive: true,
      })
      if (!ok) return
      replaceState(data)
      onDone()
      navigate('#/')
      toast.success('Backup restored')
    })
    input.click()
  }

  const resetAll = async () => {
    const ok = await confirm({
      title: 'Reset everything?',
      description: 'This deletes all decks, cards and progress and restores the starter decks.',
      confirmLabel: 'Reset everything',
      destructive: true,
    })
    if (!ok) return
    replaceState(freshState())
    onDone()
    navigate('#/')
    toast.success('All data reset')
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Adjust your daily goals and manage your data.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-per-day">New cards per day (per deck)</FieldLabel>
          <Input id="new-per-day" type="number" min={0} max={999} required value={newPerDay} onChange={e => setNewPerDay(e.target.value)} />
        </Field>
        {canSpeak && (
          <Field orientation="horizontal">
            <Switch id="auto-speak" checked={autoSpeak} onCheckedChange={setAutoSpeak} />
            <FieldLabel htmlFor="auto-speak" className="font-normal">
              Automatically play pronunciation
            </FieldLabel>
          </Field>
        )}
        <FieldSeparator />
        <FieldSet>
          <FieldLegend>Your data</FieldLegend>
          <FieldDescription>Everything is stored locally in this browser. Export a backup to move it to another device.</FieldDescription>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => download(`lingocards-backup-${dayKey()}.json`, JSON.stringify(getState(), null, 2), 'application/json')}>
              Export backup
            </Button>
            <Button type="button" variant="outline" onClick={importBackup}>
              Import backup
            </Button>
            <Button type="button" variant="destructive" onClick={resetAll}>
              Reset everything
            </Button>
          </div>
        </FieldSet>
      </FieldGroup>
      <DialogActions label="Save" />
    </form>
  )
}
