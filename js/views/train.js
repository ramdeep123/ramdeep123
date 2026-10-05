// Train: weekly program, exercise library, program builder, guided workout player.

import { state, update } from '../store.js';
import { header, todayInfo, profileNow, refresh, gate } from '../core.js';
import { buildProgram, estimateMinutes, suggestLoad, readinessAdvice } from '../engine/routine.js';
import { EXERCISES, BY_ID, MUSCLE_LABEL } from '../engine/exercises.js';
import { GOALS } from '../engine/nutrition.js';
import { WEEKDAYS, weekday, startOfWeek, dayKey, DAY, esc, fmtNum, fmtDuration, uid } from '../engine/util.js';
import { say, beep, buzz } from '../engine/voice.js';
import { icon, openSheet, openStage, setLayerHTML, ring, toast, pressed } from '../ui.js';
import { paintThumbs, thumb, openExercise, figureStage, mountFigure } from './exercise.js';
import { keepAwake } from '../native.js';

let selected = weekday();
let filter = 'all';

const FILTERS = [
  ['all', 'All'], ['legs', 'Legs'], ['push', 'Push'], ['pull', 'Pull'], ['core', 'Core'], ['cardio', 'Cardio'],
];
const GROUP = { squat: 'legs', lunge: 'legs', hinge: 'legs', calves: 'legs', 'squat-iso': 'legs', pushH: 'push', pushV: 'push', delts: 'push', pullH: 'pull', pullV: 'pull', arms: 'pull', core: 'core', cond: 'cardio' };

const repText = (m) => (m.unit === 'sec' ? `${m.sets} × ${m.reps[0]} s` : `${m.sets} × ${m.reps[0]}–${m.reps[1]}`);

function weekStrip() {
  const ws = startOfWeek();
  const todayWd = weekday();
  return `<div class="week" role="group" aria-label="This week">${state.program.week.map((d, i) => {
    const key = dayKey(ws + i * DAY);
    const done = state.workouts.some((w) => w.date === key);
    return `<button class="wd ${d.rest ? '' : 'train'} ${done ? 'done' : ''} ${i === todayWd ? 'today' : ''}" data-act="pickDay" data-d="${i}" aria-pressed="${i === selected}">
      ${WEEKDAYS[i].slice(0, 3)}<b>${new Date(ws + i * DAY).getDate()}</b><i></i></button>`;
  }).join('')}</div>`;
}

export function html() {
  const prog = state.program;
  const day = prog.week[selected];
  const p = profileNow();
  const goal = GOALS.find((g) => g.id === p.goal);
  const t = todayInfo();
  const adv = readinessAdvice(t.readiness);

  const dayCard = day.rest
    ? `<section class="card"><span class="eyebrow">${WEEKDAYS[selected]} · Recovery</span><h2 class="h2">Rest day</h2>
        <p class="muted">${esc(day.focus)}. Muscles grow between sessions, not during them.</p></section>`
    : `<section class="card">
        <div class="card-head"><span class="eyebrow">${WEEKDAYS[selected]} · ${esc(day.name)}</span><span class="tag hot">~${estimateMinutes(day)} min</span></div>
        <h2 class="h2">${esc(day.focus)}</h2>
        <div class="list">${day.moves.map((m) => {
          const ex = BY_ID[m.id];
          const load = suggestLoad(m.id, p, state.loads);
          return `<button class="li" data-act="ex" data-id="${m.id}">${thumb(m.id)}
            <span class="grow"><b>${esc(ex.name)}${m.finisher ? ' <span class="tag hot">Finisher</span>' : ''}</b>
            <span>${repText(m)} · rest ${m.rest}s${load ? ` · <span class="accent">${load.kg} kg</span>` : ''}</span></span>${icon('chev', 'chev')}</button>`;
        }).join('')}</div>
        ${selected === t.wd && t.readiness != null && t.readiness < 55 ? `<div class="banner">${icon('info')}<span class="grow">${esc(adv.text)}</span></div>` : ''}
        <button class="btn block" data-act="start">${icon('play')} Start ${selected === t.wd ? "today's" : 'this'} session</button>
      </section>`;

  const shown = EXERCISES.filter((e) => filter === 'all' || GROUP[e.pattern] === filter);
  return `${header(`${esc(prog.splitName)} · ${prog.days} days`, 'Train')}
    ${weekStrip()}
    ${dayCard}
    <section class="card">
      <div class="card-head"><span class="eyebrow">Your program</span><button class="link small" data-act="rebuild">Change</button></div>
      <div class="row wrap" style="gap:6px">
        <span class="tag">${esc(goal.short)}</span><span class="tag">${{ beginner: 'New lifter', intermediate: 'Intermediate', advanced: 'Advanced' }[p.level]}</span>
        <span class="tag">${{ gym: 'Gym', 'home-db': 'Home + dumbbells', home: 'Home, no equipment' }[p.place]}</span><span class="tag">${p.minutes} min</span>
      </div>
      <p class="muted small">Progression is automatic: hit the top of your rep range on every set with a form score of 75+ and the next session adds weight. Fall short and it holds or deloads slightly.</p>
    </section>
    <section class="stack">
      <div class="row between"><h2 class="h2">Library</h2><span class="faint small mono">${shown.length} moves</span></div>
      <div class="chips">${FILTERS.map(([id, l]) => `<button class="chip" data-act="filter" data-f="${id}" aria-pressed="${filter === id}">${l}</button>`).join('')}</div>
      <div class="card" style="padding:4px 16px"><div class="list">${shown.map((e) => `<button class="li" data-act="ex" data-id="${e.id}">${thumb(e.id)}
        <span class="grow"><b>${esc(e.name)}</b><span>${e.muscles.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}${e.track ? ' · camera ready' : ''}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></div>
    </section>`;
}

export function mount(el) { paintThumbs(el); }

export const actions = {
  pickDay(el) { selected = Number(el.dataset.d); refresh(); },
  filter(el) { filter = el.dataset.f; refresh(); },
  ex(el) { openExercise(el.dataset.id); },
  start() { gate('plan', () => startWorkout(selected)); },
  rebuild: programSheet,
};

// ---------------- program builder ----------------
function programSheet() {
  const d = { ...state.profile, injuries: [...(state.profile.injuries || [])] };
  const tile = (f, v, l, s) => `<button class="tile" data-act="pp" data-f="${f}" data-v="${v}" aria-pressed="${String(d[f]) === String(v)}"><b>${l}</b>${s ? `<span>${s}</span>` : ''}</button>`;
  const segb = (f, items) => `<div class="seg">${items.map(([v, l]) => `<button data-act="pp" data-f="${f}" data-v="${v}" aria-pressed="${String(d[f]) === String(v)}">${l}</button>`).join('')}</div>`;
  openSheet({
    temp: 'train',
    html: `<span class="eyebrow">Program builder</span><h2 class="h2">Shape your week</h2>
      <div class="field"><label>Goal</label><div class="tiles">${GOALS.map((g) => tile('goal', g.id, g.label)).join('')}</div></div>
      <div class="field"><label>Experience</label>${segb('level', [['beginner', 'New'], ['intermediate', '1–3 yrs'], ['advanced', '3+ yrs']])}</div>
      <div class="field"><label>Days per week</label><div class="chips">${[2, 3, 4, 5, 6].map((n) => `<button class="chip" data-act="pp" data-f="days" data-v="${n}" aria-pressed="${d.days === n}">${n} days</button>`).join('')}</div></div>
      <div class="field"><label>Where</label>${segb('place', [['gym', 'Gym'], ['home-db', 'Home + DB'], ['home', 'No equipment']])}</div>
      <div class="field"><label>Session length</label>${segb('minutes', [[30, '30 min'], [45, '45 min'], [60, '60 min']])}</div>
      <div class="field"><label>Protect</label><div class="chips">${[['knees', 'Knees'], ['back', 'Lower back'], ['shoulders', 'Shoulders']].map(([v, l]) => `<button class="chip" data-act="ppInj" data-v="${v}" aria-pressed="${d.injuries.includes(v)}">${l}</button>`).join('')}</div></div>
      <button class="btn block" data-act="ppSave">Rebuild my program</button>`,
    actions: {
      pp(el) {
        let v = el.dataset.v;
        if (['days', 'minutes'].includes(el.dataset.f)) v = Number(v);
        d[el.dataset.f] = v;
        pressed(el.parentElement, el);
      },
      ppInj(el) {
        const v = el.dataset.v;
        d.injuries = d.injuries.includes(v) ? d.injuries.filter((x) => x !== v) : [...d.injuries, v];
        el.setAttribute('aria-pressed', String(d.injuries.includes(v)));
      },
      ppSave() {
        update((s) => { s.profile = { ...s.profile, ...d }; s.program = buildProgram(s.profile); });
        this.close();
        toast('Program rebuilt');
        refresh();
      },
    },
  });
}

// ---------------- workout player ----------------
export function startWorkout(wd) {
  const day = state.program.week[wd];
  if (!day || day.rest) { toast('That’s a rest day'); return; }
  const t = todayInfo();
  const cut = t.readiness != null && t.readiness < 55;
  const p = profileNow();
  const moves = day.moves.map((m) => ({ ...m, sets: cut ? Math.max(2, m.sets - 1) : m.sets }));
  const S = {
    day, moves, i: 0, start: Date.now(), cut, phase: 'work', restEnd: 0, restTotal: 0, nextLabel: '',
    loads: moves.map((m) => suggestLoad(m.id, p, state.loads)),
  };
  S.logs = moves.map((m, k) => Array.from({ length: m.sets }, () => ({ reps: m.reps[0], kg: S.loads[k]?.kg ?? 0, done: false, form: null })));
  let fv = null;
  let tick = 0;
  let layer = null;

  const clock = () => fmtDuration((Date.now() - S.start) / 1000);

  function draw() {
    fv?.stop();
    fv = null;
    setLayerHTML(layer, view());
    if (S.phase === 'work') fv = mountFigure(layer.el, BY_ID[S.moves[S.i].id]);
  }

  function view() {
    const bar = `<div class="stage-bar">
        <button class="icon-btn" data-act="quit" aria-label="End workout">${icon('close')}</button>
        <span class="eyebrow">${esc(day.name)} · <span id="wClock" class="tabnum">${clock()}</span></span>
        <button class="icon-btn" data-act="skipMove" aria-label="Next exercise" ${S.phase !== 'work' ? 'hidden' : ''}>${icon('chev')}</button>
      </div>
      <div class="prog">${S.moves.map((_, k) => `<i class="${k < S.i || S.phase === 'summary' ? 'done' : k === S.i ? 'now' : ''}"></i>`).join('')}</div>`;

    if (S.phase === 'rest') {
      const left = Math.max(0, Math.ceil((S.restEnd - Date.now()) / 1000));
      return `${bar}<div class="rest-wrap">
        <span class="eyebrow">Rest</span>
        <div id="restRing">${ring(left / S.restTotal, { size: 220, stroke: 12, inner: `<span class="num" style="font-size:72px" id="restLeft">${left}</span><span class="faint">seconds</span>` })}</div>
        <p class="muted" style="text-align:center">${esc(S.nextLabel)}</p>
        <div class="grid2" style="width:100%"><button class="btn ghost" data-act="plus15">+15 s</button><button class="btn" data-act="endRest">Skip rest</button></div>
        <p class="faint small" style="text-align:center">Breathe out slowly through the mouth to bring your heart rate down faster.</p>
      </div>`;
    }

    if (S.phase === 'summary') {
      const doneSets = S.logs.flat().filter((s) => s.done);
      const vol = doneSets.reduce((a, s) => a + s.kg * s.reps, 0);
      const forms = doneSets.map((s) => s.form).filter((f) => f != null);
      const avgForm = forms.length ? Math.round(forms.reduce((a, b) => a + b, 0) / forms.length) : null;
      return `${bar}
        <div class="stack" style="gap:6px"><span class="eyebrow">Session complete</span><h1 class="display" style="font-size:52px">Nice work${state.profile.name ? `, ${esc(state.profile.name)}` : ''}</h1></div>
        <div class="grid2">
          <div class="card"><span class="eyebrow">Time</span><span class="num" style="font-size:40px">${clock()}</span></div>
          <div class="card"><span class="eyebrow">Sets</span><span class="num" style="font-size:40px">${doneSets.length}</span></div>
          <div class="card"><span class="eyebrow">Volume</span><span class="num" style="font-size:40px">${fmtNum(vol)}<span class="faint" style="font-size:16px"> kg</span></span></div>
          <div class="card"><span class="eyebrow">Form score</span><span class="num" style="font-size:40px">${avgForm ?? '—'}</span></div>
        </div>
        <section class="card"><span class="eyebrow">Next time</span><div class="list">${S.moves.map((m, k) => {
          const ex = BY_ID[m.id];
          const sets = S.logs[k].filter((s) => s.done);
          if (!sets.length) return '';
          const hitTop = sets.length >= m.sets && sets.every((s) => s.reps >= m.reps[1]);
          const note = m.unit === 'sec' ? `${sets.length} holds` : hitTop ? (S.loads[k] ? 'Top of range hit — weight goes up next time' : 'Top of range hit — add reps or slow the tempo') : 'Aim for one more rep per set';
          return `<div class="li"><span class="grow"><b>${esc(ex.name)}</b><span>${sets.map((s) => (m.unit === 'sec' ? `${s.reps}s` : `${s.reps}${s.kg ? `×${s.kg}` : ''}`)).join(' · ')}</span></span><span class="tag ${hitTop ? 'good' : ''}">${esc(note.split(' — ')[0])}</span></div>`;
        }).join('')}</div></section>
        <button class="btn block" data-act="save">Save session</button>
        <button class="btn line block" data-act="discard">Discard</button>`;
    }

    const m = S.moves[S.i];
    const ex = BY_ID[m.id];
    const load = S.loads[S.i];
    const logs = S.logs[S.i];
    const cur = logs.findIndex((s) => !s.done);
    return `${bar}
      ${S.cut && S.i === 0 ? `<div class="banner">${icon('info')}<span class="grow">Readiness is low today, so we dropped one set per exercise.</span></div>` : ''}
      ${figureStage(ex)}
      <div class="stack" style="gap:4px">
        <span class="eyebrow">Exercise ${S.i + 1} of ${S.moves.length}${m.finisher ? ' · Finisher' : ''}</span>
        <h2 class="h2" style="font-size:32px">${esc(ex.name)}</h2>
        <span class="muted small">${repText(m)} · rest ${m.rest}s${load ? ` · ${esc(load.why)}` : ''}</span>
      </div>
      <section class="card">
        <div class="setrow faint mono" style="font-size:10px;letter-spacing:.08em"><span style="text-align:center">SET</span><span style="text-align:center">${m.unit === 'sec' ? 'SECONDS' : 'REPS'}</span><span style="text-align:center">${load ? 'KG' : ''}</span><span></span></div>
        ${logs.map((s, k) => `<div class="setrow ${s.done ? 'done' : k === cur ? 'now' : ''}">
          <span class="n">${k + 1}</span>
          <div class="mini-step"><button data-act="adj" data-k="${k}" data-f="reps" data-d="${m.unit === 'sec' ? -5 : -1}">−</button><input aria-label="Set ${k + 1} ${m.unit === 'sec' ? 'seconds' : 'reps'}" inputmode="numeric" value="${s.reps}" data-input="setIn" data-k="${k}" data-f="reps"><button data-act="adj" data-k="${k}" data-f="reps" data-d="${m.unit === 'sec' ? 5 : 1}">+</button></div>
          ${load ? `<div class="mini-step"><button data-act="adj" data-k="${k}" data-f="kg" data-d="${ex.equip === 'dumbbell' ? -1 : -2.5}">−</button><input aria-label="Set ${k + 1} kilograms" inputmode="decimal" value="${s.kg}" data-input="setIn" data-k="${k}" data-f="kg"><button data-act="adj" data-k="${k}" data-f="kg" data-d="${ex.equip === 'dumbbell' ? 1 : 2.5}">+</button></div>` : '<span></span>'}
          <button class="check" data-act="doneSet" data-k="${k}" aria-label="Complete set ${k + 1}">${icon('check')}</button>
        </div>`).join('')}
        ${ex.track ? `<button class="btn ghost block" data-act="cam">${icon('camera')} Do ${cur >= 0 ? `set ${cur + 1}` : 'a set'} with AI coach</button>` : ''}
      </section>
      <button class="btn block" data-act="skipMove">${S.i < S.moves.length - 1 ? `Next: ${esc(BY_ID[S.moves[S.i + 1].id].name)}` : 'Finish workout'}</button>`;
  }

  function startRest(sec, label) {
    S.phase = 'rest';
    S.restTotal = sec;
    S.restEnd = Date.now() + sec * 1000;
    S.nextLabel = label;
    draw();
  }

  function afterSet() {
    const logs = S.logs[S.i];
    const m = S.moves[S.i];
    const next = logs.findIndex((s) => !s.done);
    if (next >= 0) {
      const s = logs[next];
      startRest(m.rest, `Next: set ${next + 1} · ${s.reps}${m.unit === 'sec' ? ' s' : ' reps'}${s.kg ? ` @ ${s.kg} kg` : ''}`);
    } else if (S.i < S.moves.length - 1) {
      S.i++;
      const nm = S.moves[S.i];
      startRest(Math.max(60, m.rest), `Next exercise: ${BY_ID[nm.id].name}`);
    } else {
      S.phase = 'summary';
      say('Workout complete. Great job.');
      draw();
    }
  }

  function onTick() {
    const c = document.getElementById('wClock');
    if (c) c.textContent = clock();
    if (S.phase === 'rest') {
      const left = Math.max(0, Math.ceil((S.restEnd - Date.now()) / 1000));
      const el = document.getElementById('restLeft');
      if (el) el.textContent = left;
      const rr = document.querySelector('#restRing circle:nth-child(2)');
      if (rr) {
        const r = parseFloat(rr.getAttribute('r'));
        const circ = 2 * Math.PI * r;
        rr.setAttribute('stroke-dashoffset', String(circ * (1 - left / S.restTotal)));
      }
      if (left <= 3 && left > 0 && state.settings.sound !== false) beep(660);
      if (left === 0) {
        if (state.settings.sound !== false) beep(990, 0.25);
        buzz([60, 40, 60]);
        say('Go');
        S.phase = 'work';
        draw();
      }
    }
  }

  function save() {
    const exercises = S.moves.map((m, k) => ({ id: m.id, sets: S.logs[k].filter((s) => s.done).map(({ reps, kg, form }) => ({ reps, kg, form })) })).filter((e) => e.sets.length);
    if (!exercises.length) { toast('Complete at least one set to save'); return; }
    update((st) => {
      st.workouts.push({ id: uid(), date: dayKey(), at: Date.now(), dayName: day.name, durationSec: Math.round((Date.now() - S.start) / 1000), exercises });
      S.moves.forEach((m, k) => {
        if (!S.loads[k]) return;
        const sets = S.logs[k].filter((s) => s.done);
        if (!sets.length) return;
        const forms = sets.map((s) => s.form).filter((f) => f != null);
        st.loads[m.id] = {
          kg: Math.max(...sets.map((s) => s.kg)),
          hitTop: sets.length >= m.sets && sets.every((s) => s.reps >= m.reps[1]),
          missed: sets.some((s) => s.reps < m.reps[0]),
          form: forms.length ? Math.round(forms.reduce((a, b) => a + b, 0) / forms.length) : null,
        };
      });
    });
    layer.actions.close();
    toast('Session saved');
    refresh();
  }

  layer = openStage({
    temp: 'train',
    html: '',
    mount() {},
    onClose() { clearInterval(tick); fv?.stop(); keepAwake(false); },
    actions: {
      adj(el) {
        const s = S.logs[S.i][Number(el.dataset.k)];
        const f = el.dataset.f;
        s[f] = Math.max(0, Math.round((s[f] + parseFloat(el.dataset.d)) * 10) / 10);
        const input = el.parentElement.querySelector('input');
        input.value = s[f];
      },
      setIn(el) {
        const v = parseFloat(el.value);
        if (!Number.isNaN(v)) S.logs[S.i][Number(el.dataset.k)][el.dataset.f] = v;
      },
      doneSet(el) {
        const k = Number(el.dataset.k);
        const s = S.logs[S.i][k];
        if (s.done) { s.done = false; draw(); return; }
        s.done = true;
        for (let j = k + 1; j < S.logs[S.i].length; j++) if (!S.logs[S.i][j].done) { S.logs[S.i][j].kg = s.kg; }
        buzz(30);
        afterSet();
      },
      skipMove() {
        if (S.i < S.moves.length - 1) { S.i++; S.phase = 'work'; draw(); }
        else { S.phase = 'summary'; draw(); }
      },
      exSpeed(el) {
        fv?.setSpeed(parseFloat(el.dataset.speed));
        el.parentElement.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      },
      exPause(el) {
        if (!fv) return;
        if (fv.running) { fv.stop(); el.innerHTML = icon('play'); }
        else { fv.opts.force = true; fv.start(); el.innerHTML = icon('pause'); }
      },
      plus15() { S.restEnd += 15000; S.restTotal += 15; },
      endRest() { S.phase = 'work'; draw(); },
      cam() {
        const k = S.logs[S.i].findIndex((s) => !s.done);
        const idx = k < 0 ? S.logs[S.i].length - 1 : k;
        const m = S.moves[S.i];
        import('./coach.js').then((c) => c.openCoach(m.id, {
          target: m.reps[0],
          onDone(sum) {
            const s = S.logs[S.i][idx];
            if (m.unit === 'sec') s.reps = sum.holdSec || s.reps;
            else if (sum.reps > 0) s.reps = sum.reps;
            s.form = sum.avgScore;
            s.done = true;
            afterSet();
          },
        }));
      },
      quit() {
        const any = S.logs.flat().some((s) => s.done);
        if (!any) { layer.actions.close(); return; }
        S.phase = 'summary';
        draw();
      },
      save,
      discard() { layer.actions.close(); toast('Session discarded'); },
    },
  });
  draw();
  tick = setInterval(onTick, 1000);
  keepAwake(true);
}
