// You: profile, pass, goals, progress charts, history, settings & data.

import { state, update, reset, replaceAll } from '../store.js';
import { header, profileNow, refresh } from '../core.js';
import { bmi, bmr, GOALS, ACTIVITY } from '../engine/nutrition.js';
import { buildProgram } from '../engine/routine.js';
import { status, PRICING } from '../engine/subscription.js';
import { BY_ID, EXERCISES } from '../engine/exercises.js';
import { DIETS } from '../engine/foods.js';
import { lineChart, barChart } from '../charts.js';
import { esc, fmtDate, fmtNum, ema, keyToTs, startOfWeek, DAY, uid } from '../engine/util.js';
import { setVoiceEnabled } from '../engine/voice.js';
import { icon, openSheet, toast, stepper, nudge, pressed } from '../ui.js';
import { shareText, canRemind, requestNotifications, setReminders, testReminder } from '../native.js';
import { streak, xp, level, badges, DEFAULT_REMINDERS, reminderPlan } from '../engine/engage.js';
import { voicePackSize } from '../engine/voice.js';
import { CONFIG, COPYRIGHT } from '../config.js';

const vol = (w) => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);

function goalLine(g, p) {
  const weekAgo = Date.now() - 7 * DAY;
  if (g.type === 'weight') {
    const total = g.target - g.start;
    const pct = total ? Math.max(0, Math.min(1, (p.weight - g.start) / total)) : 0;
    return { title: `Reach ${g.target} kg`, pct, text: `${p.weight.toFixed(1)} kg now · started at ${g.start} kg` };
  }
  if (g.type === 'workouts') {
    const n = state.workouts.filter((w) => w.at >= startOfWeek() && w.dayName !== 'Coach session').length;
    return { title: `${g.target} workouts a week`, pct: Math.min(1, n / g.target), text: `${n} this week` };
  }
  if (g.type === 'mind') {
    const m = state.meditations.filter((x) => (x.at || 0) >= weekAgo).reduce((a, x) => a + x.minutes, 0);
    return { title: `${g.target} calm minutes a week`, pct: Math.min(1, m / g.target), text: `${m} min in the last 7 days` };
  }
  if (g.type === 'lift') {
    const best = Math.max(0, ...state.workouts.flatMap((w) => w.exercises.filter((e) => e.id === g.ex).flatMap((e) => e.sets.map((s) => s.kg || 0))));
    return { title: `${BY_ID[g.ex]?.name || 'Lift'} · ${g.target} kg`, pct: Math.min(1, best / g.target), text: best ? `Best so far ${best} kg` : 'Not logged yet' };
  }
  return { title: 'Goal', pct: 0, text: '' };
}

export function html() {
  const p = profileNow();
  const s = status(state.sub);
  const b = bmr(p);
  const workouts = [...state.workouts].sort((a, b2) => b2.at - a.at);
  const forms = state.workouts.filter((w) => w.exercises.some((e) => e.sets.some((x) => x.form != null)));
  const passLine = s.state === 'trial' ? `Free trial · ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`
    : s.state === 'expired' ? 'Expired' : `Active until ${fmtDate(state.sub.paidUntil)}`;

  return `${header('Progress · goals · settings', 'You')}
    <section class="card">
      <div class="row">
        <span class="avatar" style="width:54px;height:54px;font-size:24px">${esc(p.name.charAt(0).toUpperCase())}</span>
        <div class="grow"><b class="h3">${esc(p.name)}</b><div class="muted small">${p.age} yrs · ${p.height} cm · ${p.weight.toFixed(1)} kg · BMI ${bmi(p).toFixed(1)}</div></div>
        <button class="btn small ghost" data-act="edit">Edit</button>
      </div>
      <div class="row wrap" style="gap:6px"><span class="tag hot">${esc(GOALS.find((g) => g.id === p.goal).short)}</span><span class="tag">BMR ${fmtNum(b.value)} kcal</span><span class="tag">${esc(DIETS.find((d) => d.id === p.diet)?.label || '')}</span></div>
    </section>

    <button class="card" data-act="pass" style="border:0;text-align:left;width:100%;color:inherit">
      <div class="card-head"><span class="eyebrow">KAYA Pass</span>${icon('chev', 'chev')}</div>
      <div class="row between"><b class="h3">${esc(passLine)}</b><span class="num accent" style="font-size:26px">${PRICING.symbol}${s.state === 'trial' || state.sub.payments.length === 0 ? PRICING.intro.amount : PRICING.regular.amount}<span class="faint" style="font-size:13px">/3 mo</span></span></div>
    </button>

    ${levelCard()}

    <section class="card">
      <div class="card-head"><span class="eyebrow">Goals</span><button class="link small" data-act="addGoal">Add goal</button></div>
      ${state.goals.length ? state.goals.map((g) => {
        const l = goalLine(g, p);
        return `<div class="stack" style="gap:6px"><div class="row between"><b>${esc(l.title)}</b><span class="row" style="gap:8px"><span class="mono small faint">${Math.round(l.pct * 100)}%</span><button class="link small" data-act="rmGoal" data-id="${g.id}" aria-label="Remove goal">${icon('close')}</button></span></div>
          <div class="meter"><i style="width:${l.pct * 100}%"></i></div><span class="muted small">${esc(l.text)}</span></div>`;
      }).join('<div class="divider"></div>') : '<div class="empty">No goals yet. Add one to see your progress here.</div>'}
    </section>

    <section class="card">
      <div class="card-head"><span class="eyebrow">Bodyweight · kg</span><button class="link small" data-act="go" data-tab="fuel">Log weight</button></div>
      ${state.weights.length >= 2 ? '<div id="wChart"></div><div class="legend"><span><i style="background:var(--text-3);border-radius:50%"></i>Weigh-ins</span><span><i style="background:var(--magma);height:2px"></i>Trend</span></div>' : '<div class="empty">Log your weight a few times to see your trend.</div>'}
    </section>

    <section class="card">
      <span class="eyebrow">Training volume · kg per week</span>
      ${state.workouts.length ? '<div id="vChart"></div>' : '<div class="empty">Finish a session to start your volume chart.</div>'}
    </section>

    ${forms.length >= 2 ? '<section class="card"><span class="eyebrow">Average form score per session</span><div id="fChart"></div></section>' : ''}

    <section class="card">
      <span class="eyebrow">History</span>
      ${workouts.length ? `<div class="list">${workouts.slice(0, 8).map((w) => `<div class="li"><span class="grow"><b>${esc(w.dayName)}</b><span>${fmtDate(w.at)} · ${w.exercises.length} moves${w.durationSec ? ` · ${Math.round(w.durationSec / 60)} min` : ''}${vol(w) ? ` · ${fmtNum(vol(w))} kg` : ''}</span></span></div>`).join('')}</div>` : '<div class="empty">Your sessions will appear here.</div>'}
    </section>

    ${remindersCard()}

    <section class="card">
      <span class="eyebrow">Settings</span>
      <div class="row between"><span>Voice coaching</span><button class="chip" data-act="toggle" data-k="voice" aria-pressed="${state.settings.voice !== false}">${state.settings.voice !== false ? 'On' : 'Off'}</button></div>
      <div class="row between"><span>Coach voice</span><span class="faint small">${voicePackSize() ? `KAYA voice pack · ${voicePackSize()} clips` : 'Phone voice'}</span></div>
      <div class="row between"><span>Timer sounds</span><button class="chip" data-act="toggle" data-k="sound" aria-pressed="${state.settings.sound !== false}">${state.settings.sound !== false ? 'On' : 'Off'}</button></div>
      <div class="divider"></div>
      <div class="grid2"><button class="btn small ghost" data-act="backup">${icon('share')} Back up</button><button class="btn small ghost" data-act="restore">Restore</button></div>
      <button class="btn small danger" data-act="wipe">Reset all data</button>
    </section>
    <section class="stack" style="align-items:center;text-align:center;gap:6px">
      <span class="eyebrow">A ${esc(CONFIG.company)} app</span>
      <span class="faint small">KAYA ${CONFIG.version} · ${esc(COPYRIGHT)}</span>
      <span class="faint small">Your data stays on this phone. KAYA gives general fitness guidance, not medical advice — check with a doctor before starting if you have a health condition.</span>
      <button class="link small" data-act="about">About & licences</button>
    </section>`;
}

export function mount(el) {
  const fmt = (x) => fmtDate(x);
  const w = el.querySelector('#wChart');
  if (w) {
    const pts = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ x: keyToTs(x.date), y: x.kg }));
    const trend = ema(pts.map((x) => x.y), 0.35).map((y, i) => ({ x: pts[i].x, y: Math.round(y * 10) / 10 }));
    lineChart(w, {
      series: [
        { name: 'Weigh-in', color: 'var(--text-3)', dots: true, line: false, points: pts },
        { name: 'Trend', color: 'var(--magma)', points: trend },
      ],
      fmtX: fmt, fmtY: (y, axis) => (axis ? y.toFixed(1) : `${y.toFixed(1)} kg`), yPad: 0.3,
    });
  }
  const v = el.querySelector('#vChart');
  if (v) {
    const ws = startOfWeek();
    const bars = Array.from({ length: 8 }, (_, i) => {
      const start = ws - (7 - i) * 7 * DAY;
      const total = state.workouts.filter((x) => x.at >= start && x.at < start + 7 * DAY).reduce((a, x) => a + vol(x), 0);
      return { label: i === 7 ? 'Now' : fmtDate(start).split(' ')[0], full: `Week of ${fmtDate(start)}`, value: Math.round(total) };
    });
    barChart(v, { bars, color: 'var(--magma)', fmtY: (y, axis) => (axis ? (y >= 1000 ? `${y / 1000}k` : y) : `${fmtNum(y)} kg`) });
  }
  const f = el.querySelector('#fChart');
  if (f) {
    const pts = state.workouts.map((x) => {
      const fs = x.exercises.flatMap((e) => e.sets.map((s) => s.form)).filter((n) => n != null);
      return fs.length ? { x: x.at, y: Math.round(fs.reduce((a, b) => a + b, 0) / fs.length) } : null;
    }).filter(Boolean).sort((a, b) => a.x - b.x);
    lineChart(f, { series: [{ name: 'Form score', color: 'var(--magma)', dots: true, area: true, points: pts }], fmtX: fmt, fmtY: (y) => `${Math.round(y)}`, yPad: 3, height: 150 });
  }
}

function levelCard() {
  const lv = level(xp(state));
  const st = streak(state);
  const bs = badges(state);
  const earned = bs.filter((b) => b.earned).length;
  return `<section class="card">
    <div class="card-head"><span class="eyebrow">Level ${lv.n} · ${esc(lv.name)}</span><span class="faint small mono">${lv.xp} XP</span></div>
    <div class="meter"><i style="width:${Math.round(lv.pct * 100)}%"></i></div>
    <span class="muted small">${lv.next ? `${lv.next - lv.xp} XP to the next level.` : 'Top level reached.'} Streak ${st.current} days · best ${st.best}.</span>
    <div class="card-head"><span class="eyebrow">Badges · ${earned}/${bs.length}</span></div>
    <div class="badges">${bs.map((b) => `<div class="badge ${b.earned ? 'earned' : ''}"><span class="medal">${icon(b.earned ? 'check' : 'lock')}</span><b>${esc(b.title)}</b><span>${esc(b.text)}</span></div>`).join('')}</div>
    <span class="faint small">XP: workout 50 · coached set 15 · breath session 20 · check-in 10 · meal 5 · water 1 · closed day +30.</span>
  </section>`;
}

function remindersCard() {
  const r = { ...DEFAULT_REMINDERS, ...(state.reminders || {}) };
  if (!canRemind()) {
    return `<section class="card"><span class="eyebrow">Daily reminders</span><p class="muted small">Reminders work in the KAYA Android app, even when it\u2019s closed.</p></section>`;
  }
  const row = (k, label) => `<div class="time-row"><label for="rt-${k}">${label}</label><input id="rt-${k}" class="input" type="time" value="${r[k]}" data-change="remTime" data-k="${k}" ${r.enabled ? '' : 'disabled'}></div>`;
  return `<section class="card">
    <div class="card-head"><span class="eyebrow">Daily reminders</span><button class="chip" data-act="remToggle" aria-pressed="${r.enabled}">${r.enabled ? 'On' : 'Off'}</button></div>
    ${row('morning', 'Morning check-in')}
    ${row('training', 'Training or recovery')}
    ${row('evening', 'Close your day')}
    <span class="faint small">At most three a day, and KAYA skips any you\u2019ve already done. Messages change with your streak and plan.</span>
    ${r.enabled ? '<button class="btn small ghost" data-act="remTest">Send a test reminder</button>' : ''}
  </section>`;
}

/** Turn reminders on (asks for notification permission on Android 13+). */
export async function enableReminders() {
  const ok = await requestNotifications();
  update((s) => { s.reminders = { ...DEFAULT_REMINDERS, ...(s.reminders || {}), enabled: true, dismissed: true }; });
  setReminders(reminderPlan(state));
  toast(ok ? 'Daily reminders on' : 'Reminders are on — allow notifications for KAYA in Android settings to see them');
  refresh();
}

function editSheet() {
  const d = { ...state.profile, weight: profileNow().weight };
  const seg = (f, items) => `<div class="seg">${items.map(([v, l]) => `<button data-act="ep" data-f="${f}" data-v="${v}" aria-pressed="${String(d[f]) === String(v)}">${l}</button>`).join('')}</div>`;
  openSheet({
    temp: 'you',
    html: `<span class="eyebrow">Profile</span><h2 class="h2">Edit your details</h2>
      <div class="field"><label for="epName">Name</label><input id="epName" class="input" maxlength="24" value="${esc(d.name)}"></div>
      ${seg('sex', [['male', 'Male'], ['female', 'Female']])}
      <div class="grid2">
        <div class="field"><label for="epAge">Age</label>${stepper('epAge', d.age, { unit: 'years', min: 14, max: 90 })}</div>
        <div class="field"><label for="epH">Height</label>${stepper('epH', d.height, { unit: 'cm', min: 120, max: 230 })}</div>
      </div>
      <div class="field"><label for="epBF">Body fat % (optional, improves BMR)</label>${stepper('epBF', d.bodyFat || 0, { unit: '% · 0 = unknown', min: 0, max: 50 })}</div>
      <div class="field"><label>Goal</label>${seg('goal', GOALS.map((g) => [g.id, g.short]))}</div>
      <div class="field"><label>Lifestyle</label>${seg('activity', ACTIVITY.map((a) => [a.id, a.short]))}</div>
      <div class="field"><label>Food</label>${seg('diet', DIETS.map((x) => [x.id, x.label]))}</div>
      <button class="btn block" data-act="epSave">Save</button>`,
    actions: {
      ep(el) { d[el.dataset.f] = el.dataset.v; pressed(el.parentElement, el); },
      step(el) { nudge(el); },
      epSave() {
        const num = (id) => parseFloat(document.getElementById(id).value);
        d.name = document.getElementById('epName').value.trim() || d.name;
        d.age = num('epAge'); d.height = num('epH');
        const bf = num('epBF');
        d.bodyFat = bf > 3 ? bf : null;
        const goalChanged = d.goal !== state.profile.goal;
        update((s) => {
          s.profile = { ...s.profile, ...d, weight: s.profile.weight };
          if (goalChanged) s.program = buildProgram(s.profile);
        });
        this.close();
        toast(goalChanged ? 'Saved — program rebuilt for your new goal' : 'Profile saved');
        refresh();
      },
    },
  });
}

function goalSheet() {
  const g = { type: 'weight', target: Math.round(profileNow().weight - 3), ex: 'back-squat' };
  const lifts = EXERCISES.filter((e) => e.loadRatio);
  openSheet({
    temp: 'you',
    html: `<span class="eyebrow">New goal</span><h2 class="h2">What are you chasing?</h2>
      <div class="seg">${[['weight', 'Weight'], ['lift', 'Lift'], ['workouts', 'Workouts'], ['mind', 'Calm']].map(([v, l]) => `<button data-act="gt" data-v="${v}" aria-pressed="${g.type === v}">${l}</button>`).join('')}</div>
      <div class="field" id="gLift" hidden><label for="gEx">Exercise</label><select id="gEx" class="input">${lifts.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="gT" id="gLabel">Target weight (kg)</label>${stepper('gT', g.target, { step: 1, min: 1, max: 400 })}</div>
      <button class="btn block" data-act="gSave">Add goal</button>`,
    actions: {
      gt(el) {
        g.type = el.dataset.v;
        pressed(el.parentElement, el);
        document.getElementById('gLift').hidden = g.type !== 'lift';
        const defaults = { weight: [Math.round(profileNow().weight - 3), 'Target weight (kg)'], lift: [60, 'Target load (kg)'], workouts: [state.profile.days, 'Workouts per week'], mind: [30, 'Calm minutes per week'] };
        document.getElementById('gT').value = defaults[g.type][0];
        document.getElementById('gLabel').textContent = defaults[g.type][1];
      },
      step(el) { nudge(el); },
      gSave() {
        const target = parseFloat(document.getElementById('gT').value);
        const goal = { id: uid(), type: g.type, target };
        if (g.type === 'weight') goal.start = profileNow().weight;
        if (g.type === 'lift') goal.ex = document.getElementById('gEx').value;
        update((s) => { s.goals.push(goal); });
        this.close();
        refresh();
      },
    },
  });
}

export const actions = {
  remToggle() {
    if (!state.reminders?.enabled) { enableReminders(); return; }
    update((s) => { s.reminders = { ...s.reminders, enabled: false }; });
    setReminders([]);
    toast('Reminders off');
    refresh();
  },
  remTime(el) {
    update((s) => { s.reminders = { ...DEFAULT_REMINDERS, ...(s.reminders || {}), [el.dataset.k]: el.value }; });
    setReminders(reminderPlan(state));
    toast('Reminder time saved');
  },
  remTest() {
    const next = reminderPlan(state)[0];
    testReminder(next?.title || 'KAYA', next?.body || 'Your coach is ready.');
    toast('Test reminder sent');
  },
  edit: editSheet,
  addGoal: goalSheet,
  rmGoal(el) { update((s) => { s.goals = s.goals.filter((g) => g.id !== el.dataset.id); }); refresh(); },
  pass() { import('./pass.js').then((m) => m.openPass()); },
  toggle(el) {
    const k = el.dataset.k;
    update((s) => { s.settings[k] = s.settings[k] === false; });
    if (k === 'voice') setVoiceEnabled(state.settings.voice !== false);
    refresh();
  },
  async backup() {
    const ok = await shareText('KAYA backup', JSON.stringify(state));
    if (!ok) toast('Sharing isn’t available here');
  },
  restore() {
    openSheet({
      temp: 'you',
      html: `<span class="eyebrow">Restore</span><h2 class="h2">Paste your backup</h2>
        <textarea id="rTxt" class="input" style="min-height:160px;padding:12px;font:400 12px var(--f-mono)" placeholder="Paste the backup text here"></textarea>
        <button class="btn block" data-act="rDo">Restore data</button>`,
      actions: {
        rDo() {
          try {
            const obj = JSON.parse(document.getElementById('rTxt').value);
            if (!obj || !obj.profile) throw new Error('bad');
            replaceAll(obj);
            this.close();
            toast('Data restored');
            refresh();
          } catch (e) { toast('That doesn’t look like a KAYA backup'); }
        },
      },
    });
  },
  about() {
    openSheet({
      temp: 'you',
      html: `<span class="eyebrow">About</span><h2 class="h2">KAYA ${CONFIG.version}</h2>
        <p class="muted">Designed and produced by <b>${esc(CONFIG.company)}</b>. ${esc(COPYRIGHT)} The KAYA name, logo, animated coach, exercise library, plans, written content and voice are proprietary and may not be copied or redistributed without written permission.</p>
        <div class="stack" style="gap:6px">
          <span class="eyebrow">Open-source components</span>
          <span class="muted small">MediaPipe Tasks Vision and Pose Landmarker models (Google) — Apache License 2.0.</span>
          <span class="muted small">Big Shoulders Display, Onest and Martian Mono fonts — SIL Open Font License 1.1.</span>
        </div>
        <button class="btn block" data-act="close">Close</button>`,
    });
  },
  wipe() {
    openSheet({
      temp: 'you',
      html: `<span class="eyebrow">Reset</span><h2 class="h2">Delete everything?</h2>
        <p class="muted">This removes your profile, workouts, weights and sessions from this phone. It can’t be undone. Back up first if you might want them.</p>
        <button class="btn danger block" data-act="wDo">Delete all data</button>
        <button class="btn line block" data-act="close">Keep my data</button>`,
      actions: { wDo() { reset(); location.reload(); } },
    });
  },
};
