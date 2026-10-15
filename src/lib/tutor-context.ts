/* What the AI tutor knows about where the learner is. */
import { langInfo } from './languages'
import { getDeck, getState } from './store'

interface StudyCard {
  deckId: string
  q: string
  a: string
  example: string
  flipped: boolean
}

let studyCard: StudyCard | null = null

/** Called by the study view whenever the visible card or its revealed state changes. */
export function setStudyCard(card: StudyCard | null) {
  studyCard = card
}

export function tutorContext() {
  const state = getState()
  const lines = [`Decks: ${state.decks.map(d => `${d.name} (${langInfo(d.frontLang).name} → ${langInfo(d.backLang).name})`).join('; ') || 'none'}`]
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/')
  const deck = getDeck(studyCard?.deckId ?? (view === 'deck' ? id : undefined))
  if (deck) lines.push(`Currently viewing deck: ${deck.name}`)
  if (studyCard) {
    lines.push(`Reviewing card — prompt: "${studyCard.q}"`)
    lines.push(
      studyCard.flipped
        ? `Answer (revealed): "${studyCard.a}"${studyCard.example ? `; example: "${studyCard.example}"` : ''}`
        : 'Answer not revealed yet.',
    )
  }
  return lines.join('\n')
}
