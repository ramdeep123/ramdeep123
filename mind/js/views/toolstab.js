// Tools tab: every change tool, your focus first.

import { state } from '../store.js';
import { icon } from '../ui.js';
import { esc } from '../engine/util.js';
import { FOCUSES } from '../engine/content.js';
import { header } from '../core.js';
import { TOOLS } from './tools.js';

export function html() {
  const f = FOCUSES.find((x) => x.id === state.plan.focus);
  const mine = new Set(f?.tools || []);
  const ordered = [...TOOLS].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  return `${header('Practise daily', 'Tools')}
  ${f ? `<p class="lead px">Your focus: <b>${esc(f.title)}</b>. Its tools are marked.</p>` : ''}
  <div class="tool-list">
    ${ordered.map((t) => `<button class="tool-item ${mine.has(t.id) ? 'mine' : ''}" data-act="open" data-tool="${t.id}">
      <span class="ti">${icon(t.icon)}</span>
      <span class="tt"><b>${esc(t.title)}</b><span>${esc(t.body)}</span></span>
      ${mine.has(t.id) ? '<span class="badge">focus</span>' : icon('chev')}
    </button>`).join('')}
  </div>`;
}

export const actions = {
  open: (el) => TOOLS.find((t) => t.id === el.dataset.tool)?.open(),
};
