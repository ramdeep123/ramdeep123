// Today: readiness core, today's session, fuel & mind shortcuts, muscle heat map.

import { state, update } from '../store.js';
import { header, todayInfo, energyToday, trialEyebrow, go, refresh, gate } from '../core.js';
import { readiness, readinessAdvice, estimateMinutes } from '../engine/routine.js';
import { macros } from '../engine/nutrition.js';
import { status, PRICING } from '../engine/subscription.js';
import { BY_ID } from '../engine/exercises.js';
import { solve, drawFigure, LEN } from '../engine/figure.js';
import { Orb } from '../engine/orb.js';
import { esc, fmtNum, DAY, dayKey } from '../engine/util.js';
import { icon, ring, openSheet, toast } from '../ui.js';
import { paintThumbs, thumb } from './exercise.js';
import { planFor } from './fuel.js';

let orb = null;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

export function weeklyHeat(now = Date.now()) {
  const load = {};
  for (const w of state.workouts) {
    if ((w.at || 0) < now - 7 * DAY) continue;
    for (const e of w.exercises) {
      const ex = BY_ID[e.id];
      if (!ex) continue;
      const sets = e.sets.length;
      ex.muscles.primary.forEach((m) => { load[m] = (load[m] || 0) + sets; });
      ex.muscles.secondary.forEach((m) => { load[m] = (load[m] || 0) + sets * 0.5; });
    }
  }
  const h = (...ms) => Math.min(1, Math.max(0, ...ms.map((m) => (load[m] || 0) / 12)));
  return {
    load,
    front: { torso: h('chest', 'abs', 'core'), delts: h('delts'), upperArm: h('biceps'), foreArm: h('forearms'), thigh: h('quads', 'adductors'), shin: h('calves') * 0.6, glutes: 0 },
    back: { torso: h('back', 'lats', 'traps'), delts: h('delts'), upperArm: h('triceps'), foreArm: h('forearms'), thigh: h('hamstrings'), shin: h('calves'), glutes: h('glutes') },
  };
}

function paintHeat(canvas, heat, back) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 150, hgt = canvas.clientHeight || 190;
  canvas.width = w * dpr; canvas.height = hgt * dpr;
  const pose = { torso: 0, armL: { up: 14, lo: 8 }, armR: { up: 14, lo: 8 }, legL: { up: 4, lo: 3 }, legR: { up: 4, lo: 3 } };
  const J = solve(pose, 'front', true);
  const top = J.head[1] - LEN.head - 4;
  const s = (hgt - 12) / (0 - top);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(w / 2, hgt - 6);
  ctx.scale(s, s);
  drawFigure(ctx, J, { view: 'front', heat, noFace: back });
}

function checkinSheet() {
  const key = dayKey();
  const c = { sleep: 7, energy: 3, soreness: 2, stress: 5, ...(state.checkins[key] || {}) };
  const row = (id, label, min, max, step, fmt) => `<div class="field">
      <div class="row between"><label for="ci-${id}">${label}</label><span class="num" style="font-size:22px" id="ci-${id}-v">${fmt(c[id])}</span></div>
      <input type="range" id="ci-${id}" min="${min}" max="${max}" step="${step}" value="${c[id]}" data-input="ciMove" data-key="${id}">
    </div>`;
  const fmts = { sleep: (v) => `${v} h`, energy: (v) => `${v}/5`, soreness: (v) => `${v}/5`, stress: (v) => `${v}/10` };
  openSheet({
    temp: 'today',
    html: `<div class="stack" style="gap:4px"><span class="eyebrow">Morning check-in · 20 seconds</span><h2 class="h2">How's the body today?</h2></div>
      ${row('sleep', 'Sleep last night', 3, 10, 0.5, fmts.sleep)}
      ${row('energy', 'Energy', 1, 5, 1, fmts.energy)}
      ${row('soreness', 'Muscle soreness', 1, 5, 1, fmts.soreness)}
      ${row('stress', 'Stress', 1, 10, 1, fmts.stress)}
      <div class="banner"><span class="num accent" style="font-size:30px" id="ciScore">${readiness(c)}</span><span class="grow" id="ciAdvice">${esc(readinessAdvice(readiness(c)).text)}</span></div>
      <button class="btn block" data-act="ciSave">Save check-in</button>`,
    actions: {
      ciMove(el) {
        c[el.dataset.key] = parseFloat(el.value);
        document.getElementById(`ci-${el.dataset.key}-v`).textContent = fmts[el.dataset.key](c[el.dataset.key]);
        const r = readiness(c);
        document.getElementById('ciScore').textContent = r;
        document.getElementById('ciAdvice').textContent = readinessAdvice(r).text;
      },
      ciSave() {
        update((s) => { s.checkins[key] = { ...c }; });
        this.close();
        toast('Check-in saved');
        refresh();
      },
    },
  });
}

export function html() {
  const p = state.profile;
  const t = todayInfo();
  const adv = readinessAdvice(t.readiness);
  const e = energyToday();
  const m = macros(e.kcal, e.profile);
  const d = state.days[t.key] || { eaten: {}, water: 0 };
  const sub = status(state.sub);
  const goal = state.goals.find((g) => g.type === 'weight');
  const w = e.profile.weight;
  const c = t.checkin;

  let session;
  if (t.done) {
    const vol = t.done.exercises.reduce((a, ex) => a + ex.sets.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
    session = `<section class="card session-card">
      <div class="card-head"><span class="eyebrow">Today · ${esc(t.done.dayName)}</span><span class="tag good">${icon('check')} Done</span></div>
      <h2 class="h2">Session complete</h2>
      <p class="muted">${Math.round(t.done.durationSec / 60)} min${vol ? ` · ${fmtNum(vol)} kg moved` : ''}. Refuel with protein and try a down-shift breath.</p>
      <button class="btn ghost block" data-act="go" data-tab="mind">Post-workout down-shift</button>
    </section>`;
  } else if (t.training) {
    session = `<section class="card session-card">
      <div class="card-head"><span class="eyebrow">Today · ${esc(t.day.name)}</span><span class="tag hot">~${estimateMinutes(t.day)} min</span></div>
      <h2 class="h2">${esc(t.day.focus)}</h2>
      <div class="thumbs">${t.day.moves.slice(0, 5).map((mv) => thumb(mv.id)).join('')}</div>
      <p class="muted small">${t.day.moves.map((mv) => esc(BY_ID[mv.id].name)).join(' · ')}</p>
      <button class="btn block" data-act="startSession">${icon('play')} Start session</button>
    </section>`;
  } else {
    session = `<section class="card session-card">
      <span class="eyebrow">Today · Recovery</span>
      <h2 class="h2">Rest is training too</h2>
      <p class="muted">Walk 6–8k steps, stretch for ten minutes, and give your nervous system a reset.</p>
      <div class="grid2"><button class="btn ghost" data-act="go" data-tab="mind">Breathe</button><button class="btn ghost" data-act="go" data-tab="train">See week</button></div>
    </section>`;
  }

  const trialBanner = sub.state === 'trial'
    ? `<button class="banner" data-act="pass" style="border:0;text-align:left;width:100%">${icon('bolt')}<span class="grow"><b>Free trial · ${sub.daysLeft} day${sub.daysLeft === 1 ? '' : 's'} left.</b> Then ${PRICING.symbol}${PRICING.intro.amount} for 3 months.</span>${icon('chev', 'chev')}</button>`
    : sub.state === 'expired'
      ? `<button class="banner" data-act="pass" style="border:0;text-align:left;width:100%">${icon('lock')}<span class="grow"><b>Your trial has ended.</b> Continue for ${PRICING.symbol}${sub.price} for 3 months.</span>${icon('chev', 'chev')}</button>`
      : '';

  let goalCard = '';
  if (goal) {
    const total = goal.target - goal.start;
    const done = w - goal.start;
    const pct = total ? Math.max(0, Math.min(1, done / total)) : 0;
    goalCard = `<section class="card" data-act="go" data-tab="you" style="cursor:pointer">
      <div class="card-head"><span class="eyebrow">Goal · ${goal.target} kg</span><span class="mono small faint">${Math.round(pct * 100)}%</span></div>
      <div class="meter"><i style="width:${pct * 100}%"></i></div>
      <span class="muted small">${w.toFixed(1)} kg now · ${Math.abs(goal.target - w).toFixed(1)} kg to go</span>
    </section>`;
  }

  return `${header(trialEyebrow(), `${greeting()},<br>${esc(p.name)}`)}
    ${state.sample ? `<div class="banner">${icon('info')}<span class="grow">You're exploring a <b>sample profile</b> with example data.</span><button class="link" data-act="leaveSample">Use mine</button></div>` : ''}
    <section class="core-wrap" aria-label="Readiness">
      <canvas id="core" aria-hidden="true"></canvas>
      <div class="core-read">
        ${t.readiness == null
          ? '<span class="eyebrow">Readiness</span><button class="btn small" data-act="checkin" style="margin-top:10px">Check in</button>'
          : `<span class="num">${t.readiness}</span><span class="eyebrow">Readiness</span>`}
      </div>
    </section>
    <p class="muted" style="text-align:center;margin-top:-6px">${esc(adv.text)}</p>
    ${c ? `<button class="facts" data-act="checkin" style="border:0;background:none;padding:0" aria-label="Edit check-in">
      <span class="fact"><span class="num">${c.sleep}h</span><span class="eyebrow">Sleep</span></span>
      <span class="fact"><span class="num">${c.energy}/5</span><span class="eyebrow">Energy</span></span>
      <span class="fact"><span class="num">${c.soreness}/5</span><span class="eyebrow">Sore</span></span>
      <span class="fact"><span class="num">${c.stress}/10</span><span class="eyebrow">Stress</span></span>
    </button>` : ''}
    ${trialBanner}
    ${session}
    <div class="grid2">
      <section class="card" data-act="go" data-tab="fuel" style="cursor:pointer;align-items:center;text-align:center" data-temp="fuel">
        <span class="eyebrow">Fuel</span>
        ${ring((eatenKcal(t.key) || 0) / e.kcal, { size: 92, stroke: 8, inner: `<span class="num" style="font-size:24px">${fmtNum(eatenKcal(t.key))}</span><span class="faint" style="font-size:10px">of ${fmtNum(e.kcal)}</span>` })}
        <span class="muted small">${m.protein} g protein target</span>
      </section>
      <section class="card" data-temp="mind" style="justify-content:space-between">
        <span class="eyebrow">Mind</span>
        <h3 class="h3">Drop stress in 3 minutes</h3>
        <button class="btn small" data-act="quickBreath">${icon('play')} Sigh</button>
      </section>
    </div>
    <section class="card">
      <div class="card-head"><span class="eyebrow">This week's heat</span><span class="faint small mono">7 days</span></div>
      <div class="heat">
        <figure><canvas id="heatF" aria-label="Front muscles trained this week"></canvas><span class="eyebrow">Front</span></figure>
        <figure><canvas id="heatB" aria-label="Back muscles trained this week"></canvas><span class="eyebrow">Back</span></figure>
      </div>
      <div class="stack" style="gap:4px"><div class="heat-scale"></div><div class="row between faint small"><span>Untrained</span><span>12+ sets</span></div></div>
    </section>
    ${goalCard}`;
}

function eatenKcal(key) {
  const d = state.days[key];
  if (!d) return 0;
  return planFor(key).meals.filter((m) => d.eaten?.[m.slot]).reduce((a, m) => a + m.kcal, 0);
}

export async function mount(el) {
  const t = todayInfo();
  orb = new Orb(el.querySelector('#core'), { value: t.readiness ?? 50 }).start();
  paintThumbs(el);
  const heat = weeklyHeat();
  paintHeat(el.querySelector('#heatF'), heat.front, false);
  paintHeat(el.querySelector('#heatB'), heat.back, true);
}

export const actions = {
  checkin: checkinSheet,
  quickBreath() {
    import('./mind.js').then((m) => m.openBreath('sigh'));
  },
  startSession() {
    const t = todayInfo();
    gate('plan', () => import('./train.js').then((m) => m.startWorkout(t.wd)));
  },
  pass() { import('./pass.js').then((m) => m.openPass()); },
  leaveSample() {
    import('../store.js').then((s) => { s.reset(); location.reload(); });
  },
};
