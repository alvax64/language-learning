# 🗂️ LingoCards

A small, zero-dependency web app for learning languages with spaced-repetition flashcards.

## Run it

```sh
npm start            # or: python3 -m http.server 8080
```

Then open <http://localhost:8080>. (Opening `index.html` directly from disk also works.)

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
- Data stays in `localStorage`. You can export and import a JSON backup from Settings.
- Responsive layout with dark mode.

## Project layout

```
index.html        App shell
css/styles.css    Styles (light/dark, responsive)
js/srs.js         Scheduling + answer checking (pure, unit-tested)
js/seed.js        Starter decks
js/app.js         State, routing, views, events
test/             Node unit tests for srs.js
```

## Tests

```sh
npm test
```
