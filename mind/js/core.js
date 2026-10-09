// Shared view helpers: navigation hooks, the header with the always-visible
// Help button, and the map flow (phone draft + optional AI).

import { state, update } from './store.js';
import { icon, globalActions } from './ui.js';
import { esc, greeting, fmtDate } from './engine/util.js';
import { buildMap } from './engine/mapbuild.js';
import { sectionFilled, SECTION_KEYS } from './engine/aishape.js';
import { aiOn, aiMap, aiSection } from './ai.js';
import { analyse } from './engine/analyse.js';

export const hooks = { go: () => {}, refresh: () => {}, crisis: () => {}, interview: () => {} };
export const go = (tab) => hooks.go(tab);
export const refresh = () => hooks.refresh();

/** Help is one tap away on every screen (handoff §6, §9). */
export function helpButton() {
  return `<button class="help-btn" data-act="help" aria-label="Get help now">${icon('help')}<span>Help</span></button>`;
}

export function header(eyebrow, title, { right = '' } = {}) {
  return `<header class="vh">
    <div class="vh-l"><span class="eyebrow">${eyebrow}</span><h1 class="display">${title}</h1></div>
    <div class="vh-r">${right}${helpButton()}</div>
  </header>`;
}

export function todayEyebrow(ts = Date.now()) {
  return `${esc(greeting(ts))} · ${esc(fmtDate(ts))}`;
}

globalActions.help = () => hooks.crisis();

/** The seed for the contour fingerprint: the user's own answers. */
export function mapSeed() {
  return state.interview.turns.map((t) => (t.selectedIds || []).join(',') + t.freeText).join('|') || 'empty';
}

/** Build the map: phone draft first, then the AI version if it is on. */
export async function generateMap() {
  const turns = state.interview.turns;
  const local = buildMap(turns, { nightHour: state.settings.nightHour });
  let map = { ...local, source: 'phone' };
  if (aiOn()) {
    try {
      const ai = await aiMap(turns, local);
      map = merge(local, ai);
    } catch (e) { /* keep the phone draft */ }
  }
  map.generatedAt = Date.now();
  map.edited = {};
  return map;
}

function merge(local, ai) {
  const out = { ...local, source: 'ai' };
  for (const [k, v] of Object.entries(ai)) {
    if (!sectionFilled(k, v)) continue;
    out[k] = k === 'coreBelief' ? { ...v, id: 'ai' } : k === 'loop' ? { ...local.loop, ...v } : v;
  }
  return out;
}

/** Redo one section from the answers (AI if on, otherwise the phone rules). */
export async function regenerateSection(section) {
  const turns = state.interview.turns;
  const local = buildMap(turns, { nightHour: state.settings.nightHour });
  let parts = {};
  for (const k of SECTION_KEYS[section]) parts[k] = local[k];
  let usedAi = false;
  if (aiOn()) {
    try {
      const ai = await aiSection(section, turns, state.map);
      const good = Object.fromEntries(Object.entries(ai).filter(([k, v]) => sectionFilled(k, v)));
      if (Object.keys(good).length) { parts = { ...parts, ...good }; usedAi = true; }
    } catch (e) { /* phone version */ }
  }
  update((s) => {
    for (const [k, v] of Object.entries(parts)) s.map[k] = k === 'coreBelief' ? { ...v, id: v.id || 'ai' } : v;
    if (s.map.edited) delete s.map.edited[section];
  });
  return usedAi;
}

/** Live "map so far" during the interview. */
export function liveMap() {
  const turns = state.interview.turns;
  const an = analyse(turns);
  return { map: buildMap(turns, { an, nightHour: state.settings.nightHour }), an };
}
