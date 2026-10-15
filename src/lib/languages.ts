export const LANGUAGES: [code: string, name: string, flag: string][] = [
  ['en-US', 'English', '🇬🇧'], ['es-ES', 'Spanish', '🇪🇸'], ['fr-FR', 'French', '🇫🇷'],
  ['de-DE', 'German', '🇩🇪'], ['it-IT', 'Italian', '🇮🇹'], ['pt-BR', 'Portuguese', '🇧🇷'],
  ['nl-NL', 'Dutch', '🇳🇱'], ['sv-SE', 'Swedish', '🇸🇪'], ['pl-PL', 'Polish', '🇵🇱'],
  ['ru-RU', 'Russian', '🇷🇺'], ['uk-UA', 'Ukrainian', '🇺🇦'], ['tr-TR', 'Turkish', '🇹🇷'],
  ['el-GR', 'Greek', '🇬🇷'], ['ar-SA', 'Arabic', '🇸🇦'], ['hi-IN', 'Hindi', '🇮🇳'],
  ['ja-JP', 'Japanese', '🇯🇵'], ['ko-KR', 'Korean', '🇰🇷'], ['zh-CN', 'Chinese (Mandarin)', '🇨🇳'],
]

export function langInfo(code: string) {
  const l = LANGUAGES.find(x => x[0] === code)
  return l ? { code, name: l[1], flag: l[2] } : { code, name: code, flag: '🏳️' }
}
