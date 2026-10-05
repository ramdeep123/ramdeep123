// UI plumbing: icons, sheets/stages, toasts, rings, delegated actions.

import { esc } from './engine/util.js';

const P = {
  today: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  train: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/>',
  fuel: '<path d="M12 3c3 4 6 6.8 6 10.5A6 6 0 0 1 6 13.5C6 10 8.5 8 9.5 5.5c.8 1.9 1.6 3 2.9 3.6C12.6 7 12.4 5 12 3z"/>',
  mind: '<path d="M3 12c2.2-3 4.2-3 6 0s3.8 3 6 0 4-3 6 0"/><path d="M3 17c2.2-3 4.2-3 6 0s3.8 3 6 0 4-3 6 0" opacity=".5"/><path d="M3 7c2.2-3 4.2-3 6 0s3.8 3 6 0 4-3 6 0" opacity=".5"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  swap: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  camera: '<path d="M4 8.5h3l2-2.5h6l2 2.5h3V19H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
  upload: '<path d="M12 16V5M7 9.5 12 4.5l5 5M5 19.5h14"/>',
  flip: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  volume: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  mute: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
  share: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v6.5h14V13"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.5l2.5 1.5M10 2.5h4"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- delegated actions ----------
// Each layer (view, sheet, stage) registers an actions map; clicks on
// [data-act] dispatch to the topmost layer that knows the action.
const layers = [];
export function pushActions(map) { layers.push(map); return map; }
export function popActions(map) { const i = layers.lastIndexOf(map); if (i >= 0) layers.splice(i, 1); }
let viewActions = {};
export function setViewActions(map) { viewActions = map || {}; }

function dispatch(name, el, ev) {
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i][name]) { layers[i][name](el, ev); return true; }
  }
  if (viewActions[name]) { viewActions[name](el, ev); return true; }
  if (globalActions[name]) { globalActions[name](el, ev); return true; }
  return false;
}
export const globalActions = {};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  dispatch(el.dataset.act, el, ev);
});
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  if (el) dispatch(el.dataset.input, el, ev);
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (el) dispatch(el.dataset.change, el, ev);
});

// ---------- layers ----------
const stack = [];

function mountLayer(kind, { html, actions = {}, mount, onClose, temp }) {
  const root = document.getElementById('layers');
  const wrap = document.createElement('div');
  if (temp) wrap.dataset.temp = temp;
  let scrim = null;
  if (kind === 'sheet') {
    scrim = document.createElement('div');
    scrim.className = 'scrim';
    wrap.appendChild(scrim);
    const el = document.createElement('div');
    el.className = 'sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = html;
    wrap.appendChild(el);
  } else {
    const el = document.createElement('div');
    el.className = 'stage';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="stage-in">${html}</div>`;
    wrap.appendChild(el);
  }
  root.appendChild(wrap);
  const layer = { kind, wrap, actions: pushActions({ ...actions, close: () => closeLayer(layer) }), onClose };
  if (scrim) scrim.addEventListener('click', () => closeLayer(layer));
  stack.push(layer);
  document.body.style.overflow = 'hidden';
  layer.el = wrap.querySelector(kind === 'sheet' ? '.sheet' : '.stage-in');
  mount?.(layer.el, layer);
  return layer;
}

export function closeLayer(layer) {
  layer = layer || stack[stack.length - 1];
  if (!layer) return false;
  const i = stack.indexOf(layer);
  if (i < 0) return false;
  stack.splice(i, 1);
  popActions(layer.actions);
  layer.wrap.remove();
  layer.onClose?.();
  if (!stack.length) document.body.style.overflow = '';
  return true;
}

export const openSheet = (opts) => mountLayer('sheet', opts);
export const openStage = (opts) => mountLayer('stage', opts);
export const topLayer = () => stack[stack.length - 1];
export const layerCount = () => stack.length;

/** Replace a layer's content in place (keeps actions). */
export function setLayerHTML(layer, html) {
  layer.el.innerHTML = html;
}

let toastTimer = 0;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

/** SVG progress ring. */
export function ring(value, { size = 72, stroke = 7, color = 'var(--accent)', track = 'var(--surface-3)', inner = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" style="transition:stroke-dashoffset .6s ease"/>
    </svg><div class="in">${inner}</div></div>`;
}

export function stepper(id, value, { unit = '', step = 1, min = 0, max = 999, act = 'step' } = {}) {
  return `<div class="stepper">
    <button type="button" data-act="${act}" data-target="${id}" data-d="${-step}" data-min="${min}" data-max="${max}" aria-label="Decrease">−</button>
    <div class="mid"><input id="${id}" type="number" inputmode="decimal" value="${esc(value)}" min="${min}" max="${max}" step="${step}" data-input="${act}-in"><span class="unit">${esc(unit)}</span></div>
    <button type="button" data-act="${act}" data-target="${id}" data-d="${step}" data-min="${min}" data-max="${max}" aria-label="Increase">+</button>
  </div>`;
}

/** Shared handler for steppers: nudges the target input and fires input. */
export function nudge(el) {
  const input = document.getElementById(el.dataset.target);
  if (!input) return null;
  const d = parseFloat(el.dataset.d);
  const min = parseFloat(el.dataset.min), max = parseFloat(el.dataset.max);
  let v = parseFloat(input.value) || 0;
  v = Math.round((v + d) * 100) / 100;
  v = Math.min(max, Math.max(min, v));
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return v;
}

export function pressed(group, el) {
  group.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
}
