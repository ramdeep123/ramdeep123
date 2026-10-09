// Map tab: the saved, editable map (or an invitation to finish the interview).

import { state, update } from '../store.js';
import { icon } from '../ui.js';
import { header, hooks } from '../core.js';
import { renderMap, editSection, redoSection } from './mapview.js';
import { newInterview } from '../engine/interview.js';

export function html() {
  if (!state.map) {
    return `${header('Your map', 'Not drawn yet')}
      <section class="card soft empty">
        <p class="lead">Your map appears after stage 6 of the interview. It shows where your patterns started, your core belief, how your mind reacts to stress, what you value, the loop that keeps a habit going, your strengths and what to change.</p>
        <button class="btn" data-act="interview">${state.interview.turns.length ? 'Continue the interview' : 'Start the interview'} ${icon('arrow')}</button>
      </section>`;
  }
  return `${header('Your map', 'How your mind works', { right: `<button class="icon-btn" data-act="print" aria-label="Print or save as PDF">${icon('print')}</button>` })}
    <div class="map-page">${renderMap(state.map)}</div>
    <section class="card soft">
      <span class="eyebrow">Things change</span>
      <p>Redo the interview any time — for example after a month of practice. Your tracking stays.</p>
      <button class="btn ghost" data-act="redo">${icon('redo')} Redo the interview</button>
    </section>`;
}

export const actions = {
  interview: () => hooks.interview(),
  editSec: (el) => editSection(el.dataset.sec, hooks.refresh),
  redoSec: (el) => redoSection(el.dataset.sec, hooks.refresh),
  print: () => window.print(),
  redo: () => {
    if (!confirm('Start the interview again? Your current map stays until the new one is drawn. Your tracking is kept.')) return;
    update((s) => { s.interview = newInterview(); });
    hooks.interview();
  },
};
