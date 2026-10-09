// Change tools (handoff §5). Each tool is a full-screen layer.
// Tone: learning, not punishment. No streaks that reset, no shame.

import { state, update, flush } from '../store.js';
import { openLayer, icon, toast, haptic, $ } from '../ui.js';
import { esc, dayKey, monthKey, monthName, uid, fmtDate, keyToTs, quote } from '../engine/util.js';
import { setDay, dayState, monthStats, monthOffset, slipPatterns, urgeStats, beliefTrend, fearStats } from '../engine/tracking.js';
import { BELIEFS } from '../engine/beliefs.js';
import { analyse } from '../engine/analyse.js';
import { urgeWave, spark } from '../art.js';
import { refresh } from '../core.js';

const top = (title, eyebrow) => `<div class="tool-top">
  <button class="icon-btn" data-act="close" aria-label="Close">${icon('back')}</button>
  <div class="iv-title"><span class="eyebrow">${eyebrow}</span><b>${title}</b></div>
  <button class="help-btn" data-act="help" aria-label="Get help now">${icon('help')}<span>Help</span></button>
</div>`;

const slider = (id, value, { min = 0, max = 10, label = '', act = 'noop' } = {}) => `
  <label class="slider"><span>${label}</span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${value}" data-input="${act}">
    <output for="${id}">${value}</output>
  </label>`;

function syncOutputs(root) {
  root.querySelectorAll('.slider input').forEach((i) => { i.nextElementSibling.textContent = i.value; });
}

const val = (root, id) => root.querySelector('#' + id)?.value?.trim() || '';
const num = (root, id) => Number(root.querySelector('#' + id)?.value);

function tool(title, eyebrow, body, actions = {}, mount) {
  return openLayer({
    kind: 'stage',
    label: title,
    render: (layer) => `<div class="tool">${top(title, eyebrow)}${body(layer)}</div>`,
    actions: { noop: (el) => syncOutputs(el.closest('.tool')), ...actions },
    mount,
    onClose: () => { flush(); refresh(); },
  });
}

// ---------------------------------------------------------------- urge

let tick = 0;

function keepAwake(on) {
  try { window.MindNative?.keepAwake?.(on); } catch (e) { /* web */ }
}

const PHASES = [
  [0.15, 'Notice it. Name it out loud: “an urge, in my body.” You don’t have to do anything with it.'],
  [0.35, 'It’s rising. That’s what urges do. Breathe out slowly, longer than you breathe in.'],
  [0.6, 'Around the peak now. Peaks pass. Stand up, change rooms, drink a glass of water.'],
  [1.01, 'It’s falling. Every minute you wait teaches your brain: this passes on its own.'],
];

export function openUrge() {
  let tab = 'wave';
  const plan = () => state.plan.urge || {};

  function waveBody() {
    const a = state.tracking.activeUrge;
    const tasks = state.tracking.tasks.filter((t) => !t.done).slice(0, 3);
    const stats = urgeStats(state.tracking.urges);
    if (!a) {
      return `<div class="urge-start">
        ${urgeWave(0, [])}
        <h2 class="display">Ride the wave.</h2>
        <p class="lead">An urge rises, peaks and falls — usually within 20 to 30 minutes — even if you don’t feed it. Start the timer and watch it pass.</p>
        <div class="seg" role="radiogroup" aria-label="Minutes">${[20, 25, 30].map((m) => `<button data-act="mins" data-m="${m}" aria-pressed="${state.settings.urgeMinutes === m}">${m} min</button>`).join('')}</div>
        <button class="btn wide big" data-act="startUrge">${icon('play')} Start ${state.settings.urgeMinutes}-minute timer</button>
        ${stats.line ? `<p class="evidence">${icon('wave')} ${esc(stats.line)} ${stats.passed ? `${stats.passed} urge${stats.passed === 1 ? '' : 's'} passed without feeding them.` : ''}</p>` : ''}
      </div>`;
    }
    const total = a.minutes * 60000;
    const el = Math.min(total, Date.now() - a.start);
    const p = el / total;
    const left = Math.max(0, total - el);
    const phase = PHASES.find(([x]) => p < x)[1];
    return `<div class="urge-run">
      <div class="wave-box">${urgeWave(p, a.ratings.map((r) => ({ t: r.t / total, v: r.v })))}</div>
      <div class="clock" aria-live="off">${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}</div>
      <p class="phase">${phase}</p>
      ${slider('rate', a.ratings.at(-1)?.v ?? 6, { label: 'How strong is it now? (0–10)' })}
      <button class="btn ghost" data-act="rate">Log this</button>
      ${plan().bodyRule || plan().firstStepRule ? `<div class="card soft plan-mini"><b>Your plan</b>${plan().bodyRule ? `<p>${esc(plan().bodyRule)}</p>` : ''}${plan().firstStepRule ? `<p>${esc(plan().firstStepRule)}</p>` : ''}</div>` : ''}
      ${tasks.length ? `<div class="card soft"><b>While it passes, do one:</b>${tasks.map((t) => `<label class="task"><input type="checkbox" data-change="taskDone" data-id="${t.id}"><span>${esc(t.text)}</span></label>`).join('')}</div>` : ''}
      <div class="row-btns">
        <button class="btn" data-act="endUrge" data-o="passed">${icon('check')} It passed</button>
        <button class="btn ghost" data-act="endUrge" data-o="acted">I acted on it</button>
      </div>
    </div>`;
  }

  function planBody() {
    const u = plan();
    return `<div class="form">
      <p class="lead">Catch the loop at its earliest, easiest point.</p>
      <label class="field"><span>My earliest body signal</span><textarea id="bodySignal" rows="2" placeholder="e.g. a pull in my stomach and chest">${esc(u.bodySignal)}</textarea></label>
      <label class="field"><span>When I feel it, I will…</span><textarea id="bodyRule" rows="2">${esc(u.bodyRule)}</textarea></label>
      <label class="field"><span>My usual first small step</span><textarea id="firstStep" rows="2" placeholder="e.g. opening Instagram “for a small look”">${esc(u.firstStep)}</textarea></label>
      <label class="field"><span>My rule for that step</span><textarea id="firstStepRule" rows="2">${esc(u.firstStepRule)}</textarea></label>
      <button class="btn wide" data-act="savePlan">Save my urge plan</button>
    </div>`;
  }

  const layer = tool('Urge', 'Urge plan & timer', () => `
    <div class="seg tabs" role="tablist">
      <button data-act="tab" data-t="wave" aria-pressed="${tab === 'wave'}">${icon('wave')} Timer</button>
      <button data-act="tab" data-t="plan" aria-pressed="${tab === 'plan'}">${icon('note')} My plan</button>
    </div>
    ${tab === 'wave' ? waveBody() : planBody()}`, {
    tab: (el, ev, l) => { tab = el.dataset.t; l.refresh(); },
    mins: (el, ev, l) => { update((s) => { s.settings.urgeMinutes = Number(el.dataset.m); }); l.refresh(); },
    startUrge: (el, ev, l) => {
      update((s) => { s.tracking.activeUrge = { id: uid(), start: Date.now(), minutes: s.settings.urgeMinutes, ratings: [] }; });
      keepAwake(true);
      haptic(20);
      l.refresh();
    },
    rate: (el, ev, l) => {
      const v = num(l.el, 'rate');
      update((s) => { const a = s.tracking.activeUrge; if (a) a.ratings.push({ t: Date.now() - a.start, v }); });
      toast(`Logged: ${v}/10`);
      l.refresh();
    },
    taskDone: (el) => { update((s) => { const t = s.tracking.tasks.find((x) => x.id === el.dataset.id); if (t) { t.done = el.checked; t.doneAt = Date.now(); } }); },
    endUrge: (el, ev, l) => {
      const outcome = el.dataset.o;
      update((s) => {
        const a = s.tracking.activeUrge;
        if (!a) return;
        s.tracking.urges.push({ ...a, end: Date.now(), outcome });
        s.tracking.activeUrge = null;
      });
      keepAwake(false);
      if (outcome === 'passed') {
        haptic(30);
        toast('It passed. That’s evidence.');
        l.refresh();
      } else {
        l.close();
        openSlip({ note: 'That’s data, not failure. Two minutes turns it into learning.' });
      }
    },
    savePlan: (el, ev, l) => {
      update((s) => { s.plan.urge = { bodySignal: val(l.el, 'bodySignal'), bodyRule: val(l.el, 'bodyRule'), firstStep: val(l.el, 'firstStep'), firstStepRule: val(l.el, 'firstStepRule') }; });
      toast('Urge plan saved.');
      tab = 'wave';
      l.refresh();
    },
  }, (root, l) => {
    clearInterval(tick);
    if (!state.tracking.activeUrge) return;
    tick = setInterval(() => {
      const a = state.tracking.activeUrge;
      if (!a || !l.el?.isConnected) { clearInterval(tick); return; }
      const total = a.minutes * 60000;
      const elapsed = Date.now() - a.start;
      if (elapsed >= total) {
        clearInterval(tick);
        haptic(60);
        toast('Time’s up. How is it now?');
      }
      const left = Math.max(0, total - elapsed);
      const c = root.querySelector('.clock');
      if (c) c.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
      const p = Math.min(1, elapsed / total);
      const w = root.querySelector('.wave-box');
      if (w) w.innerHTML = urgeWave(p, a.ratings.map((r) => ({ t: r.t / total, v: r.v })));
      const ph = root.querySelector('.phase');
      if (ph) ph.textContent = PHASES.find(([x]) => p < x)[1];
    }, 1000);
  });
  return layer;
}

// ---------------------------------------------------------------- slip review

export function openSlip({ date = dayKey(), note = '' } = {}) {
  const map = state.map;
  const triggerIdeas = ['Blocked on a task', 'Waiting', 'Bored', 'Lonely', 'Stressed', 'Tired', 'Late night, alone'];
  const stepIdeas = ['Opened an app “for a small look”', 'Phone in bed', 'Skipped the gym', 'Stayed in my room', 'Told myself “just once”'];
  const chip = (target, t) => `<button class="chip sm" data-act="fill" data-target="${target}" data-v="${esc(t)}">${esc(t)}</button>`;
  return tool('Slip review', '2 minutes · learning, not punishment', (layer) => {
    const pats = slipPatterns(state.tracking.slipReviews);
    const past = [...state.tracking.slipReviews].reverse().slice(0, 5);
    return `<div class="form">
      <p class="lead">${esc(note || 'A slip is information. Three questions, then you’re done.')}</p>
      <label class="field"><span>1 · What was the trigger? <em>What was going on before?</em></span><textarea id="trigger" rows="2">${esc(layer._d?.trigger || '')}</textarea></label>
      <div class="chips wrap">${triggerIdeas.map((t) => chip('trigger', t)).join('')}</div>
      <label class="field"><span>2 · What was the first small step? <em>The thing before the thing.</em></span><textarea id="firstStep" rows="2">${esc(layer._d?.firstStep || '')}</textarea></label>
      <div class="chips wrap">${stepIdeas.map((t) => chip('firstStep', t)).join('')}</div>
      <label class="field"><span>3 · What will I change next time? <em>One small, specific thing.</em></span><textarea id="change" rows="2">${esc(layer._d?.change || '')}</textarea></label>
      ${map?.actions?.length ? `<p class="hint">Idea from your map: ${esc(quote(map.actions[0], 120))}</p>` : ''}
      <button class="btn wide" data-act="saveSlip">Save — and let it go</button>
      ${pats.lines.length ? `<div class="card soft"><b>${icon('spark')} What your reviews show</b>${pats.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      ${past.length ? `<h4 class="mini">Past reviews</h4><ul class="history">${past.map((r) => `<li><span class="muted">${esc(fmtDate(keyToTs(r.date)))}</span> <b>${esc(r.trigger || '—')}</b> → ${esc(r.firstStep || '—')}<br><span>Change: ${esc(r.change || '—')}</span></li>`).join('')}</ul>` : ''}
    </div>`;
  }, {
    fill: (el, ev, l) => {
      const t = l.el.querySelector('#' + el.dataset.target);
      t.value = t.value ? `${t.value}, ${el.dataset.v}` : el.dataset.v;
    },
    saveSlip: (el, ev, l) => {
      const r = { date, at: Date.now(), trigger: val(l.el, 'trigger'), firstStep: val(l.el, 'firstStep'), change: val(l.el, 'change') };
      if (!r.trigger && !r.firstStep && !r.change) { toast('Write a few words in any box.'); return; }
      update((s) => {
        s.tracking.slipReviews.push(r);
        if (dayState(s.tracking.days, date) === 'none') s.tracking.days = setDay(s.tracking.days, date, false);
      });
      toast('Saved. Back to your day.');
      l._d = null;
      l.refresh();
    },
  });
}

// ---------------------------------------------------------------- clean days

export function openDays() {
  let mKey = monthKey();
  return tool('Clean days', 'This month, not a streak', () => {
    const st = monthStats(state.tracking.days, mKey);
    const off = monthOffset(mKey);
    return `<div class="days">
      <div class="month-nav">
        <button class="icon-btn" data-act="month" data-d="-1" aria-label="Previous month">${icon('back')}</button>
        <h2 class="display sm">${monthName(mKey)} ${mKey.slice(0, 4)}</h2>
        <button class="icon-btn flip" data-act="month" data-d="1" aria-label="Next month" ${mKey >= monthKey() ? 'disabled' : ''}>${icon('back')}</button>
      </div>
      <p class="big-stat">${esc(st.label)}</p>
      <div class="cal" role="grid">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="cal-h">${d}</span>`).join('')}
        ${'<span></span>'.repeat(off)}
        ${st.grid.map((g) => `<button class="cal-d ${g.state} ${g.today ? 'today' : ''}" data-act="day" data-date="${g.date}" ${g.state === 'future' ? 'disabled' : ''} aria-label="${g.date}: ${g.state === 'none' ? 'not logged' : g.state}">${g.day}</button>`).join('')}
      </div>
      <div class="legend"><span><i class="clean"></i>clean</span><span><i class="slip"></i>slip</span><span><i class="none"></i>not logged</span></div>
      <p class="hint">Tap a day to mark it. A slip never erases your clean days — that’s why there’s no streak here.</p>
    </div>`;
  }, {
    month: (el, ev, l) => {
      const [y, m] = mKey.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
      mKey = monthKey(d.getTime());
      l.refresh();
    },
    day: (el, ev, l) => {
      const date = el.dataset.date;
      const cur = dayState(state.tracking.days, date);
      const next = cur === 'none' ? true : cur === 'clean' ? false : null;
      update((s) => { s.tracking.days = setDay(s.tracking.days, date, next); });
      haptic();
      l.refresh();
      if (next === false) toast('Marked as a slip. A slip review helps — open it from Tools.');
    },
  });
}

// ---------------------------------------------------------------- thought record

export function openThought({ preset = '' } = {}) {
  const an = analyse(state.interview.turns);
  const suggestions = BELIEFS.filter((b) => an.beliefs.has(b.id)).slice(0, 3);
  let hint = BELIEFS.find((b) => b.thought === preset)?.against || '';
  return tool('Thought record', 'Check a thought against the evidence', (layer) => {
    const past = [...state.tracking.thoughtRecords].reverse().slice(0, 5);
    return `<div class="form">
      ${suggestions.length ? `<p class="hint">From your map:</p><div class="chips wrap">${suggestions.map((b) => `<button class="chip sm" data-act="preset" data-t="${esc(b.thought)}">${esc(b.thought)}</button>`).join('')}</div>` : ''}
      <label class="field"><span>The thought</span><textarea id="thought" rows="2" placeholder="e.g. Everyone will laugh if I speak">${esc(layer._preset ?? preset)}</textarea></label>
      ${slider('before', 70, { min: 0, max: 100, label: 'How true does it feel? (0–100)' })}
      <label class="field"><span>Evidence for it</span><textarea id="for" rows="2" placeholder="Facts only — what would a camera see?"></textarea></label>
      <label class="field"><span>Evidence against it</span><textarea id="against" rows="2" placeholder="Times it wasn’t true. What would you tell a friend?"></textarea></label>
      ${hint ? `<p class="evidence">${icon('spark')} ${esc(hint)}</p>` : ''}
      <label class="field"><span>A more balanced thought</span><textarea id="balanced" rows="2" placeholder="Not positive — just fair and true."></textarea></label>
      ${slider('after', 40, { min: 0, max: 100, label: 'How true does the old thought feel now?' })}
      <button class="btn wide" data-act="saveThought">Save</button>
      ${past.length ? `<h4 class="mini">Past records</h4><ul class="history">${past.map((r) => `<li><b>${esc(r.thought)}</b> <span class="muted">${r.before ?? '–'} → ${r.after ?? '–'}</span><br><span>${esc(r.balanced || '')}</span></li>`).join('')}</ul>` : ''}
    </div>`;
  }, {
    preset: (el, ev, l) => { l._preset = el.dataset.t; hint = BELIEFS.find((b) => b.thought === el.dataset.t)?.against || ''; l.refresh(); },
    saveThought: (el, ev, l) => {
      const r = { date: dayKey(), thought: val(l.el, 'thought'), for: val(l.el, 'for'), against: val(l.el, 'against'), balanced: val(l.el, 'balanced'), before: num(l.el, 'before'), after: num(l.el, 'after') };
      if (!r.thought) { toast('Write the thought first.'); return; }
      update((s) => { s.tracking.thoughtRecords.push(r); });
      toast(r.after < r.before ? `From ${r.before} to ${r.after}. That’s the work.` : 'Saved.');
      l._preset = '';
      l.refresh();
    },
  });
}

// ---------------------------------------------------------------- attention practice

export function openAttention() {
  return tool('Attention outward', 'Before people · one small disagreement a day', () => {
    const fs = fearStats(state.tracking.disagreements);
    const today = state.tracking.disagreements.filter((d) => d.date === dayKey()).length;
    const past = [...state.tracking.disagreements].reverse().slice(0, 5);
    return `<div class="form">
      <div class="card prompt">
        <span class="eyebrow">Before you walk in</span>
        <p class="display sm">Put your attention on the other person’s words, not on how you look.</p>
        <ul class="dots"><li>Listen for one detail you can ask about.</li><li>When you catch yourself watching yourself, bring attention back to their face and words.</li><li>Nobody is watching you as closely as you are.</li></ul>
      </div>
      <h4 class="mini">Today’s small disagreement ${today ? `<span class="badge green">${icon('check')} done</span>` : ''}</h4>
      <p class="hint">Low-risk only: a different opinion on food, a film, a small plan. Not a fight.</p>
      <label class="field"><span>What I said</span><textarea id="what" rows="2" placeholder="e.g. I said I liked the other place better"></textarea></label>
      ${slider('fb', 6, { label: 'How scary it felt before (0–10)' })}
      ${slider('fa', 3, { label: 'How it actually went (0–10 discomfort)' })}
      <label class="field"><span>What happened</span><textarea id="outcome" rows="2"></textarea></label>
      <button class="btn wide" data-act="saveDis">Log it</button>
      ${fs.line ? `<p class="evidence">${icon('people')} ${esc(fs.line)}</p>` : ''}
      ${past.length ? `<h4 class="mini">Recent</h4><ul class="history">${past.map((d) => `<li><span class="muted">${esc(fmtDate(keyToTs(d.date)))}</span> ${esc(d.what || '—')} <span class="muted">· ${d.fearBefore} → ${d.fearAfter}</span></li>`).join('')}</ul>` : ''}
    </div>`;
  }, {
    saveDis: (el, ev, l) => {
      const d = { date: dayKey(), what: val(l.el, 'what'), fearBefore: num(l.el, 'fb'), fearAfter: num(l.el, 'fa'), outcome: val(l.el, 'outcome') };
      if (!d.what) { toast('Write what you said.'); return; }
      update((s) => { s.tracking.disagreements.push(d); });
      haptic(20);
      toast('Logged. That took courage.');
      l.refresh();
    },
  });
}

// ---------------------------------------------------------------- next tasks

export function openTasks() {
  return tool('Next tasks', 'For blocked or waiting moments', () => {
    const open = state.tracking.tasks.filter((t) => !t.done);
    const done = state.tracking.tasks.filter((t) => t.done).slice(-5).reverse();
    return `<div class="form">
      <p class="lead">When you’re stuck or waiting, restless energy needs somewhere to go. Keep 3–5 small, ready tasks here.</p>
      <div class="add-row"><input id="newTask" placeholder="e.g. Fix the login button text" maxlength="140" enterkeyhint="done"><button class="btn" data-act="addTask" aria-label="Add">${icon('plus')}</button></div>
      <ul class="tasks">${open.map((t) => `<li><label class="task"><input type="checkbox" data-change="toggleTask" data-id="${t.id}"><span>${esc(t.text)}</span></label><button class="icon-btn sm" data-act="delTask" data-id="${t.id}" aria-label="Delete">${icon('close')}</button></li>`).join('') || '<li class="muted">No tasks yet.</li>'}</ul>
      ${done.length ? `<h4 class="mini">Done</h4><ul class="tasks done">${done.map((t) => `<li><label class="task"><input type="checkbox" checked data-change="toggleTask" data-id="${t.id}"><span>${esc(t.text)}</span></label></li>`).join('')}</ul>` : ''}
    </div>`;
  }, {
    addTask: (el, ev, l) => {
      const text = val(l.el, 'newTask');
      if (!text) return;
      update((s) => { s.tracking.tasks.push({ id: uid(), text, done: false, at: Date.now() }); });
      l.refresh();
      $('#newTask', l.el)?.focus();
    },
    toggleTask: (el, ev, l) => { update((s) => { const t = s.tracking.tasks.find((x) => x.id === el.dataset.id); if (t) { t.done = el.checked; t.doneAt = Date.now(); } }); setTimeout(() => l.refresh(), 250); },
    delTask: (el, ev, l) => { update((s) => { s.tracking.tasks = s.tracking.tasks.filter((x) => x.id !== el.dataset.id); }); l.refresh(); },
  }, (root, l) => {
    root.querySelector('#newTask')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); l.actions.addTask(null, null, l); } });
  });
}

// ---------------------------------------------------------------- new belief

export function openBelief() {
  return tool('New belief', 'Practise it daily', () => {
    const tr = beliefTrend(state.tracking.beliefRatings);
    const todayR = state.tracking.beliefRatings.find((r) => r.date === dayKey());
    return `<div class="form">
      <blockquote class="belief big">“${esc(state.plan.newBelief || 'Write the belief you want to grow.')}”</blockquote>
      ${state.map?.coreBelief?.belief ? `<p class="muted">Instead of: “${esc(state.map.coreBelief.belief)}”</p>` : ''}
      ${slider('bt', todayR?.v ?? 40, { min: 0, max: 100, label: 'How true does it feel today? (0–100)' })}
      <button class="btn wide" data-act="rateBelief">Save today’s rating</button>
      ${tr.series.length >= 2 ? `<div class="card soft"><b>Your ratings</b>${spark(tr.series.map((r) => r.v))}<p class="muted">From ${tr.first} to ${tr.last}.</p></div>` : ''}
      <div class="card soft"><b>Act as if</b><p>What would someone who already believes this do today? Do one small piece of it.</p></div>
      <label class="field"><span>Change the belief</span><textarea id="nb" rows="2">${esc(state.plan.newBelief)}</textarea></label>
      <button class="btn ghost" data-act="saveBelief">Save belief</button>
    </div>`;
  }, {
    rateBelief: (el, ev, l) => {
      const v = num(l.el, 'bt');
      update((s) => { s.tracking.beliefRatings = [...s.tracking.beliefRatings.filter((r) => r.date !== dayKey()), { date: dayKey(), v }]; });
      toast('Saved.');
      l.refresh();
    },
    saveBelief: (el, ev, l) => { update((s) => { s.plan.newBelief = val(l.el, 'nb'); }); toast('Belief updated.'); l.refresh(); },
  });
}

/** The tools hub list (also used on Today). */
export const TOOLS = [
  { id: 'urge', icon: 'wave', title: 'Urge plan & timer', body: 'Your early signals, your rules, and a 20–30 minute wave timer.', open: openUrge },
  { id: 'slip', icon: 'note', title: 'Slip review', body: 'Three questions, two minutes. Learning, not punishment.', open: () => openSlip() },
  { id: 'days', icon: 'today', title: 'Clean days', body: 'This month at a glance. No streak to lose.', open: openDays },
  { id: 'thought', icon: 'eye', title: 'Thought record', body: 'Check a harsh thought against the evidence.', open: () => openThought() },
  { id: 'attention', icon: 'people', title: 'Attention outward', body: 'Before people, plus one small disagreement a day.', open: openAttention },
  { id: 'belief', icon: 'seed', title: 'New belief', body: 'See it daily. Rate how true it feels.', open: openBelief },
  { id: 'tasks', icon: 'list', title: 'Next tasks', body: 'Somewhere for restless energy to go.', open: openTasks },
];
