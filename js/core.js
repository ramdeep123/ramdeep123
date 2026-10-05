// Shared view helpers: navigation hooks, gating, derived "today" info.

import { state } from './store.js';
import { status } from './engine/subscription.js';
import { energy } from './engine/nutrition.js';
import { readiness } from './engine/routine.js';
import { dayKey, weekday, esc, fmtDay } from './engine/util.js';
import { icon } from './ui.js';

export const hooks = { go: () => {}, refresh: () => {}, openPass: () => {} };
export const go = (tab) => hooks.go(tab);
export const refresh = () => hooks.refresh();

export const isPro = () => status(state.sub).pro;

/** Run fn if the pass (or trial) is active, otherwise show the pass screen. */
export function gate(reason, fn) {
  if (isPro()) return fn();
  hooks.openPass(reason);
}

export function profileNow() {
  const p = state.profile;
  const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return w.length ? { ...p, weight: w[w.length - 1].kg } : p;
}

export function todayInfo(ts = Date.now()) {
  const key = dayKey(ts);
  const wd = weekday(ts);
  const day = state.program?.week?.[wd];
  const done = state.workouts.find((w) => w.date === key && w.dayName !== 'Coach session');
  const checkin = state.checkins[key];
  return { key, wd, day, training: !!day && !day.rest, done, checkin, readiness: readiness(checkin) };
}

export function energyToday(trainingOverride) {
  const p = profileNow();
  const e = energy(p, state.nutrition?.adjust || 0);
  const t = todayInfo();
  const training = trainingOverride ?? t.training;
  return { ...e, training, kcal: training ? e.trainDay : e.restDay, profile: p };
}

export function header(eyebrow, title, { back = false } = {}) {
  const p = state.profile;
  const initial = esc((p?.name || 'K').trim().charAt(0).toUpperCase());
  return `<header class="vh">
    <div class="vh-l">
      <span class="eyebrow">${eyebrow}</span>
      <h1 class="display">${title}</h1>
    </div>
    ${back ? `<button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button>`
      : `<button class="avatar" data-act="go" data-tab="you" aria-label="Your progress and settings">${initial}</button>`}
  </header>`;
}

export function trialEyebrow() {
  const s = status(state.sub);
  const d = fmtDay(Date.now()).toUpperCase();
  if (s.state === 'trial') return `${d} · TRIAL ${s.daysLeft} DAY${s.daysLeft === 1 ? '' : 'S'} LEFT`;
  if (s.state === 'expired') return `${d} · PASS EXPIRED`;
  return d;
}
