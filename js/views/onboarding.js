// First-run flow: welcome → body → goal → training → lifestyle → plan + trial.

import { esc, fmtNum, fmtDate } from '../engine/util.js';
import { bmr, energy, macros, GOALS, ACTIVITY } from '../engine/nutrition.js';
import { buildProgram } from '../engine/routine.js';
import { DIETS } from '../engine/foods.js';
import { PRICING, trialEnds, newSub } from '../engine/subscription.js';
import { Orb } from '../engine/orb.js';
import { icon, stepper, nudge, pressed, setViewActions } from '../ui.js';
import { createProfile, seedSample } from '../store.js';

const draft = {
  name: '', sex: 'male', age: 25, height: 170, weight: 70, goal: 'lose', level: 'beginner',
  days: 3, place: 'gym', minutes: 45, diet: 'veg', activity: 'desk', injuries: [],
};
let step = 0;
let root = null;
let onDone = () => {};

const STEPS = ['welcome', 'name', 'body', 'goal', 'training', 'life', 'plan'];

const opt = (field, value, label, sub = '') =>
  `<button type="button" class="tile" data-act="pick" data-field="${field}" data-value="${value}" aria-pressed="${String(draft[field]) === String(value)}"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</button>`;
const chip = (field, value, label) =>
  `<button type="button" class="chip" data-act="pick" data-field="${field}" data-value="${value}" aria-pressed="${String(draft[field]) === String(value)}">${label}</button>`;
const seg = (field, items) =>
  `<div class="seg">${items.map(([v, l]) => `<button type="button" data-act="pick" data-field="${field}" data-value="${v}" aria-pressed="${String(draft[field]) === String(v)}">${l}</button>`).join('')}</div>`;

function bmrPanel() {
  const b = bmr(draft);
  return `<div class="card raised">
    <span class="eyebrow">Your BMR · ${b.formula}</span>
    <div class="bmr-live"><span class="num" id="bmrNum">${fmtNum(b.value)}</span><span class="muted">kcal a day, just to keep you alive at rest</span></div>
    <span class="faint small mono" id="bmrExplain">${esc(b.explain)}</span>
  </div>`;
}

function render() {
  const s = STEPS[step];
  if (s === 'welcome') {
    root.innerHTML = `<section class="welcome" data-temp="today">
      <div class="stack" style="gap:14px">
        <span class="eyebrow">Gym · Home · Mind</span>
        <h1 class="wordmark">KAYA</h1>
        <p class="muted" style="max-width:34ch;font-size:16px">A trainer that watches your form through the camera, a diet that follows your BMR, and a calm coach for your cortisol. In one app.</p>
      </div>
      <canvas id="obOrb" aria-hidden="true"></canvas>
      <div class="ob-foot">
        <button class="btn block" data-act="next">Start 7-day free trial ${icon('chev')}</button>
        <button class="btn ghost block" data-act="sample">Explore with a sample profile</button>
        <p class="faint small" style="text-align:center">Free for 7 days. Then ${PRICING.symbol}${PRICING.intro.amount} for your first 3 months, ${PRICING.symbol}${PRICING.regular.amount} every 3 months after. Cancel anytime.</p>
      </div>
    </section>`;
    new Orb(root.querySelector('#obOrb'), { value: 82 }).start();
    return;
  }

  let body = '';
  let canNext = true;
  if (s === 'name') {
    body = `<h2 class="ob-q">What should your coach call you?</h2>
      <div class="field"><label for="obName">First name</label>
      <input id="obName" class="input" autocomplete="given-name" maxlength="24" value="${esc(draft.name)}" data-input="name" placeholder="e.g. Priya"></div>`;
    canNext = draft.name.trim().length > 0;
  } else if (s === 'body') {
    body = `<h2 class="ob-q">Your body, by the numbers</h2>
      ${seg('sex', [['male', 'Male'], ['female', 'Female']])}
      <div class="grid2">
        <div class="field"><label for="obAge">Age</label>${stepper('obAge', draft.age, { unit: 'years', min: 14, max: 90 })}</div>
        <div class="field"><label for="obH">Height</label>${stepper('obH', draft.height, { unit: 'cm', min: 120, max: 230 })}</div>
      </div>
      <div class="field"><label for="obW">Weight</label>${stepper('obW', draft.weight, { unit: 'kg', step: 0.5, min: 30, max: 250 })}</div>
      ${bmrPanel()}`;
  } else if (s === 'goal') {
    body = `<h2 class="ob-q">What are we building?</h2>
      <div class="tiles">
        ${opt('goal', 'lose', 'Lose fat', 'Lean out while keeping muscle')}
        ${opt('goal', 'muscle', 'Build muscle', 'Add size with a lean surplus')}
        ${opt('goal', 'strength', 'Get stronger', 'Heavier squats, deadlifts, presses')}
        ${opt('goal', 'fit', 'Fit & calm', 'Move well, sleep well, stress less')}
      </div>`;
  } else if (s === 'training') {
    body = `<h2 class="ob-q">How you train</h2>
      <div class="field"><label>Experience</label>${seg('level', [['beginner', 'New'], ['intermediate', '1–3 yrs'], ['advanced', '3+ yrs']])}</div>
      <div class="field"><label>Days per week</label><div class="chips">${[2, 3, 4, 5, 6].map((d) => chip('days', d, `${d} days`)).join('')}</div></div>
      <div class="field"><label>Where</label><div class="tiles one">
        ${opt('place', 'gym', 'Gym', 'Barbells, dumbbells, pull-up bar')}
        ${opt('place', 'home-db', 'Home + dumbbells', 'A pair of dumbbells and a chair')}
        ${opt('place', 'home', 'Home, no equipment', 'Just you and the floor')}
      </div></div>
      <div class="field"><label>Session length</label>${seg('minutes', [[30, '30 min'], [45, '45 min'], [60, '60 min']])}</div>`;
  } else if (s === 'life') {
    body = `<h2 class="ob-q">Your day & your plate</h2>
      <div class="field"><label>Outside the gym you are…</label><div class="tiles one">
        ${ACTIVITY.map((a) => opt('activity', a.id, a.label, a.hint)).join('')}
      </div></div>
      <div class="field"><label>Food preference</label><div class="chips">${DIETS.map((d) => chip('diet', d.id, d.label)).join('')}</div></div>
      <div class="field"><label>Anything that hurts? (optional)</label><div class="chips">
        ${[['knees', 'Knees'], ['back', 'Lower back'], ['shoulders', 'Shoulders']].map(([v, l]) => `<button type="button" class="chip" data-act="injury" data-value="${v}" aria-pressed="${draft.injuries.includes(v)}">${l}</button>`).join('')}
      </div><span class="faint small">We'll swap out moves that load these areas.</span></div>`;
  } else if (s === 'plan') {
    const e = energy(draft);
    const m = macros(e.target, draft);
    const prog = buildProgram(draft);
    const end = trialEnds(newSub(Date.now()));
    const goal = GOALS.find((g) => g.id === draft.goal);
    body = `<h2 class="ob-q">${esc(draft.name || 'Your')}'s plan is ready</h2>
      <div class="card">
        <div class="grid2">
          <div class="stack" style="gap:2px"><span class="eyebrow">BMR</span><span class="num" style="font-size:34px">${fmtNum(e.bmr)}</span><span class="faint small">kcal at rest</span></div>
          <div class="stack" style="gap:2px"><span class="eyebrow">Daily target</span><span class="num accent" style="font-size:34px">${fmtNum(e.target)}</span><span class="faint small">${goal.short}${e.floorActive ? ' · BMR floor' : ''}</span></div>
          <div class="stack" style="gap:2px"><span class="eyebrow">Protein</span><span class="num" style="font-size:34px">${m.protein} g</span><span class="faint small">a day</span></div>
          <div class="stack" style="gap:2px"><span class="eyebrow">Program</span><span class="num" style="font-size:24px;line-height:1.1">${esc(prog.splitName)}</span><span class="faint small">${draft.days} days · ${draft.minutes} min</span></div>
        </div>
      </div>
      <div class="card">
        <span class="eyebrow">Your free week</span>
        <div class="plan-steps">
          <div class="plan-step"><span class="when">Today</span><span>Everything unlocked: AI form coach, program, diet and Mind lab.</span></div>
          <div class="plan-step"><span class="when">${fmtDate(end)}</span><span>Trial ends. Continue for ${PRICING.symbol}${PRICING.intro.amount} for 3 months, or stop and pay nothing.</span></div>
          <div class="plan-step"><span class="when">After 3 mo</span><span>${PRICING.symbol}${PRICING.regular.amount} every 3 months. Cancel anytime.</span></div>
        </div>
      </div>`;
  }

  const last = step === STEPS.length - 1;
  root.innerHTML = `<section class="ob" data-temp="today">
    <div class="ob-top">
      <button class="icon-btn" data-act="prev" aria-label="Back">${icon('back')}</button>
      <div class="ob-dots">${STEPS.slice(1).map((_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div class="ob-body">${body}</div>
    <div class="ob-foot">
      <button class="btn block" data-act="${last ? 'finish' : 'next'}" id="obNext" ${canNext ? '' : 'disabled'}>${last ? 'Start my free week' : 'Continue'}</button>
    </div>
  </section>`;
  if (s === 'name') {
    const i = root.querySelector('#obName');
    setTimeout(() => i.focus(), 50);
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && draft.name.trim()) actions.next(); });
  }
}

function updateBmr() {
  const n = root.querySelector('#bmrNum');
  if (!n) return;
  const b = bmr(draft);
  n.textContent = fmtNum(b.value);
  root.querySelector('#bmrExplain').textContent = b.explain;
}

const FIELD_OF = { obAge: 'age', obH: 'height', obW: 'weight' };

const actions = {
  next() { step = Math.min(STEPS.length - 1, step + 1); render(); window.scrollTo(0, 0); },
  prev() { step = Math.max(0, step - 1); render(); },
  pick(el) {
    const f = el.dataset.field;
    let v = el.dataset.value;
    if (['days', 'minutes'].includes(f)) v = Number(v);
    draft[f] = v;
    pressed(el.parentElement, el);
    if (f === 'sex') updateBmr();
  },
  injury(el) {
    const v = el.dataset.value;
    draft.injuries = draft.injuries.includes(v) ? draft.injuries.filter((x) => x !== v) : [...draft.injuries, v];
    el.setAttribute('aria-pressed', String(draft.injuries.includes(v)));
  },
  name(el) {
    draft.name = el.value;
    root.querySelector('#obNext').disabled = !draft.name.trim();
  },
  step(el) { nudge(el); },
  'step-in'(el) {
    const f = FIELD_OF[el.id];
    const v = parseFloat(el.value);
    if (f && !Number.isNaN(v)) { draft[f] = v; updateBmr(); }
  },
  sample() { seedSample(); onDone(); },
  finish() {
    createProfile({ ...draft, name: draft.name.trim() });
    onDone();
  },
};

export function showOnboarding(el, done) {
  root = el;
  onDone = done;
  step = 0;
  setViewActions(actions);
  render();
}

export function onboardingBack() {
  if (step > 0) { actions.prev(); return true; }
  return false;
}
