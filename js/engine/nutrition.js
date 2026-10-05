// BMR-regulated nutrition: energy budget, macros, meal plans and the weekly
// "metabolic regulator" that re-tunes calories from the real weight trend.
// Rule that never bends: the daily target never goes below BMR.

import { clamp, round, seeded, slope, keyToTs, DAY } from './util.js';
import { DISHES, dietAllows } from './foods.js';

export const ACTIVITY = [
  { id: 'desk', short: 'Sitting', label: 'Mostly sitting', hint: 'Desk job, study, driving', f: 1.2 },
  { id: 'light', short: 'Some walking', label: 'On my feet sometimes', hint: 'Teaching, retail, some walking', f: 1.3 },
  { id: 'active', short: 'On feet', label: 'On my feet most of the day', hint: 'Waiter, nurse, 10k+ steps', f: 1.45 },
  { id: 'physical', short: 'Physical', label: 'Physical work', hint: 'Construction, farming, delivery', f: 1.6 },
];

export const GOALS = [
  { id: 'lose', label: 'Lose fat', short: 'Fat loss' },
  { id: 'muscle', label: 'Build muscle', short: 'Muscle gain' },
  { id: 'strength', label: 'Get stronger', short: 'Strength' },
  { id: 'fit', label: 'Feel fit & calm', short: 'Fitness' },
];

export function bmi(p) {
  const h = p.height / 100;
  return p.weight / (h * h);
}

/** Mifflin-St Jeor, or Katch-McArdle when body fat % is known. */
export function bmr(p) {
  if (p.bodyFat && p.bodyFat > 3 && p.bodyFat < 60) {
    const lbm = p.weight * (1 - p.bodyFat / 100);
    return { value: Math.round(370 + 21.6 * lbm), formula: 'Katch-McArdle', explain: `370 + 21.6 × lean mass (${lbm.toFixed(1)} kg)` };
  }
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  const value = Math.round(base + (p.sex === 'female' ? -161 : 5));
  return {
    value,
    formula: 'Mifflin-St Jeor',
    explain: `10 × ${p.weight} kg + 6.25 × ${p.height} cm − 5 × ${p.age} ${p.sex === 'female' ? '− 161' : '+ 5'}`,
  };
}

export function sessionKcal(p) {
  const met = p.place === 'gym' ? 5.0 : 6.0;
  return Math.round((met - 1) * p.weight * ((p.minutes || 45) / 60));
}

/** Full energy picture. adjust = regulator offset in kcal/day. */
export function energy(p, adjust = 0) {
  const b = bmr(p).value;
  const act = ACTIVITY.find((a) => a.id === p.activity) || ACTIVITY[0];
  const movement = Math.round(b * (act.f - 1));
  const perSession = sessionKcal(p);
  const training = Math.round((perSession * (p.days || 3)) / 7);
  const maintenance = b + movement + training;

  let goalDelta = 0;
  if (p.goal === 'lose') goalDelta = -Math.min(750, Math.round(maintenance * 0.2));
  else if (p.goal === 'muscle') goalDelta = { beginner: 300, intermediate: 250, advanced: 200 }[p.level] ?? 250;
  else if (p.goal === 'strength') goalDelta = 150;

  const raw = maintenance + goalDelta + adjust;
  const target = Math.max(b, round(raw, 10));
  const floorActive = raw < b;

  const T = clamp(p.days || 3, 0, 7), R = 7 - T;
  let trainDay = target, restDay = target;
  if (T > 0 && R > 0) {
    const d = round(target * 0.07, 10);
    trainDay = target + d;
    restDay = round(target - (d * T) / R, 10);
    if (restDay < b) { trainDay = target; restDay = target; }
  }
  return { bmr: b, movement, training, perSession, maintenance, goalDelta, adjust, target, floorActive, trainDay, restDay };
}

export function macros(kcal, p) {
  const h = p.height / 100;
  const refW = bmi(p) > 28 ? 25 * h * h : p.weight;
  const perKg = { lose: 2.0, muscle: 1.8, strength: 1.8, fit: 1.6 }[p.goal] ?? 1.6;
  const protein = Math.round(refW * perKg);
  const fat = Math.round(Math.max(refW * 0.7, (kcal * 0.25) / 9));
  const carbs = Math.max(60, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { protein, fat, carbs, fiber: Math.round((kcal / 1000) * 14) };
}

export function waterLitres(p, trainingDay) {
  return Math.round((p.weight * 0.035 + (trainingDay ? 0.5 : 0)) * 10) / 10;
}

const SLOTS = [
  { id: 'b', key: 'breakfast', label: 'Breakfast', share: 0.25 },
  { id: 'l', key: 'lunch', label: 'Lunch', share: 0.32 },
  { id: 's', key: 'snack', label: 'Snack', share: 0.13 },
  { id: 'd', key: 'dinner', label: 'Dinner', share: 0.30 },
];
export const MEAL_SLOTS = SLOTS;

/**
 * Build a day's meals. swaps = {breakfast: n} rotates a slot's choice.
 */
export function mealPlan(p, dateKey, kcal, swaps = {}, trainingDay = false) {
  const used = new Set();
  const meals = SLOTS.map((slot) => {
    const target = kcal * slot.share;
    const pool = DISHES.filter((d) => d.slots.includes(slot.id) && dietAllows(p.diet || 'veg', d.diet) && !used.has(d.id));
    const rnd = seeded(`${dateKey}:${slot.id}:${swaps[slot.key] || 0}`);
    const scored = pool.map((d) => ({ d, w: ((d.p * 4) / d.kcal) * 0.65 + rnd() * 0.45 })).sort((a, b) => b.w - a.w);
    const dish = scored[0]?.d || DISHES[0];
    used.add(dish.id);
    const mult = clamp(Math.round((target / dish.kcal) * 4) / 4, 0.5, 2.5);
    return {
      slot: slot.key,
      label: slot.id === 's' && trainingDay ? 'Pre / post-workout' : slot.label,
      dish, mult,
      kcal: Math.round(dish.kcal * mult), p: Math.round(dish.p * mult), c: Math.round(dish.c * mult), f: Math.round(dish.f * mult),
    };
  });
  const totals = meals.reduce((t, m) => ({ kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  return { meals, totals };
}

export function proteinTopUp(diet) {
  return {
    vegan: 'Add 250 ml soy milk or 50 g soya chunks (≈ 25 g protein).',
    veg: 'Add a whey shake or 100 g paneer (≈ 20–25 g protein).',
    egg: 'Add 3 boiled eggs or a whey shake (≈ 20–25 g protein).',
    nonveg: 'Add 100 g grilled chicken or a whey shake (≈ 25 g protein).',
  }[diet] || 'Add a protein-rich snack (≈ 25 g protein).';
}

/** Expected weekly change in kg for the goal. */
export function expectedRate(p) {
  return { lose: -0.005, muscle: 0.0025, strength: 0.001, fit: 0 }[p.goal] * p.weight;
}

/**
 * Weekly metabolic regulator.
 * weights: [{date, kg}], state: {adjust, lastAdjustAt}
 */
export function regulate(weights, p, state = {}, now = Date.now()) {
  const recent = weights.filter((w) => keyToTs(w.date) >= now - 28 * DAY).sort((a, b) => a.date.localeCompare(b.date));
  const adjust = state.adjust || 0;
  if (recent.length < 4) {
    return { ready: false, adjust, message: `Log your weight ${4 - recent.length} more time${recent.length === 3 ? '' : 's'} (any days) and the regulator starts tuning your calories.` };
  }
  const t0 = keyToTs(recent[0].date);
  const span = (keyToTs(recent[recent.length - 1].date) - t0) / DAY;
  if (span < 10) {
    return { ready: false, adjust, message: `Keep logging — the regulator needs about 10 days of data (you have ${Math.round(span)}).` };
  }
  const weekly = slope(recent.map((w) => [(keyToTs(w.date) - t0) / DAY, w.kg])) * 7;
  const expected = expectedRate(p);
  const diff = weekly - expected;
  const due = !state.lastAdjustAt || now - state.lastAdjustAt >= 6 * DAY;
  let step = 0;
  if (Math.abs(diff) >= 0.1) step = clamp(round((-diff * 7700) / 7 * 0.5, 10), -150, 150);
  const next = clamp(adjust + step, -500, 400);
  const fmt = (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} kg/week`;
  let message;
  if (!due) {
    const days = Math.max(1, Math.ceil((state.lastAdjustAt + 6 * DAY - now) / DAY));
    message = `Trend ${fmt(weekly)} vs plan ${fmt(expected)}. Next calorie check in ${days} day${days > 1 ? 's' : ''}.`;
  } else if (step === 0) message = `On track: trend ${fmt(weekly)} vs plan ${fmt(expected)}. Calories stay the same.`;
  else if (step < 0) message = `Trend ${fmt(weekly)} vs plan ${fmt(expected)} — trimming ${-step} kcal/day.`;
  else message = `Trend ${fmt(weekly)} vs plan ${fmt(expected)} — adding ${step} kcal/day so you don't under-fuel.`;
  return { ready: true, due, weekly, expected, step, adjust: due ? next : adjust, message };
}
