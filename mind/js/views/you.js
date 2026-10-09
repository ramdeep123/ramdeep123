// You: privacy, the AI choice, help region, night time, theme, and the
// "export my data" and "delete everything" controls (handoff §10).

import { state, update, hasPin, setPin, clearPin, checkPin, lockNow, wipeAll, exportData, isPersistent } from '../store.js';
import { icon, toast, openLayer, saveFile } from '../ui.js';
import { esc, dayKey } from '../engine/util.js';
import { header, hooks } from '../core.js';
import { aiConfigured, aiHealth } from '../ai.js';
import { REGIONS, CHECKED } from '../engine/crisis-lines.js';
import { FOCUSES } from '../engine/content.js';
import { config } from '../config.js';
import { pinPad, wirePad } from './lock.js';
import { applyTheme } from '../theme.js';

let health = null;

export function html() {
  const s = state.settings;
  return `${header('Settings & privacy', 'You')}
  <section class="set">
    <h3>${icon('lock')} App lock</h3>
    <p class="muted">${hasPin() ? 'On. Your data is encrypted with your PIN.' : 'Off. Your data is encrypted with a key kept in this app.'}</p>
    <div class="row-btns">${hasPin()
      ? `<button class="btn ghost" data-act="lockNow">Lock now</button><button class="btn quiet" data-act="pinOff">Turn off</button>`
      : `<button class="btn ghost" data-act="pinOn">${icon('lock')} Set a PIN</button>`}</div>
  </section>

  ${aiConfigured() ? `<section class="set">
    <h3>${icon('spark')} AI guide</h3>
    <label class="switch"><input type="checkbox" data-change="ai" ${s.ai ? 'checked' : ''}><span>Use the AI guide for reflections and the map</span></label>
    <p class="muted">When on, your answers (never your name) go through our server to an AI model to write reflections. Nothing is stored there. When off, the on-phone guide does everything.</p>
    ${health ? `<p class="fine">Server: ${health.ok ? (health.ai ? 'ready' : 'AI not configured') : 'not reachable — the on-phone guide will be used'}.</p>` : ''}
  </section>` : `<section class="set"><h3>${icon('shield')} Private mode</h3><p class="muted">The on-phone guide writes all reflections. Nothing you write leaves this phone.</p></section>`}

  <section class="set">
    <h3>${icon('help')} Help lines for</h3>
    <div class="seg wrap">${Object.entries(REGIONS).map(([id, r]) => `<button data-act="region" data-region="${id}" aria-pressed="${s.region === id}">${esc(r.name)}</button>`).join('')}</div>
    <p class="fine">Numbers last checked ${CHECKED}.</p>
  </section>

  ${state.plan.focus ? `<section class="set">
    <h3>${icon('tools')} Focus</h3>
    <div class="seg wrap">${FOCUSES.map((f) => `<button data-act="focus" data-id="${f.id}" aria-pressed="${state.plan.focus === f.id}">${esc(f.title)}</button>`).join('')}</div>
  </section>` : ''}

  <section class="set">
    <h3>${icon('moon')} Night mode starts at</h3>
    <div class="seg wrap">${[21, 22, 23, 0].map((h) => `<button data-act="nightHour" data-h="${h}" aria-pressed="${s.nightHour === h}">${String(h).padStart(2, '0')}:00</button>`).join('')}</div>
  </section>

  <section class="set">
    <h3>${icon('eye')} Appearance</h3>
    <div class="seg">${[['auto', 'Auto'], ['light', 'Paper'], ['dark', 'Night']].map(([id, l]) => `<button data-act="theme" data-t="${id}" aria-pressed="${(s.theme || 'auto') === id}">${l}</button>`).join('')}</div>
  </section>

  <section class="set">
    <h3>${icon('download')} Your data</h3>
    <p class="muted">${isPersistent() ? 'Stored only on this phone, encrypted.' : 'This browser blocks storage, so nothing is being saved.'}</p>
    <div class="row-btns col">
      <button class="btn ghost" data-act="export">${icon('download')} Export my data</button>
      <button class="btn danger" data-act="wipe">${icon('trash')} Delete everything</button>
    </div>
  </section>

  <section class="set about">
    <h3>About</h3>
    <p><b>${config.appName}</b> ${config.version}. A guided self-reflection app built on CBT ideas.</p>
    <p class="muted">It is <b>not therapy</b>, diagnosis or medical advice. If a problem is severe or lasts a long time, please see a professional. If you are in danger, use the Help button.</p>
    <p class="fine">No ads. No analytics. No account.</p>
  </section>`;
}

function pinFlow() {
  let first = '';
  const layer = openLayer({
    kind: 'stage',
    label: 'Set a PIN',
    render: () => `<div class="tool"><div class="tool-top"><button class="icon-btn" data-act="close" aria-label="Close">${icon('back')}</button></div>${pinPad(first ? 'Repeat your PIN' : 'Choose a PIN', first ? 'Type it once more.' : '4 to 6 digits. There is no way to recover a forgotten PIN.')}</div>`,
    mount: (root, l) => {
      const pad = root.querySelector('.lock');
      pad.tabIndex = -1;
      pad.focus();
      wirePad(pad, async (pin, fail) => {
        if (!first) { first = pin; l.refresh(); return; }
        if (pin !== first) { first = ''; fail('The PINs didn’t match.'); setTimeout(() => l.refresh(), 900); return; }
        await setPin(pin);
        l.close();
        toast('App lock is on.');
        hooks.refresh();
      });
    },
  });
  return layer;
}

export const actions = {
  pinOn: pinFlow,
  pinOff: async () => {
    const pin = prompt('Enter your current PIN to turn the lock off:');
    if (pin === null) return;
    if (!(await checkPin(pin))) { toast('That PIN didn’t work.'); return; }
    await clearPin();
    toast('App lock is off.');
    hooks.refresh();
  },
  lockNow: async () => { if (await lockNow()) location.reload(); },
  ai: (el) => {
    update((s) => { s.settings.ai = el.checked; });
    if (el.checked) aiHealth().then((h) => { health = h; hooks.refresh(); });
    else hooks.refresh();
  },
  region: (el) => { update((s) => { s.settings.region = el.dataset.region; }); hooks.refresh(); },
  focus: (el) => { update((s) => { s.plan.focus = el.dataset.id; }); hooks.refresh(); },
  nightHour: (el) => { update((s) => { s.settings.nightHour = Number(el.dataset.h); }); hooks.refresh(); },
  theme: (el) => { update((s) => { s.settings.theme = el.dataset.t; }); applyTheme(el.dataset.t); hooks.refresh(); },
  export: () => {
    saveFile(`know-your-mind-${dayKey()}.json`, JSON.stringify(exportData(), null, 2));
    toast('Exported. Keep the file somewhere private.');
  },
  wipe: async () => {
    const typed = prompt('This deletes your answers, map and tracking from this phone. It can’t be undone.\n\nType DELETE to confirm.');
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== 'DELETE') { toast('Not deleted.'); return; }
    await wipeAll();
    location.reload();
  },
};
