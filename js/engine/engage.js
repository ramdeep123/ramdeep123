// Daily engagement: streaks (with a weekly freeze), three daily quests,
// XP and levels, badges, and the reminder plan handed to the Android app.
// Everything is derived from the user's real history, so it can't drift.

import { DAY, dayKey, keyToTs, weekday, hash } from './util.js';

export const LEVELS = [
  { xp: 0, name: 'Spark' }, { xp: 150, name: 'Kindle' }, { xp: 400, name: 'Ember' }, { xp: 800, name: 'Flame' },
  { xp: 1400, name: 'Blaze' }, { xp: 2200, name: 'Furnace' }, { xp: 3300, name: 'Forge' }, { xp: 4700, name: 'Inferno' },
  { xp: 6500, name: 'Solar' }, { xp: 9000, name: 'Supernova' },
];

const isCoach = (w) => w.dayName === 'Coach session';

/** Per-day activity summary from history. */
export function dayLog(state) {
  const log = {};
  const get = (k) => (log[k] ||= { workout: false, coachSets: 0, mind: 0, checkin: false, meals: 0, water: 0, early: false });
  for (const w of state.workouts || []) {
    const d = get(w.date);
    if (isCoach(w)) d.coachSets += w.exercises.reduce((a, e) => a + e.sets.length, 0);
    else { d.workout = true; if (new Date(w.at).getHours() < 8) d.early = true; }
  }
  for (const m of state.meditations || []) get(m.date).mind += 1;
  for (const k of Object.keys(state.checkins || {})) get(k).checkin = true;
  for (const [k, v] of Object.entries(state.days || {})) {
    const d = get(k);
    d.meals = Object.values(v.eaten || {}).filter(Boolean).length;
    d.water = v.water || 0;
  }
  return log;
}

const active = (d) => !!d && (d.workout || d.coachSets > 0 || d.mind > 0 || d.checkin || d.meals > 0);

/**
 * Current streak. Today counts once you do anything; until then yesterday's
 * streak is still alive. One missed day per 7 is bridged by a streak freeze.
 */
export function streak(state, now = Date.now()) {
  const log = dayLog(state);
  const today = dayKey(now);
  let t = active(log[today]) ? now : now - DAY;
  let current = 0, sinceFreeze = 99;
  const frozen = [];
  for (let i = 0; i < 400; i++) {
    const k = dayKey(t);
    if (active(log[k])) { current++; sinceFreeze++; }
    else if (current > 0 && sinceFreeze >= 7 && active(log[dayKey(t - DAY)])) { frozen.push(k); sinceFreeze = 0; }
    else break;
    t -= DAY;
  }
  // best streak over all history (no freezes, simple scan)
  const keys = Object.keys(log).filter((k) => active(log[k])).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    run = prev && keyToTs(k) - keyToTs(prev) === DAY ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  const lastFreeze = frozen[0] ? keyToTs(frozen[0]) : null;
  const freezeReady = !lastFreeze || now - lastFreeze >= 7 * DAY;
  return { current, best: Math.max(best, current), todayDone: active(log[today]), frozen, freezeReady };
}

/** The three daily quests. */
export function quests(state, now = Date.now()) {
  const k = dayKey(now);
  const d = dayLog(state)[k] || {};
  const day = state.program?.week?.[weekday(now)];
  const training = !!day && !day.rest;
  return [
    { id: 'checkin', title: 'Morning check-in', sub: '20 seconds · tunes today’s plan', done: !!d.checkin, act: 'checkin' },
    training
      ? { id: 'move', title: `Train: ${day.name}`, sub: day.focus, done: !!d.workout, act: 'startSession' }
      : { id: 'move', title: 'Recovery: 3-minute breath', sub: 'Rest day · keep the fire low and steady', done: (d.mind || 0) > 0 || !!d.workout, act: 'quickBreath' },
    { id: 'fuel', title: 'Log 2 meals', sub: 'Tick them on the Fuel tab', done: (d.meals || 0) >= 2, act: 'goFuel' },
  ];
}

export function dayClosed(state, now = Date.now()) {
  return quests(state, now).every((q) => q.done);
}

/** Total XP from history. */
export function xp(state) {
  const log = dayLog(state);
  let total = 0;
  for (const [k, d] of Object.entries(log)) {
    let x = 0;
    if (d.workout) x += 50;
    x += Math.min(4, d.coachSets) * 15;
    x += Math.min(2, d.mind) * 20;
    if (d.checkin) x += 10;
    x += Math.min(4, d.meals) * 5;
    x += Math.min(12, d.water);
    const closed = d.checkin && (d.workout || d.mind > 0) && d.meals >= 2;
    if (closed) x += 30;
    total += x;
    void k;
  }
  return total;
}

export function level(points) {
  let i = 0;
  while (i < LEVELS.length - 1 && points >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1];
  return {
    n: i + 1, name: cur.name, xp: points,
    next: next ? next.xp : null,
    pct: next ? (points - cur.xp) / (next.xp - cur.xp) : 1,
  };
}

export const BADGES = [
  { id: 'first', title: 'First fire', text: 'Finish your first session' },
  { id: 'streak3', title: '3-day streak', text: 'Show up 3 days in a row' },
  { id: 'streak7', title: 'Week of heat', text: '7-day streak' },
  { id: 'streak30', title: 'Unbreakable', text: '30-day streak' },
  { id: 'ten', title: 'Ten sessions', text: 'Complete 10 workouts' },
  { id: 'fifty', title: 'Fifty sessions', text: 'Complete 50 workouts' },
  { id: 'form90', title: 'Textbook', text: 'A set with form score 90+' },
  { id: 'zen10', title: 'Cool head', text: '10 breath sessions' },
  { id: 'early', title: 'Early bird', text: 'Train before 8 am' },
  { id: 'closer7', title: 'Closer', text: 'Close 7 days' },
  { id: 'scale4', title: 'Honest scale', text: 'Log your weight 4 times' },
];

export function badges(state, now = Date.now()) {
  const log = dayLog(state);
  const s = streak(state, now);
  const sessions = (state.workouts || []).filter((w) => !isCoach(w)).length;
  const bestForm = Math.max(0, ...(state.workouts || []).flatMap((w) => w.exercises.flatMap((e) => e.sets.map((x) => x.form || 0))));
  const closedDays = Object.values(log).filter((d) => d.checkin && (d.workout || d.mind > 0) && d.meals >= 2).length;
  const got = {
    first: sessions >= 1, streak3: s.best >= 3, streak7: s.best >= 7, streak30: s.best >= 30,
    ten: sessions >= 10, fifty: sessions >= 50, form90: bestForm >= 90,
    zen10: (state.meditations || []).length >= 10, early: Object.values(log).some((d) => d.early),
    closer7: closedDays >= 7, scale4: (state.weights || []).length >= 4,
  };
  return BADGES.map((b) => ({ ...b, earned: !!got[b.id] }));
}

// ---------------- reminders ----------------
export const DEFAULT_REMINDERS = { enabled: false, morning: '07:30', training: '18:00', evening: '21:00' };

const pick = (list, seed) => list[hash(seed) % list.length];
const at = (ts, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(ts);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/**
 * Next 7 days of reminders, at most 3 a day, skipping anything already done today.
 * Each: {at, title, body, kind}
 */
export function reminderPlan(state, now = Date.now(), days = 7) {
  const r = { ...DEFAULT_REMINDERS, ...(state.reminders || {}) };
  if (!r.enabled || !state.profile) return [];
  const name = state.profile.name || 'there';
  const s = streak(state, now);
  const out = [];
  for (let i = 0; i < days; i++) {
    const ts = now + i * DAY;
    const k = dayKey(ts);
    const q = quests(state, ts);
    const day = state.program?.week?.[weekday(ts)];
    const training = !!day && !day.rest;
    const streakAhead = s.current + (s.todayDone ? i : i + 1);
    const today = i === 0;

    if (!(today && q[0].done)) {
      out.push({
        at: at(ts, r.morning), kind: 'morning', title: pick([
          `Morning, ${name}. How did you sleep?`,
          'Your readiness check is waiting',
          `Day ${streakAhead} starts with 20 seconds`,
          'Check in before you train',
        ], k + 'm'),
        body: pick([
          'Rate sleep, energy and stress — KAYA tunes today’s session to you.',
          streakAhead > 1 ? `Keep your ${streakAhead}-day streak alive.` : 'Start a streak today.',
          'Low on sleep? We’ll drop a set. Feeling great? Go for a PR.',
        ], k + 'mb'),
      });
    }
    if (!(today && q[1].done)) {
      out.push(training ? {
        at: at(ts, r.training), kind: 'training',
        title: pick([`${day.name} is ready`, `Time to train: ${day.focus}`, 'Your coach is warmed up', 'Session time'], k + 't'),
        body: pick([
          `${day.moves.length} moves, with the AI coach watching your form.`,
          'Prop the phone up, press start. Every rep counts — only the good ones.',
          'Show up for 10 minutes. You’ll stay for the rest.',
        ], k + 'tb'),
      } : {
        at: at(ts, r.training), kind: 'recovery',
        title: pick(['Rest day, not off day', 'Recovery keeps the fire lit', '3 minutes to cool the system'], k + 'r'),
        body: pick([
          'A 3-minute physiological sigh lowers stress fast and keeps your streak.',
          'Muscles grow while you rest. Breathe, walk, stretch.',
        ], k + 'rb'),
      });
    }
    out.push({
      at: at(ts, r.evening), kind: 'evening',
      title: pick(['Close your day', 'One more ring to fill', `Don’t let day ${streakAhead} slip`], k + 'e'),
      body: pick([
        'Finish your three daily quests before midnight.',
        'Log your meals and tick off what’s left. Small days build big streaks.',
        'Two minutes now saves your streak.',
      ], k + 'eb'),
    });
  }
  // drop evening nudge for today if the day is already closed
  return out.filter((x) => x.at > now + 60000 && !(x.kind === 'evening' && dayKey(x.at) === dayKey(now) && dayClosed(state, now)));
}
