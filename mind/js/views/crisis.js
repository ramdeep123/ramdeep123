// Crisis help screen (handoff §9.1). Reachable from every screen through the
// Help button, and opened automatically within one turn when an answer
// mentions suicide, self-harm or harming someone.

import { state, update } from '../store.js';
import { openLayer, icon, layerCount, topLayer } from '../ui.js';
import { REGIONS, DIRECTORY, CHECKED, telHref, smsHref } from '../engine/crisis-lines.js';
import { esc } from '../engine/util.js';

let open = null;

export function openCrisis({ fromAnswer = false, onSafe = null } = {}) {
  if (open && layerCount() && topLayer() === open) return open;
  open = openLayer({
    kind: 'stage',
    label: 'Help now',
    render: () => html(fromAnswer, !!onSafe),
    actions: {
      region: (el, ev, layer) => { update((s) => { s.settings.region = el.dataset.region; }); layer.refresh(); },
      safe: (el, ev, layer) => { layer.close(); onSafe?.(); },
    },
    onClose: () => { open = null; },
  });
  return open;
}

function html(fromAnswer, canContinue) {
  const regionId = state.settings.region || 'OTHER';
  const region = REGIONS[regionId] || REGIONS.OTHER;
  const lines = region.lines.map((l) => `
    <div class="line-card">
      <div><b>${esc(l.name)}</b><span>${esc(l.detail)}</span></div>
      <div class="line-btns">
        <a class="btn call" href="${telHref(l.call)}">${icon('phone')} Call ${esc(l.call)}</a>
        ${l.text ? `<a class="btn ghost" href="${smsHref(l.text)}">${icon('chat')} Text ${esc(l.text)}</a>` : ''}
        ${l.alt ? `<a class="btn ghost small" href="${telHref(l.alt)}">or ${esc(l.alt)}</a>` : ''}
      </div>
    </div>`).join('');
  return `
  <div class="crisis">
    <div class="crisis-top">
      ${canContinue ? '' : `<button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button>`}
    </div>
    <span class="eyebrow">Help now</span>
    <h1 class="display">${fromAnswer ? 'Thank you for telling me.' : 'You don’t have to carry this alone.'}</h1>
    <p class="lead">${fromAnswer ? 'What you wrote sounds really hard. Your safety matters more than any question here. Please talk to someone now — it’s free and confidential.' : 'If you might act on thoughts of ending your life or hurting someone, please contact one of these now. It’s free and confidential.'}</p>

    ${region.emergency ? `<a class="btn sos" href="${telHref(region.emergency)}">${icon('phone')} In danger right now? Call ${esc(region.emergency)}</a>` : `<p class="note">In danger right now? Call your local emergency number.</p>`}

    ${lines}

    <a class="line-card dir" href="${DIRECTORY.url}" target="_blank" rel="noopener noreferrer">
      <div><b>${esc(DIRECTORY.name)}</b><span>${esc(DIRECTORY.detail)} — for any country</span></div>${icon('link')}
    </a>

    <div class="card soft">
      <b>Right now, you can also:</b>
      <ul class="dots">
        <li>Go where other people are, or call someone you trust and say “I’m not okay.”</li>
        <li>Put distance between you and anything you could use to hurt yourself.</li>
        <li>Breathe out slowly, longer than you breathe in. Feelings this strong do pass.</li>
      </ul>
    </div>

    <div class="region">
      <span class="eyebrow">Your country</span>
      <div class="seg">${Object.entries(REGIONS).map(([id, r]) => `<button data-act="region" data-region="${id}" aria-pressed="${id === regionId}">${esc(r.name)}</button>`).join('')}</div>
    </div>

    <p class="fine">This app can’t help in an emergency and is not therapy. Numbers last checked ${CHECKED}.</p>
    ${canContinue ? `<button class="btn ghost wide" data-act="safe">I’m safe right now — go back</button>` : ''}
  </div>`;
}
