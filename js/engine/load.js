// Training load per muscle: weekly hard sets against an evidence-based target
// (about 10–20 sets per muscle per week for growth) and recovery since the
// last session. This is what the "heat" map shows — effort, not temperature.

import { BY_ID, MUSCLE_LABEL } from './exercises.js';
import { DAY } from './util.js';

export const TRACKED = ['chest', 'back', 'delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];
const ALIAS = { lats: 'back', traps: 'back', abs: 'core', adductors: 'quads', forearms: null };
const RECOVER_H = { quads: 72, hamstrings: 72, glutes: 72, back: 60, chest: 60, delts: 48, biceps: 48, triceps: 48, calves: 48, core: 36 };

/** Weekly sets, recovery % and status for each tracked muscle. */
export function muscleLoad(state, now = Date.now(), goal = state.profile?.goal) {
  const target = goal === 'muscle' ? 12 : goal === 'strength' ? 10 : 8;
  const sets = Object.fromEntries(TRACKED.map((m) => [m, 0]));
  const last = {};
  for (const w of state.workouts || []) {
    const age = now - (w.at || 0);
    for (const e of w.exercises) {
      const ex = BY_ID[e.id];
      if (!ex) continue;
      const n = e.sets.length;
      const add = (m, f) => {
        const k = ALIAS[m] === undefined ? m : ALIAS[m];
        if (!k || !(k in sets)) return;
        if (age <= 7 * DAY) sets[k] += n * f;
        if (!last[k] || w.at > last[k]) last[k] = w.at;
      };
      ex.muscles.primary.forEach((m) => add(m, 1));
      ex.muscles.secondary.forEach((m) => add(m, 0.5));
    }
  }
  return TRACKED.map((m) => {
    const s = Math.round(sets[m] * 10) / 10;
    const hrs = last[m] ? (now - last[m]) / 3600000 : null;
    const recovery = hrs == null ? 100 : Math.min(100, Math.round((hrs / RECOVER_H[m]) * 100));
    const status = s === 0 ? 'untrained' : s < target * 0.5 ? 'low' : s <= target * 1.6 ? 'on' : 'high';
    return { id: m, label: MUSCLE_LABEL[m] || m, sets: s, target, recovery, status, heat: Math.min(1, s / target) };
  });
}

/** One plain-language suggestion for the coming sessions. */
export function loadAdvice(rows) {
  const trained = rows.filter((r) => r.sets > 0);
  if (!trained.length) return 'No sessions this week yet. Your first one sets the baseline.';
  const low = rows.filter((r) => r.status === 'low' || r.status === 'untrained').map((r) => r.label);
  const sore = rows.filter((r) => r.recovery < 50).map((r) => r.label);
  const high = rows.filter((r) => r.status === 'high').map((r) => r.label);
  if (sore.length) return `${sore.slice(0, 2).join(' and ')} still recovering — train them lighter or let them rest today.`;
  if (high.length) return `${high[0]} has more than enough volume this week. Extra sets now add fatigue, not results.`;
  if (low.length) return `Under target this week: ${low.slice(0, 3).join(', ')}. Your next sessions should prioritise them.`;
  return 'Every major muscle is in its target range this week. Keep it steady.';
}
