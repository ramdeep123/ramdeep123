// Persistent app state (localStorage; survives app restarts on Android too).

import { dayKey, DAY, uid } from './engine/util.js';
import { newSub } from './engine/subscription.js';
import { buildProgram } from './engine/routine.js';

const KEY = 'kaya.v1';

export function blankState() {
  return {
    v: 1,
    profile: null,
    sub: null,
    settings: { voice: true, sound: true, haptics: true },
    program: null,
    workouts: [],
    weights: [],
    meditations: [],
    checkins: {},
    days: {},
    nutrition: { adjust: 0, lastAdjustAt: 0, log: [] },
    goals: [],
    loads: {},
    sample: false,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blankState(), ...JSON.parse(raw) };
  } catch (e) { /* storage blocked or corrupt */ }
  return blankState();
}

export const state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function update(fn) {
  fn(state);
  save();
}

export function reset() {
  const fresh = blankState();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  save();
}

export function replaceAll(obj) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, blankState(), obj);
  save();
}

export function today(key = dayKey()) {
  state.days[key] ||= { eaten: {}, water: 0, swaps: {} };
  return state.days[key];
}

export function latestWeight() {
  const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return w.length ? w[w.length - 1].kg : state.profile?.weight;
}

export function createProfile(profile, now = Date.now()) {
  state.profile = { ...profile, createdAt: now };
  state.sub = newSub(now);
  state.program = buildProgram(state.profile);
  state.weights = [{ date: dayKey(now), kg: profile.weight }];
  state.goals = defaultGoals(state.profile);
  save();
}

export function defaultGoals(p) {
  const goals = [];
  if (p.goal === 'lose') goals.push({ id: uid(), type: 'weight', target: Math.round((p.weight - Math.max(2, p.weight * 0.06)) * 10) / 10, start: p.weight });
  if (p.goal === 'muscle') goals.push({ id: uid(), type: 'weight', target: Math.round((p.weight + 3) * 10) / 10, start: p.weight });
  goals.push({ id: uid(), type: 'workouts', target: p.days || 3 });
  goals.push({ id: uid(), type: 'mind', target: 30 });
  return goals;
}

/** A realistic sample profile so the app can be explored without typing. */
export function seedSample(now = Date.now()) {
  const profile = {
    name: 'Aarav', sex: 'male', age: 27, height: 175, weight: 79.4, goal: 'lose', level: 'beginner',
    days: 4, place: 'gym', minutes: 45, diet: 'veg', activity: 'desk', injuries: [],
  };
  createProfile(profile, now - 2 * DAY);
  state.sample = true;
  const weights = [];
  for (let i = 20; i >= 0; i -= 2) {
    const kg = 79.4 - (20 - i) * 0.07 + Math.sin(i * 1.7) * 0.25;
    weights.push({ date: dayKey(now - i * DAY), kg: Math.round(kg * 10) / 10 });
  }
  state.weights = weights;
  state.profile.weight = weights[weights.length - 1].kg;
  const mk = (daysAgo, dayName, exercises, mins) => ({
    id: uid(), date: dayKey(now - daysAgo * DAY), at: now - daysAgo * DAY, dayName, durationSec: mins * 60,
    exercises: exercises.map(([id, sets]) => ({ id, sets: sets.map(([reps, kg, form]) => ({ reps, kg, form })) })),
  });
  state.workouts = [
    mk(13, 'Upper A', [['bench-press', [[12, 30, 90], [12, 30, 85], [11, 30, 80]]], ['bent-row', [[12, 27.5, 90], [12, 27.5, 90], [12, 27.5, 85]]], ['shoulder-press', [[12, 8, 85], [11, 8, 80], [10, 8, 80]]]], 44),
    mk(12, 'Lower A', [['back-squat', [[12, 35, 80], [12, 35, 85], [12, 35, 85]]], ['rdl', [[12, 30, 90], [12, 30, 90], [12, 30, 90]]], ['lunge', [[16, 0, 85], [16, 0, 80], [15, 0, 80]]]], 47),
    mk(9, 'Upper B', [['shoulder-press', [[12, 8, 90], [12, 8, 85], [12, 8, 85]]], ['pullup', [[5, 0, 80], [4, 0, 75], [4, 0, 75]]], ['bench-press', [[12, 30, 90], [12, 30, 90], [12, 30, 85]]]], 46),
    mk(8, 'Lower B', [['deadlift', [[12, 45, 85], [12, 45, 80], [11, 45, 80]]], ['back-squat', [[12, 37.5, 85], [12, 37.5, 85], [11, 37.5, 80]]], ['calf-raise', [[19, 0, 95], [19, 0, 95], [18, 0, 95]]]], 45),
    mk(6, 'Upper A', [['bench-press', [[12, 32.5, 85], [12, 32.5, 85], [12, 32.5, 80]]], ['bent-row', [[12, 30, 90], [12, 30, 85], [12, 30, 85]]], ['lateral-raise', [[15, 4, 90], [15, 4, 85], [14, 4, 85]]]], 43),
    mk(5, 'Lower A', [['back-squat', [[12, 40, 85], [12, 40, 90], [12, 40, 85]]], ['rdl', [[12, 32.5, 90], [12, 32.5, 90], [12, 32.5, 85]]], ['plank', [[45, 0, 90], [45, 0, 85], [40, 0, 85]]]], 48),
    mk(2, 'Upper B', [['shoulder-press', [[12, 9, 85], [12, 9, 85], [11, 9, 80]]], ['bicep-curl', [[12, 8, 75], [12, 8, 80], [10, 8, 75]]], ['pushup', [[19, 0, 85], [17, 0, 80], [15, 0, 80]]]], 42),
    mk(1, 'Lower B', [['deadlift', [[12, 47.5, 85], [12, 47.5, 85], [12, 47.5, 80]]], ['lunge', [[18, 0, 85], [18, 0, 85], [16, 0, 80]]], ['mountain-climber', [[30, 0, 90], [30, 0, 90], [30, 0, 85]]]], 44),
  ];
  state.loads = {
    'bench-press': { kg: 32.5, hitTop: true, form: 83 }, 'back-squat': { kg: 40, hitTop: true, form: 87 },
    deadlift: { kg: 47.5, hitTop: true, form: 83 }, rdl: { kg: 32.5, hitTop: true, form: 88 },
    'bent-row': { kg: 30, hitTop: true, form: 87 }, 'shoulder-press': { kg: 9, hitTop: false, form: 83 },
    'bicep-curl': { kg: 8, hitTop: false, missed: false, form: 77 }, 'lateral-raise': { kg: 4, hitTop: true, form: 87 },
  };
  state.meditations = [
    { id: uid(), date: dayKey(now - 6 * DAY), at: now - 6 * DAY, session: 'sigh', minutes: 3, before: 7, after: 4 },
    { id: uid(), date: dayKey(now - 4 * DAY), at: now - 4 * DAY, session: 'coherent', minutes: 6, before: 6, after: 3 },
    { id: uid(), date: dayKey(now - 3 * DAY), at: now - 3 * DAY, session: '478', minutes: 5, before: 5, after: 3 },
    { id: uid(), date: dayKey(now - 1 * DAY), at: now - 1 * DAY, session: 'cooldown', minutes: 4, before: 6, after: 4 },
  ];
  state.checkins[dayKey(now)] = { sleep: 7, energy: 4, soreness: 2, stress: 4 };
  state.nutrition = { adjust: -60, lastAdjustAt: now - 3 * DAY, log: [{ at: now - 3 * DAY, step: -60, message: 'Trend −0.25 kg/week vs plan −0.40 kg/week — trimming 60 kcal/day.' }] };
  const d = today(dayKey(now));
  d.eaten = { breakfast: true };
  d.water = 3;
  save();
}
