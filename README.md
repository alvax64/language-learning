# 🗂️ LingoCards

A small web app for learning languages with spaced-repetition flashcards, built with React, Tailwind CSS and [shadcn/ui](https://ui.shadcn.com).

## Run it

```sh
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build in dist/
```

## Features

- **Spaced repetition** (SM-2 variant, like Anki): rate each card *Again / Hard / Good / Easy*, and the app schedules the next review. Each button shows the interval it would give.
- **Two study modes**: flip cards, or type the answer. Typed answers are checked leniently: case and punctuation are ignored, alternatives like `thank you / thanks` are accepted, and missing accents, articles, or small typos count as "almost".
- **Directions**: target → native, native → target, or mixed.
- **Pronunciation** using the browser's built-in text-to-speech (🔊), with optional auto-play.
- **Decks** for any of 18 languages, with Spanish, German and French starter decks.
- **Card management**: add, edit, delete, search, bulk-import (`front ; back ; example`, tab-separated, or `front = back`), and export a deck as TSV.
- **Progress**: daily new-card limit, due counts, day streak, and reviews today.
- **Practice all** mode lets you drill every card without changing your schedule.
- Keyboard shortcuts: `Space`/`Enter` reveals the answer, `1`–`4` grades it, and `Enter` picks the suggested grade.
- **AI tutor** (💬, bottom-right): chat with Claude about words, grammar or the card you're studying — it gives hints instead of answers until you reveal the card. Uses your own Anthropic API key, stored in this browser and sent only to Anthropic.
- Data stays in `localStorage`. You can export and import a JSON backup from Settings.
- Responsive layout with light, dark and system themes (toggle in the header, remembered per browser).

## Project layout

```
index.html                 App shell (applies the saved theme before first paint)
src/main.tsx               Entry point and providers
src/App.tsx                Header, hash routing
src/index.css              Tailwind + shadcn theme tokens (light/dark)
src/components/            Views, dialogs, theme toggle, AI tutor
src/components/ui/         shadcn/ui components (add more with `npx shadcn@latest add <name>`)
src/lib/srs.ts             Scheduling + answer checking (pure, unit-tested)
src/lib/store.ts           State, persistence, queries
src/lib/auth.ts            Local accounts
src/lib/seed.ts            Starter decks
test/                      Vitest unit tests for srs.ts
```

## Tests

```sh
npm test
```
