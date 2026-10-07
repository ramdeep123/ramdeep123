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
import { streak, quests, xp, level } from '../engine/engage.js';
import { canRemind } from '../native.js';
import { muscleLoad, loadAdvice } from '../engine/load.js';
import { WEEKDAYS, startOfWeek } from '../engine/util.js';
import { dayLog } from '../engine/engage.js';

let orb = null;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
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
  const rows = muscleLoad(state);

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
    ${engageCard()}
    ${canRemind() && !state.reminders?.enabled && !state.reminders?.dismissed ? `<div class="banner">${icon('bolt')}<span class="grow"><b>Turn on daily reminders</b> so your streak never slips.</span><button class="link" data-act="remindOn">Turn on</button><button class="link faint" data-act="remindLater" aria-label="Not now">${icon('close')}</button></div>` : ''}
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
      <div class="card-head"><span class="eyebrow">Training load map</span><span class="faint small mono">last 7 days</span></div>
      <div class="heat">
        <figure><canvas id="heatF" aria-label="Front muscles trained this week"></canvas><span class="eyebrow">Front</span></figure>
        <figure><canvas id="heatB" aria-label="Back muscles trained this week"></canvas><span class="eyebrow">Back</span></figure>
      </div>
      <div class="stack" style="gap:4px"><div class="heat-scale"></div><div class="row between faint small"><span>Untrained</span><span>At weekly target</span></div></div>
      <p class="muted small">${esc(loadAdvice(rows))}</p>
      <div class="loads">${rows.map((r) => `<div class="load-row">
        <span class="lname">${esc(r.label)}</span>
        <span class="lbar"><i style="width:${Math.min(100, Math.round((r.sets / r.target) * 100))}%" class="${r.status}"></i><b style="left:${Math.min(100, (r.target / (r.target * 1.6)) * 100)}%"></b></span>
        <span class="lnum tabnum">${r.sets}/${r.target}</span>
        <span class="lrec ${r.recovery < 50 ? 'sore' : r.recovery < 100 ? 'mid' : ''}" title="Recovery">${r.recovery}%</span>
      </div>`).join('')}</div>
      <span class="faint small">Sets per muscle this week vs your target, and recovery since you last trained it. The colours show training effort — the phone can’t measure body temperature.</span>
    </section>
    ${goalCard}`;
}

function engageCard() {
  const s = streak(state);
  const lv = level(xp(state));
  const qs = quests(state);
  const doneN = qs.filter((q) => q.done).length;
  const log = dayLog(state);
  const ws = startOfWeek();
  const week = WEEKDAYS.map((d, i) => {
    const k = dayKey(ws + i * DAY);
    const l = log[k];
    const on = !!l && (l.workout || l.coachSets > 0 || l.mind > 0 || l.checkin || l.meals > 0);
    return `<span class="sd ${on ? 'on' : ''} ${k === dayKey() ? 'today' : ''} ${s.frozen.includes(k) ? 'frozen' : ''}" title="${d}">${d[0]}</span>`;
  }).join('');
  return `<section class="card engage">
    <div class="row between">
      <div class="streak">
        <span class="flame ${s.todayDone ? 'lit' : ''}">${icon('fuel')}</span>
        <span class="stack" style="gap:0"><span class="num" style="font-size:34px;line-height:.9">${s.current}</span><span class="eyebrow">day streak</span></span>
      </div>
      <button class="lvl" data-act="go" data-tab="you" aria-label="Level ${lv.n} ${lv.name}">
        <span class="eyebrow">Lv ${lv.n} · ${esc(lv.name)}</span>
        <span class="meter" style="width:120px"><i style="width:${Math.round(lv.pct * 100)}%"></i></span>
        <span class="faint small mono">${lv.xp}${lv.next ? ` / ${lv.next} XP` : ' XP'}</span>
      </button>
    </div>
    <div class="streak-week">${week}</div>
    <div class="card-head"><span class="eyebrow">Today's heat · ${doneN}/3</span>${doneN === 3 ? '<span class="tag good">Day closed</span>' : `<span class="faint small">${s.freezeReady ? 'Streak freeze ready' : 'Freeze used this week'}</span>`}</div>
    <div class="quests">${qs.map((q) => `<button class="quest ${q.done ? 'done' : ''}" data-act="${q.done ? 'noop' : q.act}">
      <span class="qcheck">${q.done ? icon('check') : ''}</span>
      <span class="grow"><b>${esc(q.title)}</b><span>${esc(q.sub)}</span></span>
      ${q.done ? '' : icon('chev', 'chev')}
    </button>`).join('')}</div>
  </section>`;
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
  const H = Object.fromEntries(muscleLoad(state).map((r) => [r.id, r.heat]));
  paintHeat(el.querySelector('#heatF'), { torso: Math.max(H.chest, H.core), delts: H.delts, upperArm: H.biceps, foreArm: H.biceps * 0.5, thigh: H.quads, shin: H.calves * 0.6, glutes: 0 }, false);
  paintHeat(el.querySelector('#heatB'), { torso: H.back, delts: H.delts, upperArm: H.triceps, foreArm: H.back * 0.3, thigh: H.hamstrings, shin: H.calves, glutes: H.glutes }, true);
}

export const actions = {
  checkin: checkinSheet,
  noop() {},
  goFuel() { go('fuel'); },
  async remindOn() {
    const { enableReminders } = await import('./you.js');
    enableReminders();
  },
  remindLater() {
    update((s) => { s.reminders = { ...(s.reminders || {}), dismissed: true }; });
    refresh();
  },
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
