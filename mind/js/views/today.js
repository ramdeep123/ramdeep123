// Today: the daily home. Before the map exists it invites you to continue
// the interview; after, it shows the belief, the month, the urge button,
// your focus tools and — in the evening — night mode.

import { state, update } from '../store.js';
import { icon, toast, haptic } from '../ui.js';
import { esc, dayKey, monthKey, monthName, DAY } from '../engine/util.js';
import { setDay, dayState, monthStats, nightsThisMonth } from '../engine/tracking.js';
import { progress } from '../engine/interview.js';
import { FOCUSES, stageByN } from '../engine/content.js';
import { header, todayEyebrow, hooks, mapSeed } from '../core.js';
import { contour } from '../art.js';
import { TOOLS, openUrge, openSlip, openDays, openAttention, openBelief, openTasks } from './tools.js';

/** Night belongs to the evening it started on (2 am counts for yesterday). */
const nightKey = (ts = Date.now()) => dayKey(ts - 5 * 3600000);

function startCard() {
  const iv = state.interview;
  const p = progress(iv);
  const started = iv.turns.length > 0;
  const stage = stageByN(iv.stage);
  return `<section class="hero-card">
    ${contour(mapSeed(), { w: 400, h: 330, rings: 14, cls: 'contour hero-contour' })}
    <div class="hero-in">
      <span class="eyebrow">${started ? `Stage ${iv.stage} of 8 · ${esc(stage?.title || '')}` : 'Your first step'}</span>
      <h2 class="display">${started ? `Your map is ${Math.round(p.pct * 100)}% drawn.` : 'Let’s draw your map.'}</h2>
      <p>${started ? 'Pick up exactly where you stopped.' : 'Short questions about real moments. About 20 minutes — stop any time.'}</p>
      <div class="meter"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
      <button class="btn" data-act="interview">${started ? 'Continue' : 'Start'} ${icon('arrow')}</button>
    </div>
  </section>`;
}

function beliefCard() {
  if (!state.plan.newBelief) return '';
  const r = state.tracking.beliefRatings.find((x) => x.date === dayKey());
  return `<section class="card belief-card" data-act="tool" data-tool="belief">
    <span class="eyebrow">${icon('seed')} Your new belief</span>
    <blockquote class="belief">“${esc(state.plan.newBelief)}”</blockquote>
    <p class="muted">${r ? `Today it feels ${r.v}% true.` : 'How true does it feel today? Tap to rate.'}</p>
  </section>`;
}

function dayCard() {
  const today = dayKey();
  const st = monthStats(state.tracking.days, monthKey());
  const s = dayState(state.tracking.days, today);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(Date.now() - i * DAY);
    week.push(`<i class="${dayState(state.tracking.days, k)} ${i === 0 ? 'today' : ''}" title="${k}"></i>`);
  }
  return `<section class="card day-card">
    <div class="row-between">
      <div><span class="eyebrow">${monthName(monthKey())}</span><p class="big-stat">${esc(st.label)}</p></div>
      <button class="week" data-act="tool" data-tool="days" aria-label="Open calendar">${week.join('')}</button>
    </div>
    ${s === 'none' ? `<p class="q">How was today?</p>
      <div class="row-btns"><button class="btn ghost" data-act="dayClean">${icon('check')} Clean day</button><button class="btn quiet" data-act="daySlip">I slipped</button></div>`
      : s === 'clean' ? `<p class="ok">${icon('check')} Today is marked clean. <button class="link-btn" data-act="dayUndo">Change</button></p>`
        : `<p class="muted">Today is marked as a slip — that’s information, not a verdict. <button class="link-btn" data-act="slip">2-minute review</button></p>`}
  </section>`;
}

function urgeButton() {
  const a = state.tracking.activeUrge;
  if (a) {
    const left = Math.max(0, a.minutes * 60000 - (Date.now() - a.start));
    return `<button class="urge-cta running" data-act="tool" data-tool="urge">${icon('wave')}<span><b>Urge timer running</b>${Math.ceil(left / 60000)} min left — open it</span>${icon('chev')}</button>`;
  }
  return `<button class="urge-cta" data-act="tool" data-tool="urge">${icon('wave')}<span><b>Urge right now?</b>Ride the wave — 20 minutes</span>${icon('chev')}</button>`;
}

function nightCard() {
  const h = new Date().getHours();
  const nh = state.settings.nightHour;
  const evening = h >= Math.max(18, nh - 2) || h < 5;
  if (!evening) return '';
  const done = state.tracking.nights.some((n) => n.date === nightKey());
  const nt = nightsThisMonth(state.tracking.nights.map((n) => ({ date: n.date })), monthKey());
  return `<section class="card night-card">
    <span class="eyebrow">${icon('moon')} Night mode</span>
    ${done ? `<p><b>Phone is out of the bedroom.</b> Sleep well.</p><p class="muted">${esc(nt.label)}</p>`
      : `<p><b>From ${nh}:00, the phone sleeps outside your bedroom.</b> Late nights in bed with the phone are a weak spot for most people.</p>
         <button class="btn ghost" data-act="night">${icon('check')} Done for tonight</button>`}
  </section>`;
}

function focusCard() {
  const f = FOCUSES.find((x) => x.id === state.plan.focus);
  if (!f) return '';
  const tools = TOOLS.filter((t) => f.tools.includes(t.id));
  return `<section class="focus-card">
    <div class="row-between"><span class="eyebrow">Your focus</span><button class="link-btn" data-act="go" data-tab="tools">All tools</button></div>
    <h3 class="display sm">${esc(f.title)}</h3>
    <div class="tool-row">${tools.map((t) => `<button class="tool-chip" data-act="tool" data-tool="${t.id}">${icon(t.icon)}<span>${esc(t.title)}</span></button>`).join('')}</div>
  </section>`;
}

function attentionCard() {
  if (state.plan.focus !== 'social') return '';
  const done = state.tracking.disagreements.some((d) => d.date === dayKey());
  return `<section class="card" data-act="tool" data-tool="attention">
    <span class="eyebrow">${icon('people')} Attention outward</span>
    <p>Put your attention on the other person’s words, not on how you look.</p>
    <p class="muted">${done ? 'Today’s small disagreement: done.' : 'One small, low-risk disagreement today. Tap to log it.'}</p>
  </section>`;
}

function tasksCard() {
  const open = state.tracking.tasks.filter((t) => !t.done).slice(0, 3);
  return `<section class="card">
    <div class="row-between"><span class="eyebrow">${icon('list')} Next tasks</span><button class="link-btn" data-act="tool" data-tool="tasks">${open.length ? 'Open' : 'Add'}</button></div>
    ${open.length ? open.map((t) => `<label class="task"><input type="checkbox" data-change="taskDone" data-id="${t.id}"><span>${esc(t.text)}</span></label>`).join('') : '<p class="muted">For blocked or waiting moments — add 3 small tasks.</p>'}
  </section>`;
}

export function html() {
  const done = state.interview.done;
  return `${header(todayEyebrow(), 'Today')}
  ${done ? `${urgeButton()}${beliefCard()}${dayCard()}${focusCard()}${attentionCard()}${nightCard()}${tasksCard()}
    <button class="map-teaser" data-act="go" data-tab="map">${contour(mapSeed(), { cls: 'contour teaser-contour' })}<span><span class="eyebrow">Your map</span><b>“${esc(state.map?.coreBelief?.belief || '')}”</b></span>${icon('chev')}</button>`
    : `${startCard()}
    <section class="card soft">
      <span class="eyebrow">${icon('shield')} Private by design</span>
      <p>Your answers stay on this phone, encrypted. ${state.settings.ai ? 'The AI guide sees your answers (never your name) only to write reflections.' : 'Nothing leaves your phone.'}</p>
    </section>
    <section class="card soft"><span class="eyebrow">${icon('help')} Need help now?</span><p>The Help button at the top of every screen shows free crisis lines.</p></section>`}`;
}

const OPEN = { urge: openUrge, days: openDays, attention: openAttention, belief: openBelief, tasks: openTasks, slip: () => openSlip() };

export const actions = {
  interview: () => hooks.interview(),
  tool: (el) => (OPEN[el.dataset.tool] || TOOLS.find((t) => t.id === el.dataset.tool)?.open)?.(),
  dayClean: () => { update((s) => { s.tracking.days = setDay(s.tracking.days, dayKey(), true); }); haptic(20); toast('Logged. One more clean day this month.'); hooks.refresh(); },
  daySlip: () => { update((s) => { s.tracking.days = setDay(s.tracking.days, dayKey(), false); }); hooks.refresh(); openSlip({ note: 'A slip is information, not a verdict. Three questions, then let it go.' }); },
  dayUndo: () => { update((s) => { s.tracking.days = setDay(s.tracking.days, dayKey(), null); }); hooks.refresh(); },
  slip: () => openSlip(),
  night: () => { update((s) => { s.tracking.nights = [...s.tracking.nights.filter((n) => n.date !== nightKey()), { date: nightKey() }]; }); haptic(20); toast('Good night.'); hooks.refresh(); },
  taskDone: (el) => { update((s) => { const t = s.tracking.tasks.find((x) => x.id === el.dataset.id); if (t) { t.done = el.checked; t.doneAt = Date.now(); } }); setTimeout(hooks.refresh, 300); },
};
