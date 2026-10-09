// Talks to our own backend (server/server.mjs) — never to an AI company
// directly, and never with a key in the app. Every reply is cleaned again
// here, and any failure quietly falls back to the on-phone guide.

import { config } from './config.js';
import { state } from './store.js';
import { cleanTurn, cleanMapParts, compactTurns } from './engine/aishape.js';
import { stageGoal } from './engine/interview.js';

export const aiConfigured = () => !!config.apiBase;
export const aiOn = () => aiConfigured() && state.settings.ai && globalThis.navigator?.onLine !== false;

function url(path) {
  const base = config.apiBase === 'same-origin' ? '' : config.apiBase.replace(/\/$/, '');
  return base + path;
}

async function post(path, body, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.clientToken ? { 'X-Client-Token': config.clientToken } : {}) },
      body: JSON.stringify(body),
      signal: ctl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error('ai ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** The map without long free text, as context for the guide. */
function draft(map) {
  if (!map) return null;
  const { disclaimer, ...rest } = map;
  return rest;
}

export async function aiTurn(iv, draftMap) {
  const raw = await post('/api/turn', { stage: iv.stage, stageGoal: stageGoal(iv.stage), draftMap: draft(draftMap), turns: compactTurns(iv.turns) }, 30000);
  return cleanTurn(raw);
}

export async function aiMap(turns, draftMap) {
  return cleanMapParts(await post('/api/map', { turns: compactTurns(turns), draftMap: draft(draftMap) }, 90000));
}

export async function aiSection(section, turns, map) {
  return cleanMapParts(await post('/api/map/section', { section, turns: compactTurns(turns), draftMap: draft(map) }, 60000));
}

export async function aiHealth() {
  try {
    const res = await fetch(url('/api/health'), { credentials: 'omit' });
    return res.ok ? await res.json() : { ok: false };
  } catch (e) {
    return { ok: false };
  }
}
