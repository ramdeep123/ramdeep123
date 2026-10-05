import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bmr, energy, macros, regulate, mealPlan } from '../js/engine/nutrition.js';
import { newSub, status, applyPayment, nextPrice, trialEnds } from '../js/engine/subscription.js';
import { buildProgram, readiness, suggestLoad } from '../js/engine/routine.js';
import { EXERCISES, BY_ID } from '../js/engine/exercises.js';
import { solve, sample, cycleLength, ik2, LEN } from '../js/engine/figure.js';
import { FormCoach, computeMetrics } from '../js/engine/formcheck.js';
import { DAY, dayKey, addMonths } from '../js/engine/util.js';
import { dietAllows } from '../js/engine/foods.js';

const MAN = { sex: 'male', age: 27, height: 175, weight: 78, goal: 'lose', level: 'beginner', days: 4, place: 'gym', minutes: 45, diet: 'veg', activity: 'desk', injuries: [] };

test('BMR uses Mifflin-St Jeor', () => {
  assert.equal(bmr(MAN).value, 1744);
  assert.equal(bmr({ ...MAN, sex: 'female' }).value, 1578);
  assert.equal(bmr({ ...MAN, bodyFat: 20 }).formula, 'Katch-McArdle');
});

test('calorie target never drops below BMR', () => {
  for (const goal of ['lose', 'muscle', 'strength', 'fit']) {
    for (const adjust of [-500, 0, 400]) {
      const e = energy({ ...MAN, goal }, adjust);
      assert.ok(e.target >= e.bmr, `${goal} ${adjust}`);
      assert.ok(e.restDay >= e.bmr && e.trainDay >= e.bmr);
    }
  }
  const e = energy(MAN, -60);
  assert.equal(e.floorActive, true);
  assert.equal(e.target, e.bmr);
});

test('macros add up to roughly the calorie target', () => {
  const kcal = 2200;
  const m = macros(kcal, { ...MAN, goal: 'muscle' });
  const total = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  assert.ok(Math.abs(total - kcal) < 40, `total ${total}`);
  assert.equal(m.protein, Math.round(78 * 1.8));
});

test('meal plans respect diet preference and are deterministic', () => {
  for (const diet of ['vegan', 'veg', 'egg', 'nonveg']) {
    const plan = mealPlan({ ...MAN, diet }, '2026-10-05', 2000);
    assert.equal(plan.meals.length, 4);
    for (const m of plan.meals) assert.ok(dietAllows(diet, m.dish.diet), `${diet} got ${m.dish.id}`);
    assert.deepEqual(plan, mealPlan({ ...MAN, diet }, '2026-10-05', 2000));
    assert.ok(Math.abs(plan.totals.kcal - 2000) < 350);
  }
  const a = mealPlan(MAN, '2026-10-05', 2000).meals[0].dish.id;
  const b = mealPlan(MAN, '2026-10-05', 2000, { breakfast: 1 }).meals[0].dish.id;
  assert.notEqual(a, b, 'swap changes the dish');
});

test('metabolic regulator trims calories when fat loss stalls', () => {
  const now = Date.UTC(2026, 9, 20);
  const weights = Array.from({ length: 8 }, (_, i) => ({ date: dayKey(now - (14 - i * 2) * DAY), kg: 78 }));
  const r = regulate(weights, MAN, { adjust: 0 }, now);
  assert.equal(r.ready, true);
  assert.ok(r.step < 0 && r.step >= -150, `step ${r.step}`);
  const fast = weights.map((w, i) => ({ ...w, kg: 78 - i * 0.35 }));
  assert.ok(regulate(fast, MAN, { adjust: 0 }, now).step > 0, 'losing too fast raises calories');
  assert.equal(regulate(weights.slice(0, 2), MAN, {}, now).ready, false);
  const notDue = regulate(weights, MAN, { adjust: -100, lastAdjustAt: now - 2 * DAY }, now);
  assert.equal(notDue.adjust, -100);
});

test('subscription: 7-day trial, ₹29 intro, then ₹49', () => {
  const t0 = Date.UTC(2026, 9, 1);
  let sub = newSub(t0);
  assert.equal(status(sub, t0).state, 'trial');
  assert.equal(status(sub, t0).daysLeft, 7);
  assert.equal(status(sub, t0 + 7 * DAY + 1).state, 'expired');
  assert.equal(nextPrice(sub), 29);

  sub = applyPayment(sub, 'pay_1', t0 + 2 * DAY);
  assert.equal(sub.payments[0].amount, 29);
  assert.equal(sub.paidUntil, addMonths(trialEnds(sub), 3), 'paid period starts after the trial');
  assert.equal(status(sub, t0 + 30 * DAY).state, 'active');
  assert.equal(nextPrice(sub), 49);

  sub = applyPayment(sub, 'pay_2', sub.paidUntil - DAY);
  assert.equal(sub.payments[1].amount, 49);
  assert.equal(status(sub, addMonths(t0, 6)).pro, true);
  assert.equal(status(sub, addMonths(t0, 7)).state, 'expired');
});

test('program matches days, place and injuries', () => {
  for (const days of [2, 3, 4, 5, 6]) {
    for (const place of ['gym', 'home-db', 'home']) {
      const prog = buildProgram({ ...MAN, days, place, injuries: ['knees'] });
      const training = prog.week.filter((d) => !d.rest);
      assert.equal(training.length, days);
      for (const d of training) {
        const ids = d.moves.map((m) => m.id);
        assert.equal(new Set(ids).size, ids.length, 'no duplicate moves in a day');
        assert.ok(ids.length >= 3);
        for (const id of ids) {
          assert.ok(BY_ID[id].places.includes(place), `${id} not for ${place}`);
          assert.ok(!['lunge', 'jumping-jack', 'high-knees'].includes(id), `${id} loads knees`);
        }
      }
    }
  }
});

test('readiness and load suggestions', () => {
  assert.equal(readiness({ sleep: 8, energy: 5, soreness: 1, stress: 1 }), 100);
  assert.ok(readiness({ sleep: 4, energy: 1, soreness: 5, stress: 10 }) < 5);
  const first = suggestLoad('bench-press', MAN, {});
  assert.ok(first.kg >= 20 && first.kg % 2.5 === 0);
  assert.equal(suggestLoad('bench-press', MAN, { 'bench-press': { kg: 40, hitTop: true, form: 90 } }).kg, 42.5);
  assert.equal(suggestLoad('back-squat', MAN, { 'back-squat': { kg: 60, hitTop: true, form: 60 } }).kg, 60, 'poor form holds the weight');
  assert.equal(suggestLoad('pushup', MAN, {}), null);
});

test('IK keeps bone lengths', () => {
  const [b, e] = ik2([0, 0], [30, 40], LEN.thigh, LEN.shin, [1, 0]);
  assert.ok(Math.abs(Math.hypot(b[0], b[1]) - LEN.thigh) < 1e-6);
  assert.ok(Math.abs(Math.hypot(e[0] - b[0], e[1] - b[1]) - LEN.shin) < 1e-6);
  assert.ok(b[0] > 0, 'bends toward hint');
});

test('every animation solves to finite joints', () => {
  for (const ex of EXERCISES) {
    const T = cycleLength(ex.anim);
    assert.ok(T > 0, ex.id);
    for (let i = 0; i < 12; i++) {
      const J = solve(sample(ex.anim, (T * i) / 12).pose, ex.anim.view, ex.anim.ground !== false);
      for (const [k, v] of Object.entries(J)) assert.ok(v.every(Number.isFinite), `${ex.id} ${k}`);
    }
  }
});

// Build MediaPipe-style landmarks from the animated mannequin so the form
// coach can be tested end-to-end without a camera.
function landmarksFrom(J, mutate) {
  const P = (p, v = 0.95) => ({ x: (p[0] + 400) / 1000, y: (p[1] + 600) / 1000, z: 0, visibility: v });
  const lm = Array.from({ length: 33 }, () => P(J.head));
  lm[0] = P(J.head);
  lm[11] = P(J.shoulderL); lm[12] = P(J.shoulderR);
  lm[13] = P(J.elbowL); lm[14] = P(J.elbowR);
  lm[15] = P(J.wristL); lm[16] = P(J.wristR);
  lm[23] = P(J.hipL); lm[24] = P(J.hipR);
  lm[25] = P(J.kneeL); lm[26] = P(J.kneeR);
  lm[27] = P(J.ankleL); lm[28] = P(J.ankleR);
  lm[29] = P([J.ankleL[0] - 4, J.ankleL[1] + 4]); lm[30] = P([J.ankleR[0] - 4, J.ankleR[1] + 4]);
  lm[31] = P(J.toeL); lm[32] = P(J.toeR);
  mutate?.(lm);
  return lm;
}

function runCoach(id, { cycles = 3, fps = 30, mutate, poseTweak } = {}) {
  const ex = BY_ID[id];
  const cues = [];
  const coach = new FormCoach(ex, { onCue: (c) => cues.push(c) });
  const T = cycleLength(ex.anim);
  const frames = Math.round(T * cycles * fps);
  for (let f = 0; f <= frames; f++) {
    const t = f / fps;
    let pose = sample(ex.anim, t).pose;
    if (poseTweak) pose = poseTweak(pose, t);
    const J = solve(pose, ex.anim.view, ex.anim.ground !== false);
    coach.update(landmarksFrom(J, mutate), 1000, 1000, t * 1000);
  }
  return { coach, cues, summary: coach.summary() };
}

test('form coach counts the animated reps', () => {
  for (const id of ['squat', 'pushup', 'bicep-curl', 'shoulder-press', 'lateral-raise', 'rdl', 'glute-bridge', 'bent-row', 'dips']) {
    const { summary } = runCoach(id, { cycles: 4 });
    assert.ok(summary.reps >= 3 && summary.reps <= 4, `${id}: ${summary.reps} reps`);
    assert.equal(summary.partials, 0, `${id} partials`);
  }
});

test('half squats are not counted and get a cue', () => {
  const { summary, cues } = runCoach('squat', {
    cycles: 3,
    poseTweak: (p) => ({ ...p, pelvis: [p.pelvis[0] * 0.5, -87.5 + (p.pelvis[1] + 87.5) * 0.3] }),
  });
  assert.equal(summary.reps, 0);
  assert.ok(summary.partials >= 2);
  assert.ok(cues.some((c) => /deeper/i.test(c.msg)));
});

test('sagging hips in a push-up are flagged', () => {
  const { cues } = runCoach('pushup', {
    cycles: 2,
    mutate: (lm) => { lm[23].y += 0.03; lm[24].y += 0.03; },
  });
  assert.ok(cues.some((c) => c.id === 'sag'), JSON.stringify(cues));
});

test('hidden body parts pause tracking instead of guessing', () => {
  const ex = BY_ID.squat;
  const coach = new FormCoach(ex);
  const J = solve(sample(ex.anim, 0).pose, 'side', true);
  const r = coach.update(landmarksFrom(J, (lm) => { lm[27].visibility = 0.1; lm[28].visibility = 0.1; }), 1000, 1000, 0);
  assert.equal(r.visible, false);
});

test('metrics read a straight standing body', () => {
  const J = solve(sample(BY_ID.squat.anim, 0).pose, 'side', true);
  const m = computeMetrics(landmarksFrom(J), 1000, 1000, 'side');
  assert.ok(m.knee > 160, `knee ${m.knee}`);
  assert.ok(m.torsoLean < 10, `lean ${m.torsoLean}`);
});
