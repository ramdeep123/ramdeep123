// UI plumbing: icons, delegated actions, full-screen layers and sheets, toast.
// Views are plain functions returning HTML strings; clicks on [data-act]
// dispatch to the topmost layer (or the current view) that knows the action.

const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  tools: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  you: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20.2c1.3-3.6 4-5.2 7.2-5.2s5.9 1.6 7.2 5.2"/>',
  help: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.6"/><path d="m5.9 5.9 3.6 3.6M14.5 14.5l3.6 3.6M18.1 5.9l-3.6 3.6M9.5 14.5l-3.6 3.6"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  redo: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
  undo: '<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4.5V11h6.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  wave: '<path d="M2.5 13c2.2 0 2.2-5 4.4-5s2.2 9 4.6 9 2.4-11 4.8-11 2.2 7 5.2 7"/>',
  note: '<path d="M6 3.5h9l3 3V20.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><path d="M15.5 6a3 3 0 0 1 0 5.5M17.5 14.6c1.6.6 2.6 2 3 4.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.2 1.2L7 5.4M3.5 12l1.2 1.2L7 10.9M3.5 17.5l1.2 1.2L7 16.4"/>',
  seed: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5z"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.5 3 7.8 7 9.5 4-1.7 7-5 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  spark: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 5.5h16v10H9l-5 4z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- delegated actions ----------
const layers = [];
let viewActions = {};
export const globalActions = {};
export function setViewActions(map) { viewActions = map || {}; }

function dispatch(name, el, ev) {
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].actions[name]) { layers[i].actions[name](el, ev, layers[i]); return true; }
    if (layers[i].modal) break; // a modal layer hides everything under it
  }
  if (!layers.some((l) => l.modal) && viewActions[name]) { viewActions[name](el, ev); return true; }
  if (globalActions[name]) { globalActions[name](el, ev); return true; }
  return false;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  ev.preventDefault();
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

// ---------- layers: full-screen "stage" or bottom "sheet" ----------

/**
 * openLayer({ kind: 'stage'|'sheet', render: (layer) => html, actions, mount, onClose, modal })
 * layer.refresh() re-renders in place; layer.close() closes it.
 */
export function openLayer({ kind = 'stage', render, actions = {}, mount, onClose, modal = true, label = '' }) {
  const root = document.getElementById('layers');
  const wrap = document.createElement('div');
  wrap.className = `layer layer-${kind}`;
  const layer = { kind, wrap, modal, actions: {}, onClose, render, mount };
  layer.actions = { ...actions, close: () => closeLayer(layer) };
  layer.close = () => closeLayer(layer);
  layer.refresh = () => {
    const scroller = wrap.querySelector('.layer-body');
    const y = scroller ? scroller.scrollTop : 0;
    paint();
    const s2 = wrap.querySelector('.layer-body');
    if (s2) s2.scrollTop = y;
  };
  function paint() {
    wrap.innerHTML = kind === 'sheet'
      ? `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${label}"><div class="grab"></div><div class="layer-body">${render(layer)}</div></div>`
      : `<div class="stage" role="dialog" aria-modal="true" aria-label="${label}"><div class="layer-body">${render(layer)}</div></div>`;
    layer.el = wrap.querySelector('.layer-body');
    mount?.(layer.el, layer);
  }
  root.appendChild(wrap);
  layers.push(layer);
  paint();
  document.body.classList.add('has-layer');
  requestAnimationFrame(() => wrap.classList.add('in'));
  return layer;
}

export function closeLayer(layer) {
  layer = layer || layers[layers.length - 1];
  const i = layers.indexOf(layer);
  if (i < 0) return false;
  layers.splice(i, 1);
  layer.wrap.remove();
  layer.onClose?.();
  if (!layers.length) document.body.classList.remove('has-layer');
  return true;
}

export const layerCount = () => layers.length;
export const topLayer = () => layers[layers.length - 1];
export function closeAllLayers() { while (layers.length) closeLayer(); }

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
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

/** Toggle aria-pressed on a chip; single-choice groups clear the others. */
export function toggleChip(el) {
  const group = el.closest('[data-group]');
  const on = el.getAttribute('aria-pressed') !== 'true';
  if (group && group.dataset.multi === 'false') $$('[aria-pressed]', group).forEach((b) => b.setAttribute('aria-pressed', 'false'));
  el.setAttribute('aria-pressed', String(on));
}

export const pressedIds = (root) => $$('[aria-pressed="true"]', root).map((b) => b.dataset.id);

export function haptic(ms = 12) {
  try { if (window.MindNative?.vibrate) window.MindNative.vibrate(ms); else navigator.vibrate?.(ms); } catch (e) { /* no vibration */ }
}

/** Download / share a text file (Android uses the native share sheet). */
export function saveFile(name, text, mime = 'application/json') {
  if (window.MindNative?.shareFile) { window.MindNative.shareFile(name, text, mime); return; }
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
