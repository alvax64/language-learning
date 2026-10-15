/* Pronunciation via the browser's built-in text-to-speech. */

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

let voices: SpeechSynthesisVoice[] = []
if (canSpeak) {
  const loadVoices = () => {
    voices = speechSynthesis.getVoices()
  }
  loadVoices()
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

export function speak(text: string, lang: string) {
  if (!canSpeak || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/\([^)]*\)/g, ''))
  u.lang = lang
  u.rate = 0.9
  const prefix = lang.split('-')[0]
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-')
  u.voice = voices.find(v => norm(v) === lang) || voices.find(v => norm(v).startsWith(prefix)) || null
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel()
}
