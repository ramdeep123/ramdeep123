// Weekly program generator + progression + daily readiness.

import { BY_ID } from './exercises.js';
import { clamp, round } from './util.js';

// candidates per movement pattern and place, best first
const PATTERNS = {
  squat: { gym: ['back-squat', 'goblet-squat'], 'home-db': ['goblet-squat', 'squat'], home: ['squat', 'wall-sit'] },
  lunge: { gym: ['lunge'], 'home-db': ['lunge'], home: ['lunge'] },
  hinge: { gym: ['deadlift', 'rdl', 'glute-bridge'], 'home-db': ['rdl', 'glute-bridge'], home: ['glute-bridge'] },
  hinge2: { gym: ['rdl', 'glute-bridge'], 'home-db': ['glute-bridge', 'rdl'], home: ['glute-bridge'] },
  pushH: { gym: ['bench-press', 'pushup'], 'home-db': ['pushup'], home: ['pushup'] },
  pushV: { gym: ['shoulder-press', 'dips'], 'home-db': ['shoulder-press', 'dips'], home: ['dips', 'pushup'] },
  pullH: { gym: ['bent-row'], 'home-db': ['bent-row', 'superman'], home: ['superman'] },
  pullV: { gym: ['pullup', 'bent-row'], 'home-db': ['bent-row', 'superman'], home: ['superman'] },
  delts: { gym: ['lateral-raise'], 'home-db': ['lateral-raise'], home: ['pushup'] },
  arms: { gym: ['bicep-curl', 'dips'], 'home-db': ['bicep-curl', 'dips'], home: ['dips'] },
  triceps: { gym: ['dips'], 'home-db': ['dips'], home: ['dips'] },
  calves: { gym: ['calf-raise'], 'home-db': ['calf-raise'], home: ['calf-raise'] },
  core: { gym: ['plank', 'crunch'], 'home-db': ['plank', 'crunch'], home: ['plank', 'crunch'] },
  cond: { gym: ['mountain-climber', 'jumping-jack'], 'home-db': ['jumping-jack', 'mountain-climber', 'high-knees'], home: ['jumping-jack', 'high-knees', 'mountain-climber'] },
};

const AVOID = {
  knees: ['lunge', 'jumping-jack', 'high-knees', 'back-squat', 'mountain-climber'],
  back: ['deadlift', 'back-squat', 'bent-row', 'superman', 'rdl'],
  shoulders: ['shoulder-press', 'dips', 'lateral-raise', 'pullup', 'bench-press'],
};

const DAY_TYPES = {
  'full-a': { name: 'Full Body A', focus: 'Legs · Push · Pull', slots: ['squat', 'pushH', 'pullH', 'hinge2', 'pushV', 'core'] },
  'full-b': { name: 'Full Body B', focus: 'Hinge · Press · Pull', slots: ['hinge', 'pushV', 'pullV', 'lunge', 'arms', 'core'] },
  'full-c': { name: 'Full Body C', focus: 'Legs · Chest · Back', slots: ['squat', 'pushH', 'pullH', 'delts', 'calves', 'core'] },
  'upper-a': { name: 'Upper A', focus: 'Chest · Back · Arms', slots: ['pushH', 'pullH', 'pushV', 'pullV', 'arms', 'delts'] },
  'upper-b': { name: 'Upper B', focus: 'Shoulders · Back · Chest', slots: ['pushV', 'pullV', 'pushH', 'pullH', 'delts', 'triceps'] },
  'lower-a': { name: 'Lower A', focus: 'Quads · Glutes · Core', slots: ['squat', 'hinge2', 'lunge', 'calves', 'core'] },
  'lower-b': { name: 'Lower B', focus: 'Hamstrings · Glutes · Core', slots: ['hinge', 'squat', 'lunge', 'calves', 'core'] },
  push: { name: 'Push', focus: 'Chest · Shoulders · Triceps', slots: ['pushH', 'pushV', 'delts', 'triceps', 'core'] },
  pull: { name: 'Pull', focus: 'Back · Biceps', slots: ['pullV', 'pullH', 'arms', 'core'] },
  legs: { name: 'Legs', focus: 'Quads · Hamstrings · Glutes', slots: ['squat', 'hinge', 'lunge', 'calves', 'core'] },
};

const SPLITS = {
  2: { days: [0, 3], types: ['full-a', 'full-b'], name: 'Full body ×2' },
  3: { days: [0, 2, 4], types: ['full-a', 'full-b', 'full-c'], name: 'Full body ×3' },
  4: { days: [0, 1, 3, 4], types: ['upper-a', 'lower-a', 'upper-b', 'lower-b'], name: 'Upper / Lower' },
  5: { days: [0, 1, 2, 4, 5], types: ['push', 'pull', 'legs', 'upper-a', 'lower-b'], name: 'Push · Pull · Legs + Upper/Lower' },
  6: { days: [0, 1, 2, 3, 4, 5], types: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], name: 'Push · Pull · Legs ×2' },
};

const COMPOUND = new Set(['back-squat', 'goblet-squat', 'squat', 'deadlift', 'rdl', 'bench-press', 'pushup', 'shoulder-press', 'bent-row', 'pullup', 'lunge']);

export function prescription(exId, goal, level) {
  const ex = BY_ID[exId];
  const compound = COMPOUND.has(exId);
  const lvl = { beginner: -1, intermediate: 0, advanced: 1 }[level] ?? 0;
  if (ex.unit === 'sec') {
    const sec = ex.pattern === 'cond' ? 30 + (lvl + 1) * 10 : 30 + (lvl + 1) * 15;
    return { sets: 3, reps: [sec, sec], unit: 'sec', rest: ex.pattern === 'cond' ? 30 : 45 };
  }
  let p;
  if (goal === 'strength' && compound) p = { sets: 4, reps: [4, 6], rest: 150 };
  else if (goal === 'strength') p = { sets: 3, reps: [8, 10], rest: 90 };
  else if (goal === 'muscle') p = { sets: compound ? 4 : 3, reps: [8, 12], rest: 90 };
  else if (goal === 'lose') p = { sets: 3, reps: [12, 15], rest: compound ? 75 : 45 };
  else p = { sets: 3, reps: [10, 12], rest: 60 };
  if (exId === 'pullup') {
    p.reps = lvl < 0 ? [3, 6] : [6, 10];
  } else if (!ex.loadRatio && ex.equip !== 'barbell' && lvl >= 0) {
    // bodyweight moves get more reps once you're past the beginner stage
    p.reps = p.reps.map((r) => Math.round(r * 1.25));
  }
  if (compound && lvl > 0) p.sets += 1;
  p.sets = clamp(p.sets, 2, 5);
  return { ...p, unit: 'reps' };
}

function pick(pattern, place, avoid, used, alt = 0) {
  const list = (PATTERNS[pattern]?.[place] || []).filter((id) => !avoid.has(id) && !used.has(id));
  if (!list.length) return null;
  return list[Math.min(alt, list.length - 1)];
}

/** Build the weekly program from a profile. */
export function buildProgram(profile) {
  const days = clamp(profile.days || 3, 2, 6);
  const split = SPLITS[days];
  const place = profile.place || 'gym';
  const avoid = new Set((profile.injuries || []).flatMap((i) => AVOID[i] || []));
  const maxMoves = profile.minutes <= 30 ? 4 : profile.minutes <= 45 ? 5 : 6;
  const seenType = {};

  const week = Array.from({ length: 7 }, (_, d) => ({ weekday: d, rest: true, name: 'Recovery', focus: 'Walk, stretch, breathe', moves: [] }));
  split.days.forEach((wd, i) => {
    const typeId = split.types[i];
    const type = DAY_TYPES[typeId];
    const alt = (seenType[typeId] = (seenType[typeId] ?? -1) + 1);
    const used = new Set();
    const moves = [];
    for (const slot of type.slots) {
      if (moves.length >= maxMoves) break;
      const id = pick(slot, place, avoid, used, alt);
      if (!id) continue;
      used.add(id);
      moves.push({ id, ...prescription(id, profile.goal, profile.level) });
    }
    // small home setups can run out of distinct moves: top up with core work
    for (const extra of ['core', 'core', 'calves', 'cond']) {
      if (moves.length >= Math.min(maxMoves, 4)) break;
      const id = pick(extra, place, avoid, used, moves.length % 2);
      if (id) { used.add(id); moves.push({ id, ...prescription(id, profile.goal, profile.level) }); }
    }
    if (profile.goal === 'lose') {
      const fin = pick('cond', place, avoid, used, i % 2);
      if (fin) moves.push({ id: fin, ...prescription(fin, 'lose', profile.level), finisher: true });
    }
    week[wd] = { weekday: wd, rest: false, typeId, name: type.name, focus: type.focus, moves };
  });
  return { splitName: split.name, days, place, week, createdAt: Date.now() };
}

export function estimateMinutes(day) {
  let sec = 0;
  for (const m of day.moves) {
    const work = m.unit === 'sec' ? m.reps[1] : m.reps[1] * 3.2;
    sec += m.sets * (work + m.rest) + 60;
  }
  return Math.round(sec / 60);
}

/** Suggested load (kg) for an exercise from history or a bodyweight ratio. */
export function suggestLoad(exId, profile, loads = {}) {
  const ex = BY_ID[exId];
  if (!ex.loadRatio) return null;
  const last = loads[exId];
  const step = ex.upper ? 2.5 : 5;
  if (last) {
    if (last.hitTop && (last.form ?? 100) >= 75) return { kg: last.kg + (ex.equip === 'dumbbell' ? 1 : step), why: 'You hit the top of the range with good form — add weight.' };
    if (last.missed) return { kg: Math.max(0, round(last.kg * 0.95, ex.equip === 'dumbbell' ? 1 : 2.5)), why: 'Last session fell short — a small deload to build back up.' };
    return { kg: last.kg, why: 'Same weight — aim for one more rep per set.' };
  }
  const sexF = profile.sex === 'female' ? (ex.upper ? 0.6 : 0.75) : 1;
  const lvlF = { beginner: 0.7, intermediate: 1, advanced: 1.3 }[profile.level] ?? 1;
  const unit = ex.equip === 'dumbbell' ? 1 : 2.5;
  const minKg = ex.equip === 'barbell' ? 20 : 2;
  const kg = Math.max(minKg, round(profile.weight * ex.loadRatio * sexF * lvlF, unit));
  return { kg, why: ex.equip === 'dumbbell' ? 'Starting weight per dumbbell — adjust after your first set.' : 'Starting weight including the bar — adjust after your first set.' };
}

/** Readiness 0–100 from a morning check-in. */
export function readiness(c) {
  if (!c) return null;
  const sleep = clamp((c.sleep - 4) / 4, 0, 1) * 100;
  const energy = ((c.energy - 1) / 4) * 100;
  const sore = ((5 - c.soreness) / 4) * 100;
  const stress = ((10 - c.stress) / 9) * 100;
  return Math.round(sleep * 0.35 + energy * 0.25 + sore * 0.2 + stress * 0.2);
}

export function readinessAdvice(score) {
  if (score == null) return { tone: 'none', text: 'Check in to tune today’s session to your body.' };
  if (score >= 80) return { tone: 'hot', text: 'Green light. Push for a rep or weight PR today.' };
  if (score >= 55) return { tone: 'warm', text: 'Solid. Train as planned and keep form tight.' };
  if (score >= 40) return { tone: 'cool', text: 'Running low. We’ll drop one set per exercise today.' };
  return { tone: 'cold', text: 'Recovery day. Swap the session for a walk and a breath session.' };
}

export { DAY_TYPES, SPLITS };
