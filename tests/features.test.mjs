import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REGIONS, dishesFor, dietAllows, DISHES } from '../js/engine/foods.js';
import { mealPlan } from '../js/engine/nutrition.js';
import { allLines, idForText, L } from '../js/engine/voicelines.js';
import { EXERCISES, BY_ID } from '../js/engine/exercises.js';
import { FormCoach, computeMetrics, framing, OneEuro } from '../js/engine/formcheck.js';
import { solve, sample, cycleLength } from '../js/engine/figure.js';
import { streak, quests, xp, level, badges, reminderPlan, dayClosed } from '../js/engine/engage.js';
import { muscleLoad, loadAdvice } from '../js/engine/load.js';
import { DAY, dayKey } from '../js/engine/util.js';

const P = { sex: 'female', age: 30, height: 165, weight: 62, goal: 'lose', diet: 'veg' };

test('every food region covers every meal for every diet', () => {
  for (const r of REGIONS) {
    for (const diet of ['vegan', 'veg', 'egg', 'nonveg']) {
      const pool = dishesFor(r.id).filter((d) => dietAllows(diet, d.diet));
      for (const slot of ['b', 'l', 'd', 's']) assert.ok(pool.some((d) => d.slots.includes(slot)), `${r.id} ${diet} ${slot}`);
      const plan = mealPlan({ ...P, diet, region: r.id }, '2026-10-07', 1900);
      assert.equal(new Set(plan.meals.map((m) => m.dish.id)).size, 4, `${r.id} ${diet} repeats a dish`);
      assert.ok(Math.abs(plan.totals.kcal - 1900) < 380, `${r.id} ${diet} kcal ${plan.totals.kcal}`);
    }
  }
  const ids = DISHES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'dish ids are unique');
});

test('regional plans mostly use local dishes', () => {
  for (const r of REGIONS.filter((x) => x.id !== 'in')) {
    let local = 0, total = 0;
    for (let d = 1; d <= 7; d++) {
      for (const m of mealPlan({ ...P, region: r.id, diet: 'nonveg' }, `2026-10-0${d}`, 2000).meals) {
        total++;
        if (m.dish.region === r.id) local++;
      }
    }
    assert.ok(local / total >= 0.7, `${r.id}: ${local}/${total} local`);
  }
});

test('voice script has a unique file per line and covers every spoken cue', () => {
  const lines = allLines();
  const ids = lines.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
  for (const ex of EXERCISES) {
    if (!ex.track) continue;
    if (ex.track.partialMsg) assert.ok(idForText(ex.track.partialMsg), ex.track.partialMsg);
    for (const r of ex.track.rules || []) assert.ok(idForText(r.msg), r.msg);
  }
  for (const v of Object.values(L)) assert.ok(ids.includes(v.id), v.id);
  assert.equal(idForText('Slow down — control every rep'), 'fix-tempo');
  assert.equal(idForText('One'), 'count-01');
});

// --- helpers to drive the coach from the animated mannequin ---
function toLandmarks(J, scale = 1000, ox = 400, oy = 600) {
  const P2 = (p) => ({ x: (p[0] + ox) / scale, y: (p[1] + oy) / scale, z: 0, visibility: 0.95 });
  const lm = Array.from({ length: 33 }, () => P2(J.head));
  const set = (i, p) => { lm[i] = P2(p); };
  set(11, J.shoulderL); set(12, J.shoulderR); set(13, J.elbowL); set(14, J.elbowR); set(15, J.wristL); set(16, J.wristR);
  set(23, J.hipL); set(24, J.hipR); set(25, J.kneeL); set(26, J.kneeR); set(27, J.ankleL); set(28, J.ankleR);
  set(29, [J.ankleL[0] - 4, J.ankleL[1] + 4]); set(30, [J.ankleR[0] - 4, J.ankleR[1] + 4]); set(31, J.toeL); set(32, J.toeR);
  return lm;
}
/** World landmarks (metres) of the same pose, rotated `deg` around the vertical axis. */
function toWorld(J, deg) {
  const r = (deg * Math.PI) / 180;
  const W = (p) => { const x = p[0] / 100, y = p[1] / 100; return { x: x * Math.cos(r), y, z: x * Math.sin(r) }; };
  const lm = Array.from({ length: 33 }, () => W(J.head));
  const set = (i, p) => { lm[i] = W(p); };
  set(11, J.shoulderL); set(12, J.shoulderR); set(13, J.elbowL); set(14, J.elbowR); set(15, J.wristL); set(16, J.wristR);
  set(23, J.hipL); set(24, J.hipR); set(25, J.kneeL); set(26, J.kneeR); set(27, J.ankleL); set(28, J.ankleR);
  set(29, [J.ankleL[0] - 4, J.ankleL[1] + 4]); set(30, [J.ankleR[0] - 4, J.ankleR[1] + 4]); set(31, J.toeL); set(32, J.toeR);
  return lm;
}

test('3D world landmarks keep joint angles correct when the user is turned', () => {
  const ex = BY_ID.squat;
  const T = cycleLength(ex.anim);
  const J = solve(sample(ex.anim, T * 0.45).pose, 'side', true);
  const truth = computeMetrics(toLandmarks(J), 1000, 1000, 'side', toWorld(J, 0)).knee;
  // a camera 50° off side-on squashes the 2D image; the 3D angle must not change
  const turned = computeMetrics(toLandmarks(J), 1000, 1000, 'side', toWorld(J, 50)).knee;
  assert.ok(Math.abs(turned - truth) < 0.5, `${turned} vs ${truth}`);
});

test('reps carry depth and tempo, and calibration learns the start position', () => {
  const ex = BY_ID.squat;
  const reps = [];
  let calibrated = null;
  const coach = new FormCoach(ex, { onRep: (r) => reps.push(r), onCalibrated: (c) => { calibrated = c; } });
  coach.armed = false;
  const T = cycleLength(ex.anim);
  const fps = 30;
  // stand still for 1.2 s while not armed → calibration
  const J0 = solve(sample(ex.anim, 0.1).pose, 'side', true);
  for (let f = 0; f < 36; f++) coach.update(toLandmarks(J0), 1000, 1000, (f / fps) * 1000, toWorld(J0, 0));
  assert.ok(calibrated, 'calibrated');
  assert.ok(coach.rest <= ex.track.rest);
  coach.armed = true;
  const start = 1200;
  for (let f = 0; f <= T * 3 * fps; f++) {
    const t = f / fps;
    const J = solve(sample(ex.anim, t).pose, 'side', true);
    coach.update(toLandmarks(J), 1000, 1000, start + t * 1000, toWorld(J, 0));
  }
  assert.ok(reps.length >= 2, `${reps.length} reps`);
  for (const r of reps) {
    assert.ok(r.rom >= 100, `depth ${r.rom}`);
    assert.ok(r.down > 1 && r.up > 0.5, `tempo ${r.down}/${r.up}`);
  }
  const s = coach.summary();
  assert.ok(s.depth >= 100 && s.tempo && s.consistency >= 80);
});

test('One Euro filter removes jitter but follows real movement', () => {
  const f = new OneEuro({ minCutoff: 1.6, beta: 0.9 });
  let maxNoise = 0;
  for (let i = 0; i < 60; i++) {
    const out = f.filter(0.5 + (i % 2 ? 0.01 : -0.01), i * 33);
    if (i >= 15) maxNoise = Math.max(maxNoise, Math.abs(out - 0.5)); // after warm-up
  }
  assert.ok(maxNoise < 0.006, `noise ${maxNoise}`);
  let v = 0;
  for (let i = 60; i < 75; i++) v = f.filter(0.8, i * 33);
  assert.ok(v > 0.78, `lag ${v}`);
});

test('framing check spots cut-off, far-away and badly turned bodies', () => {
  const J = solve(sample(BY_ID.squat.anim, 0).pose, 'side', true);
  const ok = toLandmarks(J, 250, 125, 210); // body fills ~70% of the frame height
  assert.equal(framing(ok, 'side'), null);
  const far = ok.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) * 0.3, y: 0.5 + (p.y - 0.5) * 0.3 }));
  assert.equal(framing(far, 'side'), 'far');
  const cut = ok.map((p) => ({ ...p, y: p.y + 0.6 }));
  assert.equal(framing(cut, 'side'), 'out');
  const front = solve(sample(BY_ID['shoulder-press'].anim, 0).pose, 'front', true);
  assert.equal(framing(toLandmarks(front, 250, 125, 210), 'side'), 'turn-side');
});

function history(now) {
  const st = { profile: { name: 'A', goal: 'muscle' }, workouts: [], meditations: [], checkins: {}, days: {}, weights: [],
    program: { week: Array.from({ length: 7 }, (_, i) => ({ rest: i >= 5, name: 'Full Body A', focus: 'Legs', moves: [{ id: 'squat' }] })) },
    reminders: { enabled: true, morning: '07:30', training: '18:00', evening: '21:00' } };
  for (let i = 1; i <= 12; i++) {
    if (i === 5) continue;
    const k = dayKey(now - i * DAY);
    st.checkins[k] = { sleep: 7, energy: 3, soreness: 2, stress: 4 };
    st.workouts.push({ date: k, at: now - i * DAY, dayName: 'Full Body A', exercises: [{ id: 'back-squat', sets: [{ reps: 8, kg: 60, form: 92 }, { reps: 8, kg: 60, form: 88 }] }] });
  }
  return st;
}

test('streak survives one missed day per week with a freeze', () => {
  const now = new Date(2026, 9, 7, 12).getTime();
  const st = history(now);
  const s = streak(st, now);
  assert.equal(s.current, 11);
  assert.equal(s.frozen.length, 1);
  assert.equal(s.todayDone, false);
  st.checkins[dayKey(now)] = { sleep: 8, energy: 4, soreness: 1, stress: 3 };
  assert.equal(streak(st, now).current, 12);
});

test('quests, XP, levels and badges follow real activity', () => {
  const now = new Date(2026, 9, 7, 12).getTime();
  const st = history(now);
  assert.deepEqual(quests(st, now).map((q) => q.done), [false, false, false]);
  st.checkins[dayKey(now)] = {};
  st.workouts.push({ date: dayKey(now), at: now, dayName: 'Full Body A', exercises: [{ id: 'squat', sets: [{ reps: 10, kg: 0 }] }] });
  st.days[dayKey(now)] = { eaten: { breakfast: true, lunch: true }, water: 4 };
  assert.ok(dayClosed(st, now));
  const lv = level(xp(st));
  assert.ok(lv.n >= 2 && lv.pct >= 0 && lv.pct <= 1);
  const b = Object.fromEntries(badges(st, now).map((x) => [x.id, x.earned]));
  assert.equal(b.first, true);
  assert.equal(b.ten, true);
  assert.equal(b.form90, true);
  assert.equal(b.fifty, false);
});

test('reminders: max 3 a day, skip finished tasks, nothing when disabled', () => {
  const now = new Date(2026, 9, 7, 6, 0).getTime();
  const st = history(now);
  const plan = reminderPlan(st, now);
  assert.ok(plan.length >= 18 && plan.length <= 21);
  const perDay = {};
  for (const r of plan) perDay[dayKey(r.at)] = (perDay[dayKey(r.at)] || 0) + 1;
  assert.ok(Object.values(perDay).every((n) => n <= 3));
  assert.ok(plan.every((r) => r.at > now && r.title && r.body));
  st.checkins[dayKey(now)] = {};
  assert.ok(!reminderPlan(st, now).some((r) => r.kind === 'morning' && dayKey(r.at) === dayKey(now)), 'morning skipped once checked in');
  st.reminders.enabled = false;
  assert.equal(reminderPlan(st, now).length, 0);
});

test('load map counts weekly sets per muscle and recovery', () => {
  const now = new Date(2026, 9, 7, 12).getTime();
  const st = history(now);
  const rows = Object.fromEntries(muscleLoad(st, now).map((r) => [r.id, r]));
  // back squat: quads+glutes primary; 2 sets × 6 sessions in the last 7 days
  assert.equal(rows.quads.sets, 12);
  assert.equal(rows.chest.sets, 0);
  assert.ok(rows.quads.recovery < 100);
  assert.equal(rows.chest.recovery, 100);
  assert.match(loadAdvice(muscleLoad(st, now)), /recovering|Under target|more than enough/);
});
