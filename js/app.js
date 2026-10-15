/* LingoCards — state, routing, views and interactions. */
(() => {
  'use strict';

  const SRS = window.SRS;
  const AUTH = window.AUTH;
  const { GRADES } = SRS;
  const STORAGE_KEY = 'lingocards:v1';
  const app = document.getElementById('app');
  const dialog = document.getElementById('dialog');

  const LANGUAGES = [
    ['en-US', 'English', '🇬🇧'], ['es-ES', 'Spanish', '🇪🇸'], ['fr-FR', 'French', '🇫🇷'],
    ['de-DE', 'German', '🇩🇪'], ['it-IT', 'Italian', '🇮🇹'], ['pt-BR', 'Portuguese', '🇧🇷'],
    ['nl-NL', 'Dutch', '🇳🇱'], ['sv-SE', 'Swedish', '🇸🇪'], ['pl-PL', 'Polish', '🇵🇱'],
    ['ru-RU', 'Russian', '🇷🇺'], ['uk-UA', 'Ukrainian', '🇺🇦'], ['tr-TR', 'Turkish', '🇹🇷'],
    ['el-GR', 'Greek', '🇬🇷'], ['ar-SA', 'Arabic', '🇸🇦'], ['hi-IN', 'Hindi', '🇮🇳'],
    ['ja-JP', 'Japanese', '🇯🇵'], ['ko-KR', 'Korean', '🇰🇷'], ['zh-CN', 'Chinese (Mandarin)', '🇨🇳'],
  ];

  // ---------- helpers ----------

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function langInfo(code) {
    const l = LANGUAGES.find(x => x[0] === code);
    return l ? { code, name: l[1], flag: l[2] } : { code, name: code, flag: '🏳️' };
  }

  function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  function relTime(ts, now = Date.now()) {
    const days = Math.round((SRS.startOfDay(ts) - SRS.startOfDay(now)) / SRS.DAY);
    if (days <= 0) {
      const mins = Math.max(1, Math.round((ts - now) / SRS.MINUTE));
      return mins < 60 ? `in ${mins} min` : `in ${Math.round(mins / 60)} h`;
    }
    return days === 1 ? 'tomorrow' : `in ${SRS.formatDays(days)}`;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  // ---------- state ----------

  const DEFAULT_SETTINGS = { newPerDay: 15, autoSpeak: false };
  const DEFAULT_STATS = { streak: 0, lastDay: null, reviews: {}, newCards: {} };

  function makeDeck({ name, frontLang, backLang }) {
    return { id: uid(), name, frontLang, backLang, direction: 'forward', mode: 'flip', createdAt: Date.now() };
  }

  function makeCard(deckId, front, back, example = '', order = 0) {
    return {
      id: uid(), deckId,
      front: front.trim(), back: back.trim(), example: (example || '').trim(),
      ...SRS.newCardState(),
      createdAt: Date.now() + order,
    };
  }

  function freshState() {
    const s = { version: 1, decks: [], cards: [], settings: { ...DEFAULT_SETTINGS }, stats: structuredClone(DEFAULT_STATS) };
    for (const seed of window.SEED_DECKS || []) {
      const deck = makeDeck(seed);
      s.decks.push(deck);
      seed.cards.forEach(([front, back, example], i) => s.cards.push(makeCard(deck.id, front, back, example, i)));
    }
    return s;
  }

  function normalizeState(s) {
    if (!s || !Array.isArray(s.decks) || !Array.isArray(s.cards)) throw new Error('Invalid data');
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    s.stats = { ...structuredClone(DEFAULT_STATS), ...s.stats };
    // Only today's new-card counts matter for the daily limit.
    const today = dayKey();
    s.stats.newCards = { [today]: s.stats.newCards[today] || {} };
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (err) {
      console.warn('Could not read saved data, starting fresh', err);
    }
    return freshState();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      toast('⚠️ Could not save — storage may be full');
    }
  }

  let state = load();
  save();

  const getDeck = id => state.decks.find(d => d.id === id);
  const getCard = id => state.cards.find(c => c.id === id);
  const deckCards = deckId => state.cards.filter(c => c.deckId === deckId);

  function newRemaining(deckId) {
    const introduced = state.stats.newCards[dayKey()]?.[deckId] || 0;
    return Math.max(0, state.settings.newPerDay - introduced);
  }

  function deckCounts(deckId, now = Date.now()) {
    const cards = deckCards(deckId);
    const unseen = cards.filter(c => !c.seen).length;
    return {
      total: cards.length,
      due: cards.filter(c => c.seen && c.due <= now).length,
      new: Math.min(unseen, newRemaining(deckId)),
      unseen,
      mature: cards.filter(c => c.interval >= 21).length,
    };
  }

  function nextDue(deckId, now = Date.now()) {
    const upcoming = deckCards(deckId).filter(c => c.seen && c.due > now).map(c => c.due);
    return upcoming.length ? Math.min(...upcoming) : null;
  }

  function currentStreak() {
    const { streak, lastDay } = state.stats;
    return lastDay === dayKey() || lastDay === yesterdayKey() ? streak : 0;
  }

  function recordReview(deckId, wasNew) {
    const st = state.stats;
    const today = dayKey();
    st.reviews[today] = (st.reviews[today] || 0) + 1;
    if (wasNew) {
      const counts = (st.newCards[today] ||= {});
      counts[deckId] = (counts[deckId] || 0) + 1;
    }
    if (st.lastDay !== today) {
      st.streak = st.lastDay === yesterdayKey() ? st.streak + 1 : 1;
      st.lastDay = today;
    }
  }

  // ---------- speech ----------

  let voices = [];
  const canSpeak = 'speechSynthesis' in window;
  if (canSpeak) {
    const loadVoices = () => { voices = speechSynthesis.getVoices(); };
    loadVoices();
    speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
  }

  function speak(text, lang) {
    if (!canSpeak || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\([^)]*\)/g, ''));
    u.lang = lang;
    u.rate = 0.9;
    const prefix = lang.split('-')[0];
    const norm = v => v.lang.replace('_', '-');
    u.voice = voices.find(v => norm(v) === lang) || voices.find(v => norm(v).startsWith(prefix)) || null;
    speechSynthesis.speak(u);
  }

  const speakBtn = (text, lang, extra = '') =>
    canSpeak ? `<button class="icon-btn ${extra}" data-action="speak" data-text="${esc(text)}" data-lang="${esc(lang)}" title="Listen" aria-label="Listen">🔊</button>` : '';

  // ---------- routing ----------

  let session = null;

  function route() {
    const [view, id, sub] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (canSpeak) speechSynthesis.cancel();
    if (dialog.open) dialog.close();

    const user = AUTH.currentUser();
    document.getElementById('user-nav').hidden = !user;
    if (!user) {
      session = null;
      return renderLogin();
    }

    if (view === 'deck' && getDeck(id)) {
      if (sub === 'study' || sub === 'cram') return startStudy(id, sub === 'cram');
      session = null;
      return renderDeck(id);
    }
    session = null;
    if (view) return navigate('#/');
    renderHome();
  }

  // ---------- views: login ----------

  function renderLogin() {
    const signup = !AUTH.hasUsers() || location.hash === '#/signup';
    app.innerHTML = `
      <section class="panel auth-card">
        <h1>${signup ? 'Create your account' : 'Welcome back'}</h1>
        <p class="muted">${signup ? 'Pick a username and password to get started.' : 'Log in to continue learning.'}</p>
        <form id="auth-form" class="dialog-form" data-mode="${signup ? 'signup' : 'login'}">
          <label>Username
            <input name="username" autocomplete="username" required autofocus>
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="${signup ? 6 : 1}">
          </label>
          <p id="auth-error" class="auth-error" role="alert" hidden></p>
          <button class="btn primary big" type="submit">${signup ? 'Sign up' : 'Log in'}</button>
        </form>
        <p class="muted small center">
          ${signup
            ? (AUTH.hasUsers() ? 'Already have an account? <a href="#/">Log in</a>' : '')
            : 'New here? <a href="#/signup">Create an account</a>'}
        </p>
        <p class="muted small center">Accounts are stored in this browser only.</p>
      </section>`;
    app.querySelector('[name=username]').focus();
  }

  // ---------- views: home ----------

  const stat = (label, value) => `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;

  function renderHome() {
    document.title = 'LingoCards';
    const now = Date.now();
    const counts = state.decks.map(d => deckCounts(d.id, now));
    const due = counts.reduce((n, c) => n + c.due + c.new, 0);

    app.innerHTML = `
      <section class="stats">
        ${stat('To study today', due)}
        ${stat('Day streak', `${currentStreak()} 🔥`)}
        ${stat('Reviewed today', state.stats.reviews[dayKey()] || 0)}
        ${stat('Cards learned', state.cards.filter(c => c.seen).length + ' / ' + state.cards.length)}
      </section>

      <div class="section-head">
        <h1>Your decks</h1>
        <button class="btn primary" data-action="new-deck">+ New deck</button>
      </div>

      ${state.decks.length ? `<div class="deck-grid">${state.decks.map((d, i) => deckTile(d, counts[i])).join('')}</div>`
        : `<div class="empty panel"><p>No decks yet.</p><button class="btn primary" data-action="new-deck">Create your first deck</button></div>`}
    `;
  }

  function deckTile(deck, c) {
    const from = langInfo(deck.frontLang);
    const to = langInfo(deck.backLang);
    const toStudy = c.due + c.new;
    return `
      <article class="deck-tile">
        <a href="#/deck/${deck.id}" class="deck-link">
          <div class="deck-flags" aria-hidden="true">${from.flag}<span>→</span>${to.flag}</div>
          <h2>${esc(deck.name)}</h2>
          <p class="muted">${esc(from.name)} → ${esc(to.name)} · ${plural(c.total, 'card')}</p>
        </a>
        <div class="pills">
          <span class="pill new">${c.new} new</span>
          <span class="pill due">${c.due} due</span>
          ${c.mature ? `<span class="pill mature">${c.mature} mastered</span>` : ''}
        </div>
        ${toStudy
          ? `<a class="btn primary block" href="#/deck/${deck.id}/study">Study ${toStudy}</a>`
          : `<a class="btn block" href="#/deck/${deck.id}">All caught up ✓</a>`}
      </article>`;
  }

  // ---------- views: deck ----------

  function renderDeck(deckId) {
    const deck = getDeck(deckId);
    document.title = `${deck.name} · LingoCards`;
    const now = Date.now();
    const c = deckCounts(deckId, now);
    const from = langInfo(deck.frontLang);
    const to = langInfo(deck.backLang);
    const cards = deckCards(deckId).sort((a, b) => b.createdAt - a.createdAt);
    const toStudy = c.due + c.new;
    const next = nextDue(deckId, now);

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">← All decks</a></nav>

      <div class="deck-header">
        <div>
          <div class="deck-flags big" aria-hidden="true">${from.flag}<span>→</span>${to.flag}</div>
          <h1>${esc(deck.name)}</h1>
          <p class="muted">${esc(from.name)} → ${esc(to.name)}</p>
        </div>
        <div class="row">
          <button class="btn" data-action="edit-deck" data-id="${deck.id}">Edit</button>
          <button class="btn" data-action="export-deck" data-id="${deck.id}" ${cards.length ? '' : 'disabled'}>Export</button>
          <button class="btn danger" data-action="delete-deck" data-id="${deck.id}">Delete</button>
        </div>
      </div>

      <section class="panel study-panel">
        <div class="pills">
          <span class="pill new">${c.new} new today</span>
          <span class="pill due">${c.due} due</span>
          <span class="pill">${c.unseen} unseen</span>
          <span class="pill mature">${c.mature} mastered</span>
        </div>
        <div class="options">
          <label>Direction
            <select data-setting="direction" data-id="${deck.id}">
              <option value="forward" ${deck.direction === 'forward' ? 'selected' : ''}>${esc(from.name)} → ${esc(to.name)}</option>
              <option value="reverse" ${deck.direction === 'reverse' ? 'selected' : ''}>${esc(to.name)} → ${esc(from.name)}</option>
              <option value="mixed" ${deck.direction === 'mixed' ? 'selected' : ''}>Mixed</option>
            </select>
          </label>
          <label>Mode
            <select data-setting="mode" data-id="${deck.id}">
              <option value="flip" ${deck.mode === 'flip' ? 'selected' : ''}>Flip cards</option>
              <option value="type" ${deck.mode === 'type' ? 'selected' : ''}>Type the answer</option>
            </select>
          </label>
        </div>
        <div class="row">
          ${toStudy
            ? `<a class="btn primary big" href="#/deck/${deck.id}/study">Study now (${toStudy})</a>`
            : `<span class="muted">🎉 All caught up${next ? ` — next review ${relTime(next, now)}` : ''}.</span>`}
          ${cards.length ? `<a class="btn" href="#/deck/${deck.id}/cram" title="Review every card without affecting your schedule">Practice all</a>` : ''}
        </div>
      </section>

      <section class="panel">
        <h2>Add a card</h2>
        <form id="add-card" class="card-form" autocomplete="off">
          <input name="front" required placeholder="${esc(from.name)} (e.g. word or phrase)" aria-label="${esc(from.name)}">
          <input name="back" required placeholder="${esc(to.name)} translation" aria-label="${esc(to.name)} translation">
          <input name="example" placeholder="Example sentence (optional)" aria-label="Example sentence">
          <button class="btn primary">Add</button>
        </form>
        <details class="bulk">
          <summary>Bulk import</summary>
          <form id="bulk-import">
            <p class="muted small">One card per line: <code>front ; back ; example</code>. Tab-separated (from a spreadsheet) or <code>front = back</code> also work.</p>
            <textarea name="text" rows="6" placeholder="la manzana ; apple ; Me como una manzana.&#10;el queso ; cheese"></textarea>
            <button class="btn">Import cards</button>
          </form>
        </details>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>Cards <span class="muted">(${cards.length})</span></h2>
          ${cards.length ? '<input type="search" id="card-search" placeholder="Search cards…" aria-label="Search cards">' : ''}
        </div>
        ${cards.length ? `<ul class="card-list">${cards.map(card => cardRow(card, deck, now)).join('')}</ul>`
          : '<p class="muted">No cards yet — add your first one above.</p>'}
      </section>
    `;
  }

  function cardRow(card, deck, now) {
    const status = !card.seen ? '<span class="pill new">New</span>'
      : card.due <= now ? '<span class="pill due">Due</span>'
      : `<span class="pill">${relTime(card.due, now)}</span>`;
    const haystack = `${card.front} ${card.back} ${card.example}`.toLowerCase();
    return `
      <li class="card-row" data-search="${esc(haystack)}">
        <div class="card-text">
          <strong>${esc(card.front)}</strong>
          <span>${esc(card.back)}</span>
          ${card.example ? `<em class="muted small">${esc(card.example)}</em>` : ''}
        </div>
        ${status}
        <div class="row-actions">
          ${speakBtn(card.front, deck.frontLang)}
          <button class="icon-btn" data-action="edit-card" data-id="${card.id}" title="Edit" aria-label="Edit">✏️</button>
          <button class="icon-btn" data-action="delete-card" data-id="${card.id}" title="Delete" aria-label="Delete">🗑️</button>
        </div>
      </li>`;
  }

  function parseBulk(text) {
    const rows = [];
    let skipped = 0;
    for (const line of text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
      const parts = (line.includes('\t') ? line.split('\t')
        : line.includes(';') ? line.split(';')
        : line.split(/\s+[=–—-]\s+/)).map(p => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) rows.push(parts);
      else skipped++;
    }
    return { rows, skipped };
  }

  const isDuplicate = (deckId, front, back) =>
    deckCards(deckId).some(c => c.front.toLowerCase() === front.trim().toLowerCase() && c.back.toLowerCase() === back.trim().toLowerCase());

  // ---------- views: study ----------

  function startStudy(deckId, cram) {
    const deck = getDeck(deckId);
    const cards = deckCards(deckId);
    const items = cram ? shuffle(cards.slice()) : SRS.buildQueue(cards, Date.now(), newRemaining(deckId));
    const reverse = () => deck.direction === 'reverse' || (deck.direction === 'mixed' && Math.random() < 0.5);
    session = {
      deckId, cram,
      queue: items.map(c => ({ id: c.id, reverse: reverse() })),
      total: items.length,
      finished: 0,
      firstTry: 0,
      missed: new Set(),
      flipped: false,
      suggested: null,
      result: null,
    };
    document.title = `Studying ${deck.name} · LingoCards`;
    renderStudy();
  }

  function currentSide() {
    const deck = getDeck(session.deckId);
    const item = session.queue[0];
    const card = getCard(item.id);
    return item.reverse
      ? { deck, card, q: card.back, a: card.front, qLang: deck.backLang, aLang: deck.frontLang }
      : { deck, card, q: card.front, a: card.back, qLang: deck.frontLang, aLang: deck.backLang };
  }

  function renderStudy() {
    while (session.queue.length && !getCard(session.queue[0].id)) session.queue.shift();
    if (!session.queue.length) return renderSummary();

    const { deck, card, q, a, qLang, aLang } = currentSide();
    session.flipped = false;
    session.suggested = null;
    session.result = null;
    const pct = session.total ? Math.round((session.finished / session.total) * 100) : 0;
    const ql = langInfo(qLang);
    const al = langInfo(aLang);

    app.innerHTML = `
      <div class="study">
        <div class="study-top">
          <a href="#/deck/${deck.id}" class="btn ghost" title="End session">✕</a>
          <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="bar" style="width:${pct}%"></div></div>
          <span class="muted small">${session.finished} / ${session.total}</span>
        </div>
        ${session.cram ? '<p class="cram-note">Practice mode — your review schedule won’t change.</p>' : ''}

        <div class="flashcard-wrap">
          <div class="flashcard" id="flashcard" data-action="flip">
            <div class="face front">
              <span class="lang-tag">${ql.flag} ${esc(ql.name)}</span>
              ${!card.seen && !session.cram ? '<span class="badge-new">New</span>' : ''}
              <div class="term">${esc(q)}</div>
              ${speakBtn(q, qLang, 'speak-corner')}
              ${deck.mode === 'flip' ? '<p class="hint">Click or press <kbd>Space</kbd> to reveal</p>' : ''}
            </div>
            <div class="face back">
              <span class="lang-tag">${al.flag} ${esc(al.name)}</span>
              <div class="prompt-small">${esc(q)}</div>
              <div class="term answer">${esc(a)}</div>
              ${card.example ? `<p class="example">“${esc(card.example)}”</p>` : ''}
              ${speakBtn(a, aLang, 'speak-corner')}
            </div>
          </div>
        </div>

        <div id="controls" class="controls">${controlsHtml()}</div>
      </div>`;

    if (deck.mode === 'type') document.getElementById('answer')?.focus();
    if (state.settings.autoSpeak && qLang === deck.frontLang) speak(q, qLang);
  }

  function controlsHtml() {
    const { deck, card, a } = currentSide();

    if (!session.flipped) {
      if (deck.mode === 'type') {
        return `
          <form id="answer-form" class="answer-form" autocomplete="off">
            <input id="answer" name="answer" placeholder="Type the translation…" aria-label="Your answer" autocapitalize="off" spellcheck="false">
            <button class="btn primary">Check</button>
            <button type="button" class="btn ghost" data-action="reveal">I don’t know</button>
          </form>`;
      }
      return `<button class="btn primary big" data-action="reveal">Show answer <kbd>Space</kbd></button>`;
    }

    let feedback = '';
    const r = session.result;
    if (r) {
      const reasons = { accents: 'watch the accents', article: 'don’t forget the article', typo: 'small typo' };
      feedback = r.verdict === 'correct'
        ? '<div class="feedback correct">✓ Correct!</div>'
        : r.verdict === 'almost'
          ? `<div class="feedback almost">≈ Almost — ${reasons[r.reason]}. You wrote <strong>${esc(r.input)}</strong>, answer: <strong>${esc(a)}</strong></div>`
          : `<div class="feedback wrong">✗ ${r.input ? `You wrote <strong>${esc(r.input)}</strong>` : 'No answer'} — answer: <strong>${esc(a)}</strong></div>`;
    }

    const grades = [['Again', GRADES.AGAIN, 'again'], ['Hard', GRADES.HARD, 'hard'], ['Good', GRADES.GOOD, 'good'], ['Easy', GRADES.EASY, 'easy']];
    return `
      ${feedback}
      <div class="grades">
        ${grades.map(([label, g, cls]) => `
          <button class="grade ${cls} ${session.suggested === g ? 'suggested' : ''}" data-action="grade" data-grade="${g}">
            <span class="g-label">${label}</span>
            ${session.cram ? '' : `<span class="g-int">${SRS.previewLabel(card, g)}</span>`}
            <kbd>${g + 1}</kbd>
          </button>`).join('')}
      </div>
      <p class="hint">How well did you know it? Press <kbd>1</kbd>–<kbd>4</kbd>${session.suggested !== null ? ' or <kbd>Enter</kbd> for the highlighted choice' : ''}.</p>`;
  }

  function reveal() {
    if (!session || session.flipped) return;
    session.flipped = true;
    document.getElementById('flashcard').classList.add('flipped');
    document.getElementById('controls').innerHTML = controlsHtml();
    const { deck, a, aLang } = currentSide();
    if (state.settings.autoSpeak && aLang === deck.frontLang) speak(a, aLang);
  }

  function checkTyped(value) {
    const { a } = currentSide();
    const result = SRS.checkAnswer(value, a);
    session.result = { ...result, input: value.trim() };
    session.suggested = { correct: GRADES.GOOD, almost: GRADES.HARD, wrong: GRADES.AGAIN }[result.verdict];
    reveal();
  }

  function grade(g) {
    if (!session || !session.flipped) return;
    const item = session.queue.shift();
    const card = getCard(item.id);
    const wasNew = !card.seen;

    if (!session.cram) Object.assign(card, SRS.schedule(card, g));
    recordReview(session.deckId, wasNew && !session.cram);

    if (g === GRADES.AGAIN) {
      // Show it again a few cards later.
      session.missed.add(item.id);
      session.queue.splice(Math.min(session.queue.length, 3), 0, item);
    } else {
      session.finished++;
      if (!session.missed.has(item.id)) session.firstTry++;
    }
    save();
    renderStudy();
  }

  function renderSummary() {
    const deck = getDeck(session.deckId);
    const s = session;
    const empty = s.total === 0;
    const acc = s.finished ? Math.round((s.firstTry / s.finished) * 100) : 0;
    const next = nextDue(deck.id);
    const hasCards = deckCards(deck.id).length > 0;

    app.innerHTML = `
      <section class="panel summary">
        <div class="big-emoji">${empty ? '☕' : '🎉'}</div>
        <h1>${empty ? 'Nothing to review right now' : 'Session complete!'}</h1>
        ${empty
          ? `<p class="muted">${!hasCards ? 'Add some cards to get started.' : next ? `Next review ${relTime(next)}.` : 'You’ve reached today’s limit for new cards.'}</p>`
          : `<div class="stats">
              ${stat('Cards reviewed', s.finished)}
              ${stat('First-try accuracy', `${acc}%`)}
              ${stat('Day streak', `${currentStreak()} 🔥`)}
            </div>
            ${!s.cram && next ? `<p class="muted">Next review ${relTime(next)}.</p>` : ''}`}
        <div class="row center">
          <a class="btn primary" href="#/deck/${deck.id}">Back to deck</a>
          ${empty && hasCards ? `<a class="btn" href="#/deck/${deck.id}/cram">Practice all anyway</a>` : '<a class="btn" href="#/">All decks</a>'}
        </div>
      </section>`;
  }

  // ---------- dialogs ----------

  let dialogHandler = null;

  function openDialog(html, onSubmit) {
    dialog.innerHTML = html;
    dialogHandler = onSubmit;
    dialog.showModal();
    dialog.querySelector('input, select, textarea')?.focus();
  }

  dialog.addEventListener('submit', e => {
    if (e.submitter?.value === 'cancel') return; // native method="dialog" closes it
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (dialogHandler?.(data) === false) return;
    dialog.close();
  });

  const dialogActions = label => `
    <div class="dialog-actions">
      <button class="btn" value="cancel" formnovalidate>Cancel</button>
      <button class="btn primary" value="ok">${label}</button>
    </div>`;

  const langOptions = selected =>
    LANGUAGES.map(([code, name, flag]) => `<option value="${code}" ${code === selected ? 'selected' : ''}>${flag} ${name}</option>`).join('');

  function deckDialog(deck) {
    openDialog(`
      <form method="dialog" class="dialog-form">
        <h2>${deck ? 'Edit deck' : 'New deck'}</h2>
        <label>Deck name <input name="name" required maxlength="60" value="${esc(deck?.name || '')}" placeholder="e.g. Italian – Food"></label>
        <label>Language you’re learning <select name="frontLang">${langOptions(deck?.frontLang || 'es-ES')}</select></label>
        <label>Translate into <select name="backLang">${langOptions(deck?.backLang || 'en-US')}</select></label>
        ${dialogActions(deck ? 'Save' : 'Create deck')}
      </form>`, data => {
      const name = data.name.trim();
      if (!name) return false;
      const fields = { name, frontLang: data.frontLang, backLang: data.backLang };
      if (deck) {
        Object.assign(deck, fields);
        save();
        route();
      } else {
        const d = makeDeck(fields);
        state.decks.push(d);
        save();
        navigate(`#/deck/${d.id}`);
      }
    });
  }

  function cardDialog(card) {
    const deck = getDeck(card.deckId);
    openDialog(`
      <form method="dialog" class="dialog-form">
        <h2>Edit card</h2>
        <label>${esc(langInfo(deck.frontLang).name)} <input name="front" required value="${esc(card.front)}"></label>
        <label>${esc(langInfo(deck.backLang).name)} <input name="back" required value="${esc(card.back)}"></label>
        <label>Example sentence <input name="example" value="${esc(card.example)}"></label>
        ${card.seen ? '<label class="check"><input type="checkbox" name="reset"> Reset learning progress</label>' : ''}
        ${dialogActions('Save')}
      </form>`, data => {
      if (!data.front.trim() || !data.back.trim()) return false;
      Object.assign(card, { front: data.front.trim(), back: data.back.trim(), example: data.example.trim() });
      if (data.reset) Object.assign(card, SRS.newCardState());
      save();
      route();
      toast('Card updated');
    });
  }

  function settingsDialog() {
    const st = state.settings;
    openDialog(`
      <form method="dialog" class="dialog-form">
        <h2>Settings</h2>
        <label>New cards per day (per deck)
          <input type="number" name="newPerDay" min="0" max="999" required value="${st.newPerDay}">
        </label>
        ${canSpeak ? `<label class="check"><input type="checkbox" name="autoSpeak" ${st.autoSpeak ? 'checked' : ''}> Automatically play pronunciation</label>` : ''}
        <h3>Your data</h3>
        <p class="muted small">Everything is stored locally in this browser. Export a backup to move it to another device.</p>
        <div class="row">
          <button type="button" class="btn" data-action="export-backup">Export backup</button>
          <button type="button" class="btn" data-action="import-backup">Import backup</button>
          <button type="button" class="btn danger" data-action="reset-all">Reset everything</button>
        </div>
        ${dialogActions('Save')}
      </form>`, data => {
      st.newPerDay = Math.max(0, Math.min(999, parseInt(data.newPerDay, 10) || 0));
      st.autoSpeak = data.autoSpeak === 'on';
      save();
      route();
      toast('Settings saved');
    });
  }

  function importBackup() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = normalizeState(JSON.parse(await file.text()));
        if (!confirm(`Replace all current data with this backup (${plural(data.decks.length, 'deck')}, ${plural(data.cards.length, 'card')})?`)) return;
        state = data;
        save();
        navigate('#/');
        toast('Backup restored');
      } catch {
        toast('That file isn’t a valid LingoCards backup');
      }
    });
    input.click();
  }

  // ---------- event wiring ----------

  const actions = {
    'new-deck': () => deckDialog(),
    'edit-deck': el => deckDialog(getDeck(el.dataset.id)),
    'delete-deck': el => {
      const deck = getDeck(el.dataset.id);
      if (!confirm(`Delete “${deck.name}” and its ${plural(deckCards(deck.id).length, 'card')}? This can’t be undone.`)) return;
      state.decks = state.decks.filter(d => d.id !== deck.id);
      state.cards = state.cards.filter(c => c.deckId !== deck.id);
      save();
      navigate('#/');
      toast('Deck deleted');
    },
    'export-deck': el => {
      const deck = getDeck(el.dataset.id);
      const clean = s => s.replace(/[\t\r\n]+/g, ' ');
      const tsv = deckCards(deck.id).map(c => [c.front, c.back, c.example].map(clean).join('\t')).join('\n');
      download(`${deck.name.replace(/[^\w-]+/g, '_')}.tsv`, tsv, 'text/tab-separated-values');
    },
    'edit-card': el => cardDialog(getCard(el.dataset.id)),
    'delete-card': el => {
      const card = getCard(el.dataset.id);
      if (!confirm(`Delete “${card.front}”?`)) return;
      state.cards = state.cards.filter(c => c.id !== card.id);
      save();
      route();
    },
    'speak': el => speak(el.dataset.text, el.dataset.lang),
    'flip': () => {
      if (!session) return;
      if (session.flipped) document.getElementById('flashcard').classList.toggle('flipped');
      else actions.reveal();
    },
    'reveal': () => {
      if (!session || session.flipped) return;
      // Giving up in type mode counts as a wrong answer.
      if (getDeck(session.deckId).mode === 'type') checkTyped('');
      else reveal();
    },
    'grade': el => grade(Number(el.dataset.grade)),
    'open-settings': () => settingsDialog(),
    'export-backup': () => download(`lingocards-backup-${dayKey()}.json`, JSON.stringify(state, null, 2), 'application/json'),
    'import-backup': () => importBackup(),
    'reset-all': () => {
      if (!confirm('Delete all decks, cards and progress and restore the starter decks?')) return;
      state = freshState();
      save();
      navigate('#/');
      toast('All data reset');
    },
  };

  actions.logout = () => {
    AUTH.logout();
    navigate('#/');
    route();
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    fn(el, e);
  });

  const forms = {
    'auth-form': async form => {
      const { username, password } = Object.fromEntries(new FormData(form));
      const btn = form.querySelector('button[type=submit]');
      const err = form.querySelector('#auth-error');
      err.hidden = true;
      btn.disabled = true;
      try {
        if (form.dataset.mode === 'signup') await AUTH.register(username, password);
        else await AUTH.login(username, password);
        navigate('#/');
        toast('Welcome!');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        btn.disabled = false;
      }
    },
    'add-card': form => {
      const deckId = location.hash.split('/')[2];
      const { front, back, example } = Object.fromEntries(new FormData(form));
      if (!front.trim() || !back.trim()) return;
      if (isDuplicate(deckId, front, back)) return toast('That card is already in this deck');
      state.cards.push(makeCard(deckId, front, back, example));
      save();
      renderDeck(deckId);
      app.querySelector('#add-card [name=front]').focus();
      toast('Card added');
    },
    'bulk-import': form => {
      const deckId = location.hash.split('/')[2];
      const { rows, skipped } = parseBulk(form.text.value);
      let added = 0;
      let dupes = 0;
      rows.forEach(([front, back, example], i) => {
        if (isDuplicate(deckId, front, back)) return dupes++;
        state.cards.push(makeCard(deckId, front, back, example, i));
        added++;
      });
      save();
      renderDeck(deckId);
      const extra = [skipped && `${skipped} unreadable`, dupes && `${dupes} duplicate`].filter(Boolean).join(', ');
      toast(`Imported ${plural(added, 'card')}${extra ? ` (skipped ${extra})` : ''}`);
    },
    'answer-form': form => checkTyped(form.answer.value),
  };

  document.addEventListener('submit', e => {
    if (e.target.closest('dialog')) return;
    const handler = forms[e.target.id];
    if (!handler) return;
    e.preventDefault();
    handler(e.target);
  });

  document.addEventListener('change', e => {
    const el = e.target.closest('[data-setting]');
    if (!el) return;
    getDeck(el.dataset.id)[el.dataset.setting] = el.value;
    save();
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'card-search') return;
    const q = e.target.value.trim().toLowerCase();
    app.querySelectorAll('.card-row').forEach(row => { row.hidden = q && !row.dataset.search.includes(q); });
  });

  document.addEventListener('keydown', e => {
    if (!session || dialog.open || !document.getElementById('flashcard')) return;
    if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const isSpace = e.code === 'Space' || e.key === ' ';

    if (!session.flipped) {
      if (isSpace || e.key === 'Enter') {
        e.preventDefault();
        actions.reveal();
      }
      return;
    }
    if (['1', '2', '3', '4'].includes(e.key)) {
      grade(Number(e.key) - 1);
    } else if (e.key === 'Enter' || isSpace) {
      e.preventDefault();
      grade(session.suggested ?? GRADES.GOOD);
    }
  });

  window.addEventListener('hashchange', route);
  route();
})();
