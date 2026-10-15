/*
 * Spaced-repetition scheduling (SM-2 variant, similar to Anki) and answer checking.
 * Pure functions only — usable in the browser and in tests.
 */

export const DAY = 24 * 60 * 60 * 1000
export const MINUTE = 60 * 1000
const MIN_EASE = 1.3
export const GRADES = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 } as const
export type Grade = (typeof GRADES)[keyof typeof GRADES]

export interface CardState {
  ease: number
  interval: number
  reps: number
  lapses: number
  due: number
  seen: boolean
  lastReview?: number
}

export interface SchedulableCard extends CardState {
  createdAt: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function newCardState(): CardState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, seen: false }
}

export function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Midnight `days` days after `ts`, DST-safe.
export function addDays(ts: number, days: number) {
  const d = new Date(startOfDay(ts))
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** Returns a new card object with updated scheduling fields. */
export function schedule<T extends Partial<CardState>>(card: T, grade: number, now = Date.now()): T & CardState {
  let { ease = 2.5, interval = 0, reps = 0 } = card
  const { lapses = 0 } = card
  const base = { ...card, seen: true, lastReview: now }

  if (grade === GRADES.AGAIN) {
    // Forgotten: relearn shortly, reset the ladder.
    return {
      ...base,
      ease: Math.max(MIN_EASE, round2(ease - 0.2)),
      interval: 0,
      reps: 0,
      lapses: reps > 0 ? lapses + 1 : lapses,
      due: now + MINUTE,
    }
  }

  if (grade === GRADES.HARD) {
    interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2))
    ease = Math.max(MIN_EASE, ease - 0.15)
  } else if (grade === GRADES.GOOD) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease))
  } else if (grade === GRADES.EASY) {
    interval = reps === 0 ? 4 : Math.max(interval + 1, Math.round(interval * ease * 1.3))
    ease += 0.15
  } else {
    throw new Error(`Unknown grade: ${grade}`)
  }

  return { ...base, ease: round2(ease), interval, reps: reps + 1, lapses, due: addDays(now, interval) }
}

/** Due reviews (oldest first) followed by up to `newLimit` unseen cards. */
export function buildQueue<T extends SchedulableCard>(cards: T[], now = Date.now(), newLimit = Infinity): T[] {
  const due = cards.filter(c => c.seen && c.due <= now).sort((a, b) => a.due - b.due)
  const fresh = cards
    .filter(c => !c.seen)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, newLimit))
  return [...due, ...fresh]
}

export function formatDays(days: number) {
  if (days < 30) return `${days}d`
  if (days < 365) return `${+(days / 30).toFixed(1)}mo`
  return `${+(days / 365).toFixed(1)}y`
}

/** Short label for the interval a grade would produce, e.g. "1m", "3d", "2.5mo". */
export function previewLabel(card: Partial<CardState>, grade: number, now = Date.now()) {
  if (grade === GRADES.AGAIN) return '1m'
  return formatDays(schedule(card, grade, now).interval)
}

// ---------- answer checking ----------

const ARTICLES = /^(the|a|an|el|la|los|las|un|una|unos|unas|le|les|l|un|une|des|der|die|das|den|dem|des|ein|eine|einen|il|lo|gli|i|o|os|as|de|het|en|ett)\s+/

export function normalize(s: string) {
  return String(s)
    .normalize('NFC')
    .toLowerCase()
    .replace(/['’`´]/g, ' ')
    .replace(/[¡¿!?.,;:"«»„“”()[\]…]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
}

const stripArticle = (s: string) => s.replace(ARTICLES, '')

/** All acceptable spellings: "hello / hi" → ["hello / hi", "hello", "hi"]; also "to eat" → "eat", "(x)" removed. */
function alternatives(expected: string) {
  const raw = [expected, ...String(expected).split(/[/;]/)]
  const out = new Set<string>()
  for (const r of raw) {
    for (const v of [r, r.replace(/\([^)]*\)/g, '')]) {
      const n = normalize(v)
      if (!n) continue
      out.add(n)
      if (n.startsWith('to ')) out.add(n.slice(3))
    }
  }
  return [...out]
}

// Edit distance where swapping two adjacent letters counts as one typo.
export function editDistance(a: string, b: string) {
  if (a === b) return 0
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

export type AnswerResult =
  | { verdict: 'correct' | 'wrong'; reason?: undefined }
  | { verdict: 'almost'; reason: 'accents' | 'article' | 'typo' }

/** Compare a typed answer with the expected one. */
export function checkAnswer(input: string, expected: string): AnswerResult {
  const given = normalize(input)
  if (!given) return { verdict: 'wrong' }
  const options = alternatives(expected)

  if (options.includes(given)) return { verdict: 'correct' }

  const g = stripAccents(given)
  if (options.some(o => stripAccents(o) === g)) return { verdict: 'almost', reason: 'accents' }
  if (options.some(o => stripArticle(stripAccents(o)) === stripArticle(g))) return { verdict: 'almost', reason: 'article' }

  const typo = options.some(o => {
    const t = stripAccents(o)
    const allowed = t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0
    return allowed > 0 && editDistance(g, t) <= allowed
  })
  return typo ? { verdict: 'almost', reason: 'typo' } : { verdict: 'wrong' }
}
