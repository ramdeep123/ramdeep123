// The interview (handoff §2–3): one question at a time, tappable options
// plus free text, a reflection after every answer, corrections said out
// loud, the live "map so far", then the map reveal and choosing a focus.

import { state, update, flush, wipeAll } from '../store.js';
import { openLayer, icon, toggleChip, pressedIds, toast, haptic } from '../ui.js';
import { esc } from '../engine/util.js';
import { current, progress, answer, advance, undo, applyAiReflection, resumeAfterCrisis } from '../engine/interview.js';
import { focusOptions } from '../engine/mapbuild.js';
import { analyse } from '../engine/analyse.js';
import { aiOn, aiTurn } from '../ai.js';
import { helpButton, generateMap, liveMap, go, refresh } from '../core.js';
import { renderMap, editSection, redoSection } from './mapview.js';
import { openCrisis } from './crisis.js';
import { contour } from '../art.js';

let layer = null;
let draft = { ids: [], text: '' };
let busy = false;
let liveOpen = false;
let mapState = 'idle'; // idle | drawing | shown

const iv = () => state.interview;

export function openInterview() {
  if (layer) return;
  draft = { ids: [], text: '' };
  mapState = 'idle';
  layer = openLayer({
    kind: 'stage',
    label: 'Interview',
    render,
    mount,
    actions,
    onClose: () => { layer = null; flush(); refresh(); },
  });
}

// ---------- render ----------

function trail() {
  const p = progress(iv());
  return `<ol class="trail" aria-label="Stages">${p.stages.map((s) => `<li class="${s.state}" title="${esc(s.short)}"><i>${s.state === 'done' ? icon('check') : s.n}</i><span>${esc(s.short)}</span></li>`).join('')}</ol>`;
}

function top(cur) {
  const st = cur.stage;
  return `<div class="iv-top">
    <button class="icon-btn" data-act="pause" aria-label="Pause and save">${icon('back')}</button>
    <div class="iv-title"><span class="eyebrow">${st ? `Stage ${st.n} of 8` : 'Interview'}</span><b>${esc(st?.title || '')}</b></div>
    ${helpButton()}
  </div>`;
}

function reflectionCard(t) {
  if (!t.reflection?.length) return '';
  const corr = new Set(t.corrections || []);
  return `<div class="reflect ${t.source === 'ai' ? 'ai' : ''}">
    <span class="who">${icon(t.source === 'ai' ? 'spark' : 'map')} ${t.source === 'ai' ? 'Guide' : 'Map notes'}</span>
    <ul>${t.reflection.map((l) => `<li class="${corr.has(l) || /^This corrects my earlier guess/.test(l) ? 'corr' : ''}">${corr.has(l) || /^This corrects/.test(l) ? '<span class="badge amber">correction</span> ' : ''}${esc(l)}</li>`).join('')}</ul>
  </div>`;
}

function exchange(t, thinking) {
  const said = [...(t.selected || []), ...(t.freeText ? [`“${t.freeText}”`] : [])];
  return `<div class="ex">
    <p class="guide-q">${esc(t.question)}</p>
    <div class="you">${t.skipped ? '<i>Skipped</i>' : said.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
    ${thinking ? '<div class="reflect typing" aria-label="The guide is thinking"><i></i><i></i><i></i></div>' : reflectionCard(t)}
  </div>`;
}

function feed() {
  const turns = iv().turns;
  const here = turns.filter((t) => t.stage === iv().stage && !t.flagged);
  const shown = here.length ? here : turns.slice(-1).filter((t) => !t.flagged);
  return shown.map((t, i) => exchange(t, busy && i === shown.length - 1)).join('');
}

function liveBlock() {
  const { map, an } = liveMap();
  const items = [];
  const ns = map.nervousSystem;
  if (map.thinkingHabits.length) items.push(['Thinking', map.thinkingHabits.map((h) => h.name)]);
  if (ns.response !== 'unclear') items.push(['Stress response', [ns.response + (ns.corrected ? ' (corrected)' : '')]]);
  if (ns.bodySignal !== 'not clear yet') items.push(['Body signal', [ns.bodySignal]]);
  if (an.sig.size && [...an.sig.keys()].some((k) => k.startsWith('trig.'))) items.push(['Loop', [map.loop.trigger, map.loop.action].filter(Boolean)]);
  if (ns.weakTimes.length || ns.weakSpots.length) items.push(['Weak points', [...ns.weakTimes, ...ns.weakSpots]]);
  if (map.values.intrinsic.length) items.push(['Values', map.values.intrinsic]);
  if (map.strengths.length) items.push(['Strengths', map.strengths.map((s) => s.strength)]);
  if (map.origins.length) items.push(['Then → now', map.origins.map((o) => o.now)]);
  const aiNotes = iv().turns.flatMap((t) => t.mapNotes || []).slice(-4).map((n) => n.note);
  if (aiNotes.length) items.push(['Guide’s notes', aiNotes]);
  const n = items.reduce((a, [, v]) => a + v.length, 0);
  return `<button class="live-toggle" data-act="live" aria-expanded="${liveOpen}">
      ${icon('map')} <span>Your map so far</span> <b>${n} note${n === 1 ? '' : 's'}</b> ${icon('chev', 'chev')}
    </button>
    ${liveOpen ? `<div class="live">${items.length ? items.map(([k, v]) => `<div class="live-row"><span class="k">${k}</span><div>${v.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div></div>`).join('') : '<p class="muted">Notes appear here as you answer.</p>'}
      <p class="fine">Guesses only. The full map — with your core belief — appears at stage 7.</p></div>` : ''}`;
}

function questionCard(cur) {
  const step = cur.step;
  const stageTurns = iv().turns.filter((t) => t.stage === iv().stage);
  const intro = cur.first && !stageTurns.length && cur.stage.intro ? `<p class="intro">${esc(cur.stage.intro)}</p>` : '';
  return `${intro}
  <div class="q-card ${busy ? 'busy' : ''}">
    <p class="guide-q big">${cur.ai ? `<span class="badge">${icon('spark')} follow-up</span> ` : ''}${esc(step.q)}</p>
    ${step.hint ? `<p class="hint">${esc(step.hint)}</p>` : step.multi ? '<p class="hint">Pick all that fit — or type.</p>' : ''}
    <div class="chips" data-group data-multi="${step.multi !== false}">
      ${step.options.map((o) => `<button class="chip" data-act="chip" data-id="${o.id}" aria-pressed="${draft.ids.includes(o.id)}">${esc(o.label)}</button>`).join('')}
    </div>
    <label class="free"><span class="sr">Your own words</span><textarea id="free" rows="2" placeholder="${esc(step.placeholder || 'Or say it your way…')}" data-input="typed">${esc(draft.text)}</textarea></label>
    <div class="q-actions">
      ${iv().turns.length ? `<button class="btn quiet" data-act="undo">${icon('undo')} Back</button>` : '<span></span>'}
      <div>
        <button class="btn quiet" data-act="skip">Skip</button>
        <button class="btn" data-act="send" ${busy ? 'disabled' : ''}>${busy ? 'Thinking…' : 'Next'} ${busy ? '' : icon('arrow')}</button>
      </div>
    </div>
  </div>`;
}

function crisisCard() {
  return `<div class="card soft center-card">
    <h2 class="display sm">Welcome back.</h2>
    <p>Last time you told me something that sounded really hard. Are you safe right now?</p>
    <div class="row-btns col"><button class="btn" data-act="showHelp">${icon('help')} Show help lines</button>
    <button class="btn ghost" data-act="safeGoOn">I’m safe — continue</button></div>
  </div>`;
}

function ageCard() {
  return `<div class="card soft center-card">
    <h2 class="display sm">This app is for adults (18+).</h2>
    <p>From your answer, it sounds like you may be under 18, so the questions stop here. If something is on your mind, please talk to a parent, a teacher you trust or a school counsellor — or use the Help button.</p>
    <div class="row-btns col"><button class="btn ghost" data-act="ageWipe">${icon('trash')} Delete my answers</button>
    <button class="btn quiet" data-act="ageMistake">I typed that wrong — I’m 18 or older</button></div>
  </div>`;
}

function mapStage() {
  if (mapState !== 'shown' || !state.map) {
    return `<div class="drawing">
      ${contour(Date.now() + '', { w: 400, h: 600, rings: 18, cls: 'contour drawing-contour' })}
      <h2 class="display">Drawing your map…</h2>
      <p class="muted">${aiOn() ? 'The guide is reading all your answers.' : 'Putting your answers together.'}</p>
    </div>`;
  }
  return `<div class="reveal">
    <p class="intro">Here is your map. It’s a draft from your own answers — tap ${icon('edit')} to change anything, or ${icon('redo')} to redo a section.</p>
    ${renderMap(state.map)}
    <button class="btn wide sticky-cta" data-act="toFocus">Choose what to work on first ${icon('arrow')}</button>
  </div>`;
}

function focusStage() {
  const opts = focusOptions(iv().turns);
  const chosen = draft.focus || opts[0].id;
  const belief = draft.belief ?? (state.map?.coreBelief?.replacement || '');
  return `<div class="focus">
    <p class="guide-q big">Which do you want to work on first?</p>
    <p class="hint">You can change this later. One thing at a time works best.</p>
    <div class="focus-list" role="radiogroup">
      ${opts.map((o) => `<button class="focus-opt" role="radio" data-act="pickFocus" data-id="${o.id}" aria-checked="${o.id === chosen}">
        <b>${esc(o.title)}</b><span>${esc(o.body)}</span>${o.relevant ? '<em>fits your map</em>' : ''}</button>`).join('')}
    </div>
    <label class="field"><span>Your new belief to practise daily</span><textarea id="belief" rows="2" data-input="belief">${esc(belief)}</textarea></label>
    <button class="btn wide" data-act="finish">Start my plan ${icon('arrow')}</button>
  </div>`;
}

function render() {
  const cur = current(iv());
  let body = '';
  if (cur.kind === 'question') body = `${trail()}${liveBlock()}<div class="feed">${feed()}</div>${questionCard(cur)}`;
  else if (cur.kind === 'crisis') body = `${trail()}${crisisCard()}`;
  else if (cur.kind === 'age') body = ageCard();
  else if (cur.kind === 'map') body = `${trail()}${mapStage()}`;
  else if (cur.kind === 'focus') body = `${trail()}${focusStage()}`;
  return `<div class="iv" data-kind="${cur.kind}">${top(cur)}${body}</div>`;
}

function mount(el) {
  const cur = current(iv());
  if (cur.kind === 'question') {
    const q = el.querySelector('.q-card');
    // keep the newest exchange and the question in view
    requestAnimationFrame(() => {
      const lastEx = el.querySelectorAll('.ex');
      const target = lastEx.length ? lastEx[lastEx.length - 1] : q;
      el.scrollTop = Math.max(0, target.offsetTop - 70);
    });
  }
  // deferred: on first open the layer object does not exist yet
  if (cur.kind === 'map' && mapState === 'idle') { mapState = 'drawing'; setTimeout(drawMap); }
}

async function drawMap() {
  const fresh = state.map && state.map.generatedAt >= (iv().turns.at(-1)?.at || 0);
  if (fresh) { mapState = 'shown'; layer?.refresh(); return; }
  const started = Date.now();
  const map = await generateMap();
  // let the drawing animation breathe for a moment
  await new Promise((r) => setTimeout(r, Math.max(0, 1800 - (Date.now() - started))));
  update((s) => { s.map = map; });
  mapState = 'shown';
  haptic(20);
  layer?.refresh();
  if (layer) layer.el.scrollTop = 0;
}

// ---------- actions ----------

function readDraft() {
  if (!layer) return;
  const root = layer.el;
  const ids = pressedIds(root.querySelector('.chips') || root);
  const text = root.querySelector('#free')?.value || '';
  draft = { ...draft, ids, text };
}

async function submit(skipped) {
  if (busy) return;
  readDraft();
  const cur = current(iv());
  if (cur.kind !== 'question') return;
  if (!skipped && !draft.ids.length && !draft.text.trim()) { toast('Tap an answer, type a few words, or Skip.'); return; }
  let res;
  update((s) => { res = answer(s.interview, cur.step, { selectedIds: skipped ? [] : draft.ids, freeText: skipped ? '' : draft.text, skipped }); });
  draft = { ids: [], text: '' };

  if (res.flag === 'crisis') {
    layer.refresh();
    await flush();
    openCrisis({ fromAnswer: true, onSafe: safeGoOn });
    return;
  }
  if (res.flag === 'age') { layer.refresh(); return; }

  if (aiOn() && !res.turn.skipped) {
    busy = true;
    layer.refresh();
    try {
      const ai = await aiTurn(iv(), liveMap().map);
      if (ai.safetyFlag) {
        update((s) => { const t = s.interview.turns.at(-1); t.flagged = 'crisis'; t.reflection = ai.reflection; s.interview.flag = 'crisis'; });
        busy = false;
        layer.refresh();
        openCrisis({ fromAnswer: true, onSafe: safeGoOn });
        return;
      }
      if (ai.ageFlag) {
        update((s) => { s.interview.flag = 'age'; s.interview.turns.at(-1).flagged = 'age'; });
        busy = false;
        layer.refresh();
        return;
      }
      update((s) => applyAiReflection(s.interview, ai));
    } catch (e) {
      // offline or server down: the on-phone reflection is already there
    }
    busy = false;
  }
  update((s) => advance(s.interview));
  haptic();
  layer.refresh();
}

function safeGoOn() {
  update((s) => resumeAfterCrisis(s.interview));
  layer?.refresh();
}

const actions = {
  chip: (el) => { toggleChip(el); readDraft(); },
  typed: () => { draft.text = layer.el.querySelector('#free').value; },
  send: () => submit(false),
  skip: () => submit(true),
  undo: () => {
    if (busy) return;
    const last = iv().turns.at(-1);
    update((s) => undo(s.interview));
    draft = { ids: last?.selectedIds || [], text: last?.freeText || '' };
    if (last?.stepId.startsWith('ai-')) draft.ids = (last.selected || []).map((l) => 'o' + last.options.indexOf(l));
    layer.refresh();
  },
  live: () => {
    liveOpen = !liveOpen;
    readDraft();
    layer.refresh();
    if (liveOpen) layer.el.querySelector('.live-toggle')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  pause: async () => {
    readDraft();
    await flush();
    layer.close();
    if (!iv().done) toast('Saved. Continue any time from Today.');
  },
  showHelp: () => openCrisis({ fromAnswer: true, onSafe: safeGoOn }),
  safeGoOn,
  ageWipe: async () => {
    if (!confirm('Delete all your answers from this phone?')) return;
    await wipeAll();
    location.reload();
  },
  ageMistake: () => {
    if (!confirm('This app is only for adults. Please confirm you are 18 or older.')) return;
    update((s) => undo(s.interview));
    layer.refresh();
  },
  editSec: (el) => editSection(el.dataset.sec, () => layer?.refresh()),
  redoSec: (el) => redoSection(el.dataset.sec, () => layer?.refresh()),
  toFocus: () => { update((s) => advance(s.interview)); draft = { ids: [], text: '' }; layer.refresh(); layer.el.scrollTop = 0; },
  pickFocus: (el) => { draft.belief = layer.el.querySelector('#belief')?.value ?? draft.belief; draft.focus = el.dataset.id; layer.refresh(); },
  belief: () => { draft.belief = layer.el.querySelector('#belief').value; },
  finish: () => {
    const focus = draft.focus || focusOptions(iv().turns)[0].id;
    const belief = (layer.el.querySelector('#belief')?.value || '').trim();
    update((s) => {
      s.plan.focus = focus;
      s.plan.newBelief = belief || s.map?.coreBelief?.replacement || '';
      s.plan.urge = urgePlanFromMap(s);
      s.interview.focus = focus;
      s.interview.done = true;
      s.interview.stage = 8;
    });
    flush();
    layer.close();
    go('today');
    toast('Your plan is ready.');
  },
};

/** Pre-fill the urge plan from the map; the user can change it in Tools. */
function urgePlanFromMap(s) {
  const an = analyse(s.interview.turns);
  const has = (id) => an.sig.has(id);
  const body = s.map?.nervousSystem?.bodySignal;
  let firstStep = '';
  let firstStepRule = 'Stop at the first small step and do one thing from my next-task list.';
  if (has('step.app')) { firstStep = 'Opening an app “just for a small look”'; firstStepRule = 'When I’m blocked or waiting, I open my next-task list instead of the app.'; }
  else if (has('step.bed')) { firstStep = 'Lying in bed with my phone'; firstStepRule = 'My phone charges outside the bedroom.'; }
  else if (has('step.browse')) firstStep = 'Browsing with no plan';
  else if (has('step.isolate')) { firstStep = 'Staying alone in my room'; firstStepRule = 'When I notice it, I go where people are, or step outside for 10 minutes.'; }
  else if (has('step.justOnce')) { firstStep = 'Telling myself “just once”'; firstStepRule = '“Just once” is my signal to start the urge timer.'; }
  return {
    bodySignal: body && body !== 'not clear yet' ? `A feeling in my ${body}` : '',
    bodyRule: 'Stand up, breathe out slowly, and start the 20-minute timer.',
    firstStep,
    firstStepRule,
  };
}
