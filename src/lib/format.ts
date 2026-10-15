import * as SRS from './srs'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function dayKey(ts: number | Date = Date.now()) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return dayKey(d)
}

export function relTime(ts: number, now = Date.now()) {
  const days = Math.round((SRS.startOfDay(ts) - SRS.startOfDay(now)) / SRS.DAY)
  if (days <= 0) {
    const mins = Math.max(1, Math.round((ts - now) / SRS.MINUTE))
    return mins < 60 ? `in ${mins} min` : `in ${Math.round(mins / 60)} h`
  }
  return days === 1 ? 'tomorrow' : `in ${SRS.formatDays(days)}`
}

export function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function navigate(hash: string) {
  location.hash = hash
}
