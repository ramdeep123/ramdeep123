// App state, shaped like the handoff data model (§7), kept encrypted on the
// phone through vault.js. Nothing here is ever sent anywhere by itself.

import { createVault, bestBackend } from './vault.js';
import { newInterview } from './engine/interview.js';
import { guessRegion } from './engine/crisis-lines.js';
import { config } from './config.js';

export function blankState() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old WebView */ }
  return {
    v: 1,
    user: { ageConfirmed18: false, notTherapyAck: false, consentAt: 0, language: 'en', onboarded: false },
    settings: { ai: false, region: guessRegion(tz, globalThis.navigator?.language || ''), nightHour: 23, urgeMinutes: config.urgeMinutes, theme: 'auto' },
    interview: newInterview(),
    map: null,
    plan: { focus: null, newBelief: '', urge: { bodySignal: '', bodyRule: '', firstStep: '', firstStepRule: '' } },
    tracking: { days: [], slipReviews: [], thoughtRecords: [], urges: [], disagreements: [], beliefRatings: [], nights: [], tasks: [] },
  };
}

export const state = blankState();
let vault = null;
let persistent = true;
let timer = 0;

function assign(obj) {
  const fresh = blankState();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh, obj || {});
  // merge nested defaults so older saves gain new fields
  for (const k of ['user', 'settings', 'plan', 'tracking']) state[k] = { ...fresh[k], ...(obj?.[k] || {}) };
}

/** → 'new' | 'ready' | 'locked' */
export async function initStore() {
  const backend = await bestBackend();
  persistent = backend.persistent;
  vault = createVault({ backend });
  try {
    const loaded = await vault.load();
    if (loaded?.locked) return 'locked';
    if (loaded) { assign(loaded); return 'ready'; }
  } catch (e) {
    // unreadable record (e.g. device key lost): start fresh rather than crash
  }
  return 'new';
}

export const isPersistent = () => persistent;
export const hasPin = () => vault?.mode === 'pin';
export const pinWait = () => vault.waitTime();

export async function unlock(pin) {
  const loaded = await vault.unlock(pin);
  assign(loaded);
}

export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

export async function flush() {
  clearTimeout(timer);
  if (!vault) return;
  try { await vault.save(state); } catch (e) { /* storage full or blocked: keep running */ }
}

export function update(fn) {
  fn(state);
  save();
}

export function replaceAll(obj) {
  assign(obj);
  save();
}

export async function setPin(pin) { await vault.setPin(pin, state); }
export async function clearPin() { await vault.clearPin(state); }
export const checkPin = (pin) => vault.checkPin(pin);

/** Forget the key and show the lock screen (only when a PIN is set). */
export async function lockNow() {
  if (!hasPin()) return false;
  await flush();
  vault.lock();
  return true;
}

/** "Delete everything": the encrypted database, browser storage and caches. */
export async function wipeAll() {
  clearTimeout(timer);
  await vault.wipe();
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* blocked */ }
  try {
    if (globalThis.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { /* no caches */ }
  assign(null);
}

/** Export in the handoff's data model (section 7) as readable JSON. */
export function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    app: config.appName,
    user: { ageConfirmed18: state.user.ageConfirmed18, language: state.user.language },
    interview: { stage: state.interview.stage, turns: state.interview.turns.map(({ reflection, corrections, mapNotes, source, ...t }) => ({ ...t, reflection })) },
    map: state.map,
    plan: state.plan,
    tracking: state.tracking,
  };
}
