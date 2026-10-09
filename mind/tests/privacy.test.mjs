import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVault, memoryBackend } from '../js/vault.js';
import { setDay, monthStats, slipPatterns, urgeStats, fearStats, beliefTrend } from '../js/engine/tracking.js';
import { compactTurns } from '../js/engine/aishape.js';

const fast = { iterations: 1000 }; // real app: 210 000

test('data is encrypted at rest; nothing readable in storage', async () => {
  const backend = memoryBackend();
  const v = createVault({ backend, ...fast });
  assert.equal(await v.load(), null);
  await v.save({ secret: 'my core belief is small' });
  const rec = await backend.get('vault');
  const raw = new TextDecoder().decode(rec.ct);
  assert.ok(!raw.includes('core belief'));
  const v2 = createVault({ backend, ...fast });
  assert.deepEqual(await v2.load(), { secret: 'my core belief is small' });
});

test('PIN lock: right PIN opens, wrong PIN fails, then a wait', async () => {
  const backend = memoryBackend();
  const v = createVault({ backend, ...fast });
  await v.load();
  await v.setPin('2580', { a: 1 });
  const v2 = createVault({ backend, ...fast });
  assert.deepEqual(await v2.load(), { locked: true });
  await assert.rejects(v2.unlock('1111'), /wrong-pin/);
  assert.deepEqual(await v2.unlock('2580'), { a: 1 });
  for (let i = 0; i < 5; i++) await v2.unlock('0000').catch(() => {});
  await assert.rejects(v2.unlock('2580'), /wait/);
  assert.ok((await v2.waitTime()) > 0);
});

test('turning the PIN off keeps the data', async () => {
  const backend = memoryBackend();
  const v = createVault({ backend, ...fast });
  await v.load();
  await v.setPin('1234', { a: 2 });
  await v.clearPin({ a: 2 });
  const v2 = createVault({ backend, ...fast });
  assert.deepEqual(await v2.load(), { a: 2 });
});

test('"delete everything" really deletes', async () => {
  const backend = memoryBackend();
  const v = createVault({ backend, ...fast });
  await v.load();
  await v.save({ a: 1 });
  await v.wipe();
  assert.equal(await backend.get('vault'), undefined);
  assert.equal(await backend.get('deviceKey'), undefined);
  assert.equal(await createVault({ backend, ...fast }).load(), null);
});

test('what goes to the AI server: answers only — no ids, times or flagged text', () => {
  const out = compactTurns([
    { stage: 1, stepId: 'mind-goes', question: 'Q?', selected: ['A'], selectedIds: ['a'], freeText: 'hi', at: 123, reflection: ['x'] },
    { stage: 1, stepId: 'body-stress', question: 'Q2?', selected: [], freeText: 'i want to die', flagged: 'crisis', at: 124 },
  ]);
  assert.deepEqual(out, [{ stage: 1, question: 'Q?', selected: ['A'], freeText: 'hi', skipped: false }]);
});

test('clean days per month: "12 of 13 days (92%)", no streak reset', () => {
  let days = [];
  for (let d = 1; d <= 13; d++) days = setDay(days, `2026-10-${String(d).padStart(2, '0')}`, d !== 7);
  const st = monthStats(days, '2026-10', '2026-10-13');
  assert.equal(st.label, '12 of 13 days (92%)');
  assert.equal(st.grid.length, 31);
  assert.equal(st.grid[6].state, 'slip');
  assert.equal(st.grid[20].state, 'future');
  days = setDay(days, '2026-10-07', null);
  assert.equal(monthStats(days, '2026-10', '2026-10-13').label, '12 of 12 days (100%)');
});

test('slip reviews show patterns in plain words', () => {
  const p = slipPatterns([
    { trigger: 'blocked on code, just waiting', firstStep: 'opened insta for a small look' },
    { trigger: 'waiting for a reply', firstStep: 'reels in bed' },
    { trigger: 'bored', firstStep: 'instagram' },
  ]);
  assert.ok(p.lines.some((l) => /waiting \(2 of 3\)/.test(l)));
  assert.ok(p.lines.some((l) => /small look.*\(3 of 3\)/.test(l)));
});

test('urge, fear and belief stats come only from logged data', () => {
  const u = urgeStats([{ ratings: [{ t: 0, v: 8 }, { t: 600000, v: 9 }, { t: 1200000, v: 3 }], outcome: 'passed' }]);
  assert.equal(u.passed, 1);
  assert.equal(u.avgDrop, 67);
  assert.equal(fearStats([{ fearBefore: 7, fearAfter: 3 }, { fearBefore: 5, fearAfter: 3 }]).after, 3);
  assert.equal(beliefTrend([{ date: '2026-10-02', v: 50 }, { date: '2026-10-01', v: 30 }]).change, 20);
});
