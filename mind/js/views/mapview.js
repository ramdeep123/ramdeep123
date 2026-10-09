// The map page (handoff §4): seven sections, each editable and
// regenerable, ending with the "not a diagnosis" line.

import { state, update } from '../store.js';
import { icon, openLayer, toast } from '../ui.js';
import { esc } from '../engine/util.js';
import { SECTIONS, DISCLAIMER } from '../engine/mapbuild.js';
import { contour, loopDiagram } from '../art.js';
import { mapSeed, regenerateSection } from '../core.js';
import { aiOn } from '../ai.js';

export const NS_TEXT = {
  fight: 'Under stress your body gears up to fight — anger, arguing, pushing.',
  escape: 'Under stress your first move is to get away — scroll, leave, sleep, numb out.',
  freeze: 'Under stress you lock up — blank mind, stuck, can’t decide.',
  shutdown: 'Under stress you power down — numb, tired, low.',
  mixed: 'Under stress you move between responses.',
  unclear: 'Not clear yet — the slip review and urge timer will show it.',
};

const LOOP_STEPS = [
  ['trigger', 'Trigger'], ['urge', 'Urge'], ['action', 'Action'], ['relief', 'Relief'], ['cost', 'Cost'],
];

const list = (items) => (items?.length ? items : []);

function sectionBody(id, m) {
  switch (id) {
    case 'origins':
      return list(m.origins).length
        ? list(m.origins).map((o) => `<div class="thread"><div class="then"><span class="tag">Then</span>${esc(o.then)}</div><div class="arrow" aria-hidden="true"></div><div class="now"><span class="tag">Now</span>${esc(o.now)}</div></div>`).join('')
        : '<p class="muted">Not clear yet. The early-memory questions fill this in — or add your own.</p>';
    case 'coreBelief':
      return `<blockquote class="belief">“${esc(m.coreBelief?.belief)}”</blockquote>
        <p><span class="k">Life rule</span> ${esc(m.coreBelief?.rule)}</p>
        ${m.coreBelief?.replacement ? `<p class="try"><span class="k">Try instead</span> “${esc(m.coreBelief.replacement)}”</p>` : ''}`;
    case 'mind': {
      const ns = m.nervousSystem || {};
      return `<div class="ns">
          <div class="ns-word ${esc(ns.response)}">${esc(ns.response || 'unclear')}</div>
          <p>${esc(NS_TEXT[ns.response] || NS_TEXT.unclear)}${ns.corrected ? ' <span class="badge amber">corrected</span>' : ''}</p>
        </div>
        <dl class="facts-dl">
          <div><dt>Earliest body signal</dt><dd>${esc(ns.bodySignal || 'not clear yet')}</dd></div>
          <div><dt>Weakest times</dt><dd>${list(ns.weakTimes).length ? list(ns.weakTimes).map((t) => `<span class="pill">${esc(t)}</span>`).join('') : '—'}</dd></div>
          ${list(ns.weakSpots).length ? `<div><dt>Weak spots</dt><dd>${list(ns.weakSpots).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</dd></div>` : ''}
        </dl>
        <h4 class="mini">Thinking habits</h4>
        ${list(m.thinkingHabits).length ? `<ul class="habits">${list(m.thinkingHabits).map((h) => `<li><b>${esc(h.name)}</b><span>${esc(h.example)}</span></li>`).join('')}</ul>` : '<p class="muted">None stood out yet.</p>'}`;
    }
    case 'values':
      return `<div class="vals">
        <div><h4 class="mini">Yours — even with nobody watching</h4>${list(m.values?.intrinsic).length ? `<ul>${m.values.intrinsic.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : '<p class="muted">—</p>'}</div>
        <div class="appr"><h4 class="mini">Depends on approval</h4>${list(m.values?.approvalBased).length ? `<ul>${m.values.approvalBased.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : '<p class="muted">—</p>'}</div>
      </div>`;
    case 'loop': {
      const l = m.loop || {};
      return `${l.habit ? `<p class="muted">The habit: <b>${esc(l.habit)}</b></p>` : ''}
        <div class="loop-wrap">${loopDiagram(LOOP_STEPS.map(([key, label]) => ({ key, label })), { breakAt: ['urge', 'action'] })}</div>
        <ol class="loop-steps">${LOOP_STEPS.map(([k, label]) => `<li class="${k === 'urge' || k === 'action' ? 'brk' : ''}"><b>${label}</b><span>${esc(l[k] || '—')}</span></li>`).join('')}</ol>
        <p class="hint">${icon('spark')} Your urge plan steps in at <b>2 · Urge</b> and <b>3 · the first small step</b> — the earliest, easiest places to break the loop.</p>`;
    }
    case 'strengths':
      return list(m.strengths).length
        ? `<div class="strengths">${m.strengths.map((s) => `<div class="strength"><b>${esc(s.strength)}</b><span>${esc(s.evidence)}</span></div>`).join('')}</div>`
        : '<p class="muted">Strengths appear when your answers show them.</p>';
    case 'actions':
      return `<ol class="actions">${list(m.actions).map((a) => `<li>${esc(a)}</li>`).join('')}</ol>`;
    default:
      return '';
  }
}

/** The map as HTML. `editable` adds edit / redo buttons per section. */
export function renderMap(map, { editable = true } = {}) {
  const m = map;
  return `
  <div class="map-hero">
    ${contour(mapSeed(), { w: 400, h: 240, rings: 13, cls: 'contour map-contour' })}
    <div class="map-hero-in">
      <span class="eyebrow">Your map · draft${m.source === 'ai' ? ' · AI guide' : ''}</span>
      <p class="map-belief">“${esc(m.coreBelief?.belief || '')}”</p>
      <p class="muted">${esc(m.nervousSystem?.response || '')} response · body signal: ${esc(m.nervousSystem?.bodySignal || '—')}</p>
    </div>
  </div>
  ${SECTIONS.map((s) => `
    <section class="map-sec" id="sec-${s.id}">
      <header>
        <span class="sec-n">${s.n}</span>
        <h3>${s.title}</h3>
        ${m.edited?.[s.id] ? '<span class="badge">edited</span>' : ''}
        ${editable ? `<div class="sec-btns">
          <button class="icon-btn sm" data-act="editSec" data-sec="${s.id}" aria-label="Edit ${s.title}">${icon('edit')}</button>
          <button class="icon-btn sm" data-act="redoSec" data-sec="${s.id}" aria-label="Regenerate ${s.title}">${icon('redo')}</button>
        </div>` : ''}
      </header>
      <div class="sec-body">${sectionBody(s.id, m)}</div>
    </section>`).join('')}
  <p class="disclaimer">${icon('shield')} ${esc(m.disclaimer || DISCLAIMER)}</p>`;
}

// ---------- editing ----------

const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);

const EDIT = {
  origins: {
    fields: (m) => [['origins', 'One per line: then → now', m.origins.map((o) => `${o.then} → ${o.now}`).join('\n'), 6]],
    save: (m, v) => { m.origins = lines(v.origins).map((l) => { const [then, now = ''] = l.split(/\s*(?:→|->)\s*/); return { then, now }; }); },
  },
  coreBelief: {
    fields: (m) => [['belief', 'Core belief (one sentence)', m.coreBelief.belief, 2], ['rule', 'The life rule it creates', m.coreBelief.rule, 2], ['replacement', 'A kinder belief to practise', m.coreBelief.replacement || '', 2]],
    save: (m, v) => { m.coreBelief = { ...m.coreBelief, belief: v.belief, rule: v.rule, replacement: v.replacement, confidence: 'guess' }; },
  },
  mind: {
    fields: (m) => [
      ['habits', 'Thinking habits — one per line: name: example', m.thinkingHabits.map((h) => `${h.name}: ${h.example}`).join('\n'), 6],
      ['response', 'Stress response (fight, escape, freeze, shutdown, mixed)', m.nervousSystem.response, 1],
      ['body', 'Earliest body signal', m.nervousSystem.bodySignal, 1],
      ['times', 'Weakest times (comma separated)', m.nervousSystem.weakTimes.join(', '), 1],
      ['spots', 'Weak spots (comma separated)', (m.nervousSystem.weakSpots || []).join(', '), 1],
    ],
    save: (m, v) => {
      m.thinkingHabits = lines(v.habits).map((l) => { const i = l.indexOf(':'); return i > 0 ? { name: l.slice(0, i).trim(), example: l.slice(i + 1).trim() } : { name: l, example: '' }; });
      const r = String(v.response || '').trim().toLowerCase();
      m.nervousSystem = { ...m.nervousSystem, response: NS_TEXT[r] ? r : 'mixed', bodySignal: v.body, weakTimes: v.times.split(',').map((s) => s.trim()).filter(Boolean), weakSpots: v.spots.split(',').map((s) => s.trim()).filter(Boolean), corrected: false };
    },
  },
  values: {
    fields: (m) => [['intrinsic', 'Yours, even with nobody watching (one per line)', m.values.intrinsic.join('\n'), 4], ['approval', 'Depends on approval (one per line)', m.values.approvalBased.join('\n'), 3]],
    save: (m, v) => { m.values = { intrinsic: lines(v.intrinsic), approvalBased: lines(v.approval) }; },
  },
  loop: {
    fields: (m) => [['habit', 'The habit', m.loop.habit || '', 1], ...LOOP_STEPS.map(([k, label]) => [k, label, m.loop[k] || '', 2])],
    save: (m, v) => { m.loop = { habit: v.habit, trigger: v.trigger, urge: v.urge, action: v.action, relief: v.relief, cost: v.cost }; },
  },
  strengths: {
    fields: (m) => [['strengths', 'One per line: strength — evidence', m.strengths.map((s) => `${s.strength} — ${s.evidence}`).join('\n'), 6]],
    save: (m, v) => { m.strengths = lines(v.strengths).map((l) => { const [strength, ...rest] = l.split(/\s+[—-]\s+/); return { strength, evidence: rest.join(' — ') }; }); },
  },
  actions: {
    fields: (m) => [['actions', 'Three to five actions, one per line', m.actions.join('\n'), 7]],
    save: (m, v) => { m.actions = lines(v.actions).slice(0, 7); },
  },
};

export function editSection(id, after) {
  const sec = SECTIONS.find((s) => s.id === id);
  const fields = EDIT[id].fields(state.map);
  openLayer({
    kind: 'sheet',
    label: `Edit ${sec.title}`,
    render: () => `
      <h2 class="sheet-title">${icon('edit')} ${sec.title}</h2>
      <p class="muted">It’s your map. Change anything that doesn’t fit.</p>
      ${fields.map(([k, label, val, rows]) => `<label class="field"><span>${esc(label)}</span>
        ${rows > 1 ? `<textarea name="${k}" rows="${rows}">${esc(val)}</textarea>` : `<input name="${k}" value="${esc(val)}">`}</label>`).join('')}
      <div class="row-btns"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="saveSec">Save</button></div>`,
    actions: {
      saveSec: (el, ev, layer) => {
        const v = Object.fromEntries([...layer.el.querySelectorAll('[name]')].map((i) => [i.name, i.value]));
        update((s) => { EDIT[id].save(s.map, v); s.map.edited = { ...(s.map.edited || {}), [id]: true }; });
        layer.close();
        toast('Saved.');
        after?.();
      },
    },
  });
}

export async function redoSection(id, after) {
  if (state.map.edited?.[id] && !confirm('Regenerate this section from your answers? Your edits to it will be replaced.')) return;
  toast(aiOn() ? 'Asking the guide…' : 'Rebuilding from your answers…');
  const usedAi = await regenerateSection(id);
  toast(usedAi ? 'Updated by the AI guide.' : 'Rebuilt from your answers.');
  after?.();
}
