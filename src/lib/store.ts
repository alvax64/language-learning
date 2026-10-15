/* App state: decks, cards, settings and stats, persisted to localStorage. */
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { dayKey, uid, yesterdayKey } from './format'
import { SEED_DECKS } from './seed'
import * as SRS from './srs'

const STORAGE_KEY = 'lingocards:v1'

export type Direction = 'forward' | 'reverse' | 'mixed'
export type StudyMode = 'flip' | 'type'

export interface Deck {
  id: string
  name: string
  frontLang: string
  backLang: string
  direction: Direction
  mode: StudyMode
  createdAt: number
}

export interface Card extends SRS.CardState {
  id: string
  deckId: string
  front: string
  back: string
  example: string
  createdAt: number
}

export interface Settings {
  newPerDay: number
  autoSpeak: boolean
}

export interface Stats {
  streak: number
  lastDay: string | null
  reviews: Record<string, number>
  newCards: Record<string, Record<string, number>>
}

export interface AppState {
  version: 1
  decks: Deck[]
  cards: Card[]
  settings: Settings
  stats: Stats
}

const DEFAULT_SETTINGS: Settings = { newPerDay: 15, autoSpeak: false }
const DEFAULT_STATS: Stats = { streak: 0, lastDay: null, reviews: {}, newCards: {} }

export function makeDeck({ name, frontLang, backLang }: Pick<Deck, 'name' | 'frontLang' | 'backLang'>): Deck {
  return { id: uid(), name, frontLang, backLang, direction: 'forward', mode: 'flip', createdAt: Date.now() }
}

export function makeCard(deckId: string, front: string, back: string, example = '', order = 0): Card {
  return {
    id: uid(),
    deckId,
    front: front.trim(),
    back: back.trim(),
    example: (example || '').trim(),
    ...SRS.newCardState(),
    createdAt: Date.now() + order,
  }
}

export function freshState(): AppState {
  const s: AppState = { version: 1, decks: [], cards: [], settings: { ...DEFAULT_SETTINGS }, stats: structuredClone(DEFAULT_STATS) }
  for (const seed of SEED_DECKS) {
    const deck = makeDeck(seed)
    s.decks.push(deck)
    seed.cards.forEach(([front, back, example], i) => s.cards.push(makeCard(deck.id, front, back, example, i)))
  }
  return s
}

export function normalizeState(s: AppState): AppState {
  if (!s || !Array.isArray(s.decks) || !Array.isArray(s.cards)) throw new Error('Invalid data')
  s.settings = { ...DEFAULT_SETTINGS, ...s.settings }
  s.stats = { ...structuredClone(DEFAULT_STATS), ...s.stats }
  // Only today's new-card counts matter for the daily limit.
  const today = dayKey()
  s.stats.newCards = { [today]: s.stats.newCards[today] || {} }
  return s
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeState(JSON.parse(raw))
  } catch (err) {
    console.warn('Could not read saved data, starting fresh', err)
  }
  return freshState()
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    toast.error('Could not save — storage may be full')
  }
}

// ---------- store ----------

let state = load()
save()

const listeners = new Set<() => void>()

/** Mutate the state in place, then persist and re-render. */
export function update(mutate: (s: AppState) => void) {
  mutate(state)
  state = { ...state }
  save()
  listeners.forEach(l => l())
}

export function replaceState(next: AppState) {
  update(s => Object.assign(s, next))
}

export const getState = () => state

export function useStore() {
  return useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getState,
  )
}

// ---------- queries ----------

export const getDeck = (id: string | undefined) => state.decks.find(d => d.id === id)
export const getCard = (id: string) => state.cards.find(c => c.id === id)
export const deckCards = (deckId: string) => state.cards.filter(c => c.deckId === deckId)

export function newRemaining(deckId: string) {
  const introduced = state.stats.newCards[dayKey()]?.[deckId] || 0
  return Math.max(0, state.settings.newPerDay - introduced)
}

export function deckCounts(deckId: string, now = Date.now()) {
  const cards = deckCards(deckId)
  const unseen = cards.filter(c => !c.seen).length
  return {
    total: cards.length,
    due: cards.filter(c => c.seen && c.due <= now).length,
    new: Math.min(unseen, newRemaining(deckId)),
    unseen,
    mature: cards.filter(c => c.interval >= 21).length,
  }
}

export function nextDue(deckId: string, now = Date.now()) {
  const upcoming = deckCards(deckId).filter(c => c.seen && c.due > now).map(c => c.due)
  return upcoming.length ? Math.min(...upcoming) : null
}

export function currentStreak() {
  const { streak, lastDay } = state.stats
  return lastDay === dayKey() || lastDay === yesterdayKey() ? streak : 0
}

export const isDuplicate = (deckId: string, front: string, back: string) =>
  deckCards(deckId).some(c => c.front.toLowerCase() === front.trim().toLowerCase() && c.back.toLowerCase() === back.trim().toLowerCase())

// ---------- mutations ----------

export function recordReview(s: AppState, deckId: string, wasNew: boolean) {
  const st = s.stats
  const today = dayKey()
  st.reviews[today] = (st.reviews[today] || 0) + 1
  if (wasNew) {
    const counts = (st.newCards[today] ||= {})
    counts[deckId] = (counts[deckId] || 0) + 1
  }
  if (st.lastDay !== today) {
    st.streak = st.lastDay === yesterdayKey() ? st.streak + 1 : 1
    st.lastDay = today
  }
}

export function parseBulk(text: string) {
  const rows: string[][] = []
  let skipped = 0
  for (const line of text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
    const parts = (line.includes('\t') ? line.split('\t') : line.includes(';') ? line.split(';') : line.split(/\s+[=–—-]\s+/)).map(p => p.trim())
    if (parts.length >= 2 && parts[0] && parts[1]) rows.push(parts)
    else skipped++
  }
  return { rows, skipped }
}
