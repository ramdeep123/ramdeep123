// App shell: routing between tabs, the dock, Android back button, boot.

import { state } from './store.js';
import { hooks } from './core.js';
import { icon, setViewActions, globalActions, closeLayer, layerCount } from './ui.js';
import { setVoiceEnabled, loadVoicePack } from './engine/voice.js';
import { showOnboarding, onboardingBack } from './views/onboarding.js';
import * as today from './views/today.js';
import * as train from './views/train.js';
import * as coach from './views/coach.js';
import * as fuel from './views/fuel.js';
import * as mind from './views/mind.js';
import * as you from './views/you.js';
import { openPass } from './views/pass.js';
import { state as st, update } from './store.js';
import { xp, level, dayClosed, reminderPlan } from './engine/engage.js';
import { setReminders } from './native.js';
import { toast } from './ui.js';
import { say } from './engine/voice.js';
import { L } from './engine/voicelines.js';
import { dayKey } from './engine/util.js';

const VIEWS = { today, train, coach, fuel, mind, you };
const TABS = [
  ['today', 'Today', 'today'],
  ['train', 'Train', 'train'],
  ['coach', 'Coach', 'eye'],
  ['fuel', 'Fuel', 'fuel'],
  ['mind', 'Mind', 'mind'],
];
const DOCK_COLOR = { today: 'var(--ember)', train: 'var(--ember)', fuel: 'var(--gold)', mind: 'var(--frost)', you: 'var(--magma)', coach: 'var(--ember)' };

let current = 'today';
const app = document.getElementById('app');

function renderDock() {
  return `<nav class="dock" aria-label="Main" style="--dock-c:${DOCK_COLOR[current]}">
    ${TABS.map(([id, label, ic]) => id === 'coach'
      ? `<button class="core" data-act="go" data-tab="coach" aria-label="AI Coach" ${current === id ? 'aria-current="page"' : ''}>${icon(ic)}</button>`
      : `<button data-act="go" data-tab="${id}" ${current === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}
  </nav>`;
}

function render() {
  if (!state.profile) {
    showOnboarding(app, () => { current = 'today'; render(); });
    return;
  }
  const v = VIEWS[current] || VIEWS.today;
  app.innerHTML = `<main class="view" data-temp="${current}" id="view">${v.html()}</main>${renderDock()}`;
  setViewActions(v.actions || {});
  v.mount?.(app.querySelector('#view'));
  afterRender();
}

/** Celebrate milestones once, and keep the phone's reminder schedule current. */
function afterRender() {
  const e = (st.engage ||= { level: 0, closed: {} });
  const lv = level(xp(st));
  const today = dayKey();
  let msg = null, line = null;
  if (e.level && lv.n > e.level) { msg = `Level up: ${lv.name}`; line = L.levelUp; }
  if (dayClosed(st) && !e.closed[today]) { msg = msg || 'Day closed — all three done. See you tomorrow.'; line = line || L.dayClosed; }
  if (lv.n !== e.level || (dayClosed(st) && !e.closed[today])) {
    update((s) => {
      s.engage = { level: lv.n, closed: { ...(s.engage?.closed || {}), ...(dayClosed(s) ? { [today]: true } : {}) } };
    });
  }
  if (msg && e.level) {
    setTimeout(() => toast(msg), 400);
    if (st.settings.voice !== false) say(line);
  }
  setReminders(reminderPlan(st));
}

function go(tab) {
  if (!VIEWS[tab]) return;
  current = tab;
  render();
  window.scrollTo(0, 0);
  try { history.replaceState(null, '', '#' + tab); } catch (e) { /* sandboxed */ }
}

hooks.go = go;
hooks.refresh = () => {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
};
hooks.openPass = openPass;

globalActions.go = (el) => go(el.dataset.tab);

/** Android hardware back: returns true when handled inside the app. */
window.KayaBack = () => {
  if (layerCount()) { closeLayer(); return true; }
  if (!state.profile) return onboardingBack();
  if (current !== 'today') { go('today'); return true; }
  return false;
};
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && layerCount()) closeLayer();
});

setVoiceEnabled(state.settings.voice !== false);
loadVoicePack();

const fromHash = location.hash.replace('#', '');
if (VIEWS[fromHash]) current = fromHash;
render();

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.KayaNative) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
