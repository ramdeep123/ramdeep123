// Daily practice maths (handoff §5). No streaks that reset to zero: progress
// is "12 of 13 days (92%)", slips are data to learn from, and every number
// here is computed only from what the user logged on their own phone.

import { daysInMonth, monthKey, dayKey } from './util.js';
import { signalsForTurn, SIG } from './signals.js';

/** days: [{ date: 'YYYY-MM-DD', clean: true|false }] → a new array with one day set (or cleared). */
export function setDay(days, date, clean) {
  const rest = (days || []).filter((d) => d.date !== date);
  if (clean === null || clean === undefined) return rest;
  return [...rest, { date, clean: !!clean }].sort((a, b) => a.date.localeCompare(b.date));
}

export const dayState = (days, date) => {
  const d = (days || []).find((x) => x.date === date);
  return d ? (d.clean ? 'clean' : 'slip') : 'none';
};

/**
 * Clean days in a month, counted over the days the user logged.
 * → { clean, logged, slips, pct, label: '12 of 13 days (92%)', grid }
 */
export function monthStats(days, mKey = monthKey(), today = dayKey()) {
  const inMonth = (days || []).filter((d) => d.date.startsWith(mKey) && d.date <= today);
  const clean = inMonth.filter((d) => d.clean).length;
  const logged = inMonth.length;
  const pct = logged ? Math.round((clean / logged) * 100) : 0;
  const n = daysInMonth(mKey);
  const grid = [];
  for (let i = 1; i <= n; i++) {
    const date = `${mKey}-${String(i).padStart(2, '0')}`;
    grid.push({ date, day: i, state: date > today ? 'future' : dayState(days, date), today: date === today });
  }
  const unlogged = grid.filter((g) => g.state === 'none').length;
  return {
    clean, logged, slips: logged - clean, pct, unlogged,
    label: logged ? `${clean} of ${logged} day${logged === 1 ? '' : 's'} (${pct}%)` : 'No days logged yet',
    grid,
  };
}

/** Weekday offset (Mon = 0) of the 1st of a month, for the calendar grid. */
export function monthOffset(mKey) {
  const [y, m] = mKey.split('-').map(Number);
  return (new Date(y, m - 1, 1).getDay() + 6) % 7;
}

const count = (arr) => {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/**
 * What slip reviews have in common, in plain words. Free text is read with
 * the same patterns as the interview (blocked, waiting, late night, apps…).
 */
export function slipPatterns(reviews) {
  const list = reviews || [];
  const sig = (text, stepId) => signalsForTurn({ stage: 3, stepId, freeText: text || '', selected: [] }, null).map((s) => s.id);
  const trig = count(list.flatMap((r) => sig(r.trigger, 'before').filter((id) => id.startsWith('trig.') || id.startsWith('time.'))));
  const steps = count(list.flatMap((r) => sig(r.firstStep, 'first-step').filter((id) => id.startsWith('step.'))));
  const hours = count(list.filter((r) => r.at).map((r) => partOfDay(new Date(r.at).getHours())));
  const lines = [];
  if (list.length >= 2) {
    if (trig[0] && trig[0][1] >= 2) lines.push(`Most slips came when you were ${SIG[trig[0][0]].label} (${trig[0][1]} of ${list.length}).`);
    if (steps[0] && steps[0][1] >= 2) lines.push(`The usual first small step: ${SIG[steps[0][0]].label} (${steps[0][1]} of ${list.length}).`);
    if (hours[0] && hours[0][1] >= 2) lines.push(`Most reviews were written in the ${hours[0][0]}.`);
  }
  return { total: list.length, triggers: trig, firstSteps: steps, lines };
}

export function partOfDay(h) {
  if (h < 5) return 'late night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

/**
 * Urge sessions: ratings 0–10 taken during the timer.
 * Shows, from the user's own data, that urges rise and fall.
 */
export function urgeStats(sessions) {
  const done = (sessions || []).filter((s) => (s.ratings || []).length >= 2);
  const passed = (sessions || []).filter((s) => s.outcome === 'passed').length;
  const drops = done.map((s) => {
    const peak = Math.max(...s.ratings.map((r) => r.v));
    const last = s.ratings[s.ratings.length - 1].v;
    return peak ? (peak - last) / peak : 0;
  });
  const avgDrop = drops.length ? Math.round((drops.reduce((a, b) => a + b, 0) / drops.length) * 100) : 0;
  return {
    sessions: (sessions || []).length,
    passed,
    avgDrop,
    line: done.length >= 1 ? `Your urges dropped by ${avgDrop}% on average while you waited.` : '',
  };
}

/** The 0–100 "how true does it feel" ratings for the new belief. */
export function beliefTrend(ratings) {
  const list = [...(ratings || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return { last: null, first: null, change: 0, series: [] };
  return { last: list.at(-1).v, first: list[0].v, change: list.at(-1).v - list[0].v, series: list.slice(-30) };
}

/** Small disagreements: fear predicted before vs how it really went. */
export function fearStats(logs) {
  const l = (logs || []).filter((x) => Number.isFinite(x.fearBefore) && Number.isFinite(x.fearAfter));
  if (!l.length) return { count: (logs || []).length, line: '' };
  const before = l.reduce((a, x) => a + x.fearBefore, 0) / l.length;
  const after = l.reduce((a, x) => a + x.fearAfter, 0) / l.length;
  return {
    count: (logs || []).length,
    before: Math.round(before * 10) / 10,
    after: Math.round(after * 10) / 10,
    line: after < before
      ? `On average you expected ${before.toFixed(1)}/10 discomfort; it was ${after.toFixed(1)}/10. Fear predicts worse than reality.`
      : `It felt about as hard as you expected (${after.toFixed(1)}/10). Keep the steps small.`,
  };
}

/** Nights with the phone outside the bedroom this month (not a streak). */
export function nightsThisMonth(nights, mKey = monthKey(), today = dayKey()) {
  const n = (nights || []).filter((d) => d.date.startsWith(mKey) && d.date <= today).length;
  const elapsed = Number(today.slice(8, 10));
  return { n, elapsed, label: `${n} of ${elapsed} nights this month` };
}
