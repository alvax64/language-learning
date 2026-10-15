import assert from 'node:assert/strict'
import { test } from 'vitest'
import * as SRS from '../src/lib/srs'

const { GRADES } = SRS;
const NOW = new Date(2026, 0, 10, 14, 30).getTime();
const fresh = (extra = {}) => ({ ...SRS.newCardState(), createdAt: 0, ...extra });
const daysUntil = card => Math.round((card.due - SRS.startOfDay(NOW)) / SRS.DAY);

test('new card graded Good is due tomorrow, then in 3 days, then grows by ease', () => {
  let c = SRS.schedule(fresh(), GRADES.GOOD, NOW);
  assert.equal(c.interval, 1);
  assert.equal(c.reps, 1);
  assert.equal(c.seen, true);
  assert.equal(daysUntil(c), 1);

  c = SRS.schedule(c, GRADES.GOOD, NOW);
  assert.equal(c.interval, 3);

  c = SRS.schedule(c, GRADES.GOOD, NOW);
  assert.equal(c.interval, 8); // round(3 * 2.5)
});

test('Again resets the card, counts a lapse and lowers ease', () => {
  const learned = { ...fresh(), seen: true, reps: 3, interval: 8, ease: 2.5 };
  const c = SRS.schedule(learned, GRADES.AGAIN, NOW);
  assert.equal(c.reps, 0);
  assert.equal(c.interval, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.ease, 2.3);
  assert.equal(c.due, NOW + SRS.MINUTE);
});

test('ease never drops below 1.3', () => {
  let c = fresh({ ease: 1.35 });
  for (let i = 0; i < 5; i++) c = SRS.schedule(c, GRADES.AGAIN, NOW);
  assert.equal(c.ease, 1.3);
});

test('Easy gives longer intervals than Good, Hard shorter', () => {
  const card = { ...fresh(), seen: true, reps: 2, interval: 10, ease: 2.5 };
  const hard = SRS.schedule(card, GRADES.HARD, NOW).interval;
  const good = SRS.schedule(card, GRADES.GOOD, NOW).interval;
  const easy = SRS.schedule(card, GRADES.EASY, NOW).interval;
  assert.ok(hard < good && good < easy, `${hard} < ${good} < ${easy}`);
});

test('buildQueue returns due cards first, then limited new cards', () => {
  const cards = [
    fresh({ id: 'n1', createdAt: 1 }),
    fresh({ id: 'n2', createdAt: 2 }),
    fresh({ id: 'n3', createdAt: 3 }),
    { ...fresh(), id: 'd2', seen: true, due: NOW - 10 },
    { ...fresh(), id: 'd1', seen: true, due: NOW - 1000 },
    { ...fresh(), id: 'future', seen: true, due: NOW + SRS.DAY },
  ];
  const q = SRS.buildQueue(cards, NOW, 2).map(c => c.id);
  assert.deepEqual(q, ['d1', 'd2', 'n1', 'n2']);
});

test('previewLabel formats intervals', () => {
  assert.equal(SRS.previewLabel(fresh(), GRADES.AGAIN, NOW), '1m');
  assert.equal(SRS.previewLabel(fresh(), GRADES.GOOD, NOW), '1d');
  assert.equal(SRS.previewLabel(fresh(), GRADES.EASY, NOW), '4d');
  assert.equal(SRS.formatDays(45), '1.5mo');
  assert.equal(SRS.formatDays(730), '2y');
});

test('checkAnswer: exact, alternatives and normalisation', () => {
  assert.equal(SRS.checkAnswer('Hello', 'hello').verdict, 'correct');
  assert.equal(SRS.checkAnswer('  thanks! ', 'thank you / thanks').verdict, 'correct');
  assert.equal(SRS.checkAnswer('eat', 'to eat').verdict, 'correct');
  assert.equal(SRS.checkAnswer('to be', 'to be (permanent)').verdict, 'correct');
  assert.equal(SRS.checkAnswer('¿Dónde está?', 'Dónde está').verdict, 'correct');
  assert.equal(SRS.checkAnswer('s’il vous plaît', "s'il vous plaît").verdict, 'correct');
});

test('checkAnswer: near misses are "almost" with a reason', () => {
  assert.deepEqual(SRS.checkAnswer('adios', 'adiós'), { verdict: 'almost', reason: 'accents' });
  assert.deepEqual(SRS.checkAnswer('Hund', 'der Hund'), { verdict: 'almost', reason: 'article' });
  assert.deepEqual(SRS.checkAnswer('eau', 'l’eau'), { verdict: 'almost', reason: 'article' });
  assert.deepEqual(SRS.checkAnswer('gracais', 'gracias'), { verdict: 'almost', reason: 'typo' });
});

test('checkAnswer: wrong and empty answers', () => {
  assert.equal(SRS.checkAnswer('', 'hello').verdict, 'wrong');
  assert.equal(SRS.checkAnswer('cat', 'dog').verdict, 'wrong');
  assert.equal(SRS.checkAnswer('sí', 'no').verdict, 'wrong'); // short words get no typo tolerance
});
