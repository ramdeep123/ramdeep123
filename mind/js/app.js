// App shell: lock → onboarding → tabs. Help is reachable from every screen.

import { initStore, state, flush, hasPin, lockNow } from './store.js';
import { hooks } from './core.js';
import { icon, setViewActions, globalActions, closeLayer, layerCount, closeAllLayers } from './ui.js';
import { applyTheme, savedTheme } from './theme.js';
import { showLock } from './views/lock.js';
import { showOnboarding, onboardingBack } from './views/onboarding.js';
import { openInterview } from './views/interview.js';
import { openCrisis } from './views/crisis.js';
import * as today from './views/today.js';
import * as maptab from './views/maptab.js';
import * as toolstab from './views/toolstab.js';
import * as you from './views/you.js';

const VIEWS = { today, map: maptab, tools: toolstab, you };
const TABS = [['today', 'Today', 'today'], ['map', 'Map', 'map'], ['tools', 'Tools', 'tools'], ['you', 'You', 'you']];
const LOCK_AFTER_MS = 60000;

let current = 'today';
let ready = false;
const app = document.getElementById('app');

function dock() {
  return `<nav class="dock" aria-label="Main">${TABS.map(([id, label, ic]) => `<button data-act="go" data-tab="${id}" ${current === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
}

function render() {
  if (!state.user.onboarded) {
    showOnboarding(app, () => {
      app.onclick = null;
      current = 'today';
      render();
      openInterview();
    });
    return;
  }
  const v = VIEWS[current] || VIEWS.today;
  app.innerHTML = `<main class="view" id="view" data-tab="${current}">${v.html()}</main>${dock()}`;
  setViewActions(v.actions || {});
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
  if (!ready || !state.user.onboarded) return;
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
};
hooks.crisis = () => openCrisis();
hooks.interview = () => openInterview();
globalActions.go = (el) => go(el.dataset.tab);

/** Android hardware back: true when handled inside the app. */
window.MindBack = () => {
  if (layerCount()) { closeLayer(); return true; }
  if (!state.user.onboarded) { const r = onboardingBack(); if (r) render(); return r; }
  if (current !== 'today') { go('today'); return true; }
  return false;
};
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && layerCount()) closeLayer();
});

// Save when the app goes to the background; lock again after a minute away.
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenAt = Date.now(); flush(); return; }
  if (hasPin() && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) {
    closeAllLayers();
    await lockNow();
    location.reload();
  }
});

async function boot() {
  applyTheme(savedTheme());
  const status = await initStore();
  const start = () => {
    ready = true;
    app.onclick = null;
    applyTheme(state.settings.theme);
    const fromHash = location.hash.replace('#', '');
    if (VIEWS[fromHash]) current = fromHash;
    render();
  };
  if (status === 'locked') showLock(app, start);
  else start();
}

boot();

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.MindNative) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
