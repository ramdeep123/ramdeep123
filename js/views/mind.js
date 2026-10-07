// Mind lab: breathwork & NSDR player, stress tracking, cortisol science.

import { state, update } from '../store.js';
import { header, isPro, hooks, refresh, todayInfo } from '../core.js';
import { SESSIONS, sessionById, CORTISOL } from '../engine/breath.js';
import { Orb } from '../engine/orb.js';
import { say, tone, buzz, hush } from '../engine/voice.js';
import { L, BREATH_CUE } from '../engine/voicelines.js';
import { lineChart } from '../charts.js';
import { esc, fmtDuration, fmtDate, uid, dayKey, DAY } from '../engine/util.js';
import { icon, openStage, setLayerHTML, toast } from '../ui.js';
import { keepAwake } from '../native.js';

export function html() {
  const pro = isPro();
  const weekAgo = Date.now() - 7 * DAY;
  const recent = state.meditations.filter((m) => (m.at || 0) >= weekAgo);
  const minutes = recent.reduce((a, m) => a + m.minutes, 0);
  const rated = state.meditations.filter((m) => m.before != null && m.after != null);
  const drop = rated.length ? (rated.reduce((a, m) => a + (m.before - m.after), 0) / rated.length) : null;
  const t = todayInfo();
  const stress = t.checkin?.stress;
  const goalNote = CORTISOL.forGoals.find((g) => g.goal === state.profile.goal);

  return `${header('Mind lab · cortisol', 'Mind')}
    <section class="card raised" style="align-items:center;text-align:center">
      <canvas id="mindOrb" style="width:180px;height:180px" aria-hidden="true"></canvas>
      <h2 class="h2">Cool the system</h2>
      <p class="muted" style="max-width:36ch">${stress != null ? `You rated stress <b>${stress}/10</b> this morning. ` : ''}Three minutes of long exhales is the fastest tool we know to shift your body out of fight-or-flight.</p>
      <button class="btn" data-act="play" data-id="sigh">${icon('play')} 3-minute reset</button>
    </section>

    <section class="grid2">
      <div class="card"><span class="eyebrow">This week</span><span class="num" style="font-size:40px">${minutes}<span class="faint" style="font-size:16px"> min</span></span></div>
      <div class="card"><span class="eyebrow">Avg stress drop</span><span class="num" style="font-size:40px">${drop != null ? `−${drop.toFixed(1)}` : '—'}</span></div>
    </section>

    <section class="stack">
      <h2 class="h2">Sessions</h2>
      <div class="card" style="padding:4px 16px"><div class="list">${SESSIONS.map((s) => `<button class="session" data-act="play" data-id="${s.id}">
        <span class="min">${s.minutes}<small>MIN</small></span>
        <span class="stack" style="gap:2px;min-width:0"><b>${esc(s.name)}</b><span class="muted small">${esc(s.bestFor)}</span></span>
        ${!s.free && !pro ? icon('lock', 'chev') : `<span class="tag">${esc(s.tag)}</span>`}
      </button>`).join('')}</div></div>
    </section>

    ${rated.length >= 2 ? `<section class="card">
      <span class="eyebrow">Stress before vs after</span>
      <div id="stressChart"></div>
      <div class="legend"><span><i style="background:var(--warn);height:2px"></i>Before</span><span><i style="background:var(--frost);height:2px"></i>After</span></div>
    </section>` : ''}

    <section class="card">
      <span class="eyebrow">Cortisol & your body</span>
      <details class="acc" open><summary>What cortisol actually does</summary><div class="body"><p>${esc(CORTISOL.intro)}</p><p>${esc(CORTISOL.rhythm)}</p></div></details>
      <details class="acc"><summary>When it stays high</summary><div class="body">${CORTISOL.effects.map((e) => `<p><b style="color:var(--text)">${esc(e.title)}.</b> ${esc(e.text)}</p>`).join('')}</div></details>
      <details class="acc"><summary>What changes when you practise</summary><div class="body"><div class="timeline">${CORTISOL.timeline.map((x) => `<div class="tl"><i></i><div><b>${esc(x.when)}</b><span>${esc(x.what)}</span></div></div>`).join('')}</div></div></details>
      <details class="acc"><summary>What the research says</summary><div class="body">${CORTISOL.evidence.map((e) => `<div><p>${esc(e.claim)}</p><span class="cite">${esc(e.cite)}</span></div>`).join('')}</div></details>
      ${goalNote ? `<details class="acc"><summary>Why it matters for your goal</summary><div class="body"><p>${esc(goalNote.text)}</p></div></details>` : ''}
      <details class="acc"><summary>The techniques</summary><div class="body">${SESSIONS.map((s) => `<p><b style="color:var(--text)">${esc(s.name)}.</b> ${esc(s.how)}</p>`).join('')}</div></details>
      <p class="faint small">${esc(CORTISOL.disclaimer)}</p>
    </section>`;
}

export function mount(el) {
  new Orb(el.querySelector('#mindOrb'), { value: 55, palette: 'frost' }).start();
  const host = el.querySelector('#stressChart');
  if (host) {
    const rated = state.meditations.filter((m) => m.before != null).slice(-12);
    lineChart(host, {
      series: [
        { name: 'Before', color: 'var(--warn)', dots: true, points: rated.map((m) => ({ x: m.at, y: m.before })) },
        { name: 'After', color: 'var(--frost)', dots: true, points: rated.map((m) => ({ x: m.at, y: m.after })) },
      ],
      fmtX: (x) => fmtDate(x), fmtY: (y) => `${Math.round(y)}/10`, height: 150, yPad: 0.5,
    });
  }
}

export const actions = {
  play(el) { openBreath(el.dataset.id); },
};

const SCALE = { in: 1.08, in2: 1.18, out: 0.62, hold: null, hold2: null };

export function openBreath(id) {
  const s = sessionById(id);
  if (!s) return;
  if (!s.free && !isPro()) { hooks.openPass('mind'); return; }
  const S = { phase: 'pre', before: state.checkins[dayKey()]?.stress ?? 5, after: 4, t: 0, last: 0, raf: 0, paused: false, idx: -1, line: -1, voice: state.settings.voice !== false, sound: state.settings.sound !== false, orb: null };
  const total = s.minutes * 60;
  const cycle = s.pattern.reduce((a, p) => a + p.sec, 0);
  let layer = null;

  const slider = (id2, v) => `<div class="field"><div class="row between"><label for="${id2}">Stress right now</label><span class="num" style="font-size:26px" id="${id2}V">${v}/10</span></div>
    <input type="range" id="${id2}" min="1" max="10" step="1" value="${v}" data-input="rate"></div>`;

  const view = () => {
    const bar = `<div class="stage-bar"><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button><span class="eyebrow">${esc(s.name)}</span><span style="width:42px"></span></div>`;
    if (S.phase === 'pre') {
      return `${bar}<h1 class="display" style="font-size:46px;color:var(--frost)">${esc(s.name)}</h1>
        <p class="muted">${esc(s.how)}</p>
        <section class="card">${slider('preR', S.before)}</section>
        <div class="row between"><span class="muted small">Voice guide</span><button class="chip" data-act="tVoice" aria-pressed="${S.voice}">${S.voice ? 'On' : 'Off'}</button></div>
        <div class="row between"><span class="muted small">Breath tones</span><button class="chip" data-act="tSound" aria-pressed="${S.sound}">${S.sound ? 'On' : 'Off'}</button></div>
        <button class="btn block" data-act="begin">${icon('play')} Begin · ${s.minutes} min</button>
        <p class="faint small">${esc(CORTISOL.disclaimer)}</p>`;
    }
    if (S.phase === 'run') {
      return `${bar}<div class="breath-stage">
          <canvas id="bOrb" aria-hidden="true"></canvas>
          <div class="breath-phase" id="bPhase" aria-live="polite">Settle in</div>
          <span class="num" style="font-size:30px" id="bSec">&nbsp;</span>
          ${s.script ? '<p class="muted" id="bLine" style="max-width:34ch;min-height:66px"></p>' : ''}
          <span class="eyebrow" id="bLeft">${fmtDuration(total)} left</span>
        </div>
        <div class="grid2"><button class="btn ghost" data-act="pause" id="bPause">Pause</button><button class="btn line" data-act="end">End</button></div>`;
    }
    if (S.phase === 'post') {
      return `${bar}<h1 class="display" style="font-size:46px;color:var(--frost)">How do you feel?</h1>
        <section class="card">${slider('postR', S.after)}</section>
        <button class="btn block" data-act="saveB">Save session</button>`;
    }
    const d = S.before - S.after;
    return `${bar}<div class="breath-stage"><span class="eyebrow">Stress</span>
        <span class="num" style="font-size:96px;line-height:.85;color:var(--frost)">${S.before} → ${S.after}</span>
        <p class="muted" style="max-width:32ch">${d > 0 ? `Down ${d} point${d > 1 ? 's' : ''} in ${s.minutes} minutes. That is your nervous system shifting into rest-and-repair.` : 'Even when it doesn’t feel different yet, daily practice is what moves the needle. Come back tomorrow.'}</p></div>
      <button class="btn block" data-act="close">Done</button>`;
  };
  const draw = () => {
    setLayerHTML(layer, view());
    if (S.phase === 'run') S.orb = new Orb(layer.el.querySelector('#bOrb'), { value: 70, palette: 'frost', scale: 0.7 }).start();
  };

  const loop = (now) => {
    if (S.phase !== 'run') return;
    S.raf = requestAnimationFrame(loop);
    if (S.paused) { S.last = now; return; }
    if (S.last) S.t += (now - S.last) / 1000;
    S.last = now;
    const lead = 3;
    const t = S.t - lead;
    const left = document.getElementById('bLeft');
    if (left) left.textContent = `${fmtDuration(total - Math.max(0, t))} left`;
    if (t < 0) {
      document.getElementById('bPhase').textContent = `Starting in ${Math.ceil(-t)}`;
      return;
    }
    if (t >= total) { S.phase = 'post'; cancelAnimationFrame(S.raf); keepAwake(false); if (S.voice) say(L.breathEnd); draw(); return; }
    let w = t % cycle;
    let i = 0;
    while (w >= s.pattern[i].sec) { w -= s.pattern[i].sec; i++; }
    const ph = s.pattern[i];
    const secLeft = Math.ceil(ph.sec - w);
    document.getElementById('bSec').textContent = String(secLeft);
    if (i !== S.idx) {
      S.idx = i;
      document.getElementById('bPhase').textContent = ph.label;
      if (SCALE[ph.phase] != null) S.orb.scale = SCALE[ph.phase];
      S.orb.value = 40 + 50 * (1 - t / total);
      if (S.sound) tone(ph.phase, ph.sec);
      if (S.voice && !s.script) say(BREATH_CUE[ph.phase], { rate: 0.9 });
      buzz(15);
    }
    if (s.script) {
      let li = -1;
      s.script.forEach(([at], k) => { if (t >= at) li = k; });
      if (li !== S.line) {
        S.line = li;
        const text = s.script[li][1];
        const el = document.getElementById('bLine');
        if (el) el.textContent = text;
        if (S.voice) say(text, { rate: 0.85, urgent: true });
      }
    }
  };

  layer = openStage({
    temp: 'mind',
    html: '',
    onClose() { cancelAnimationFrame(S.raf); S.phase = 'closed'; keepAwake(false); hush(); refresh(); },
    actions: {
      rate(el) {
        const v = Number(el.value);
        if (el.id === 'preR') S.before = v; else S.after = v;
        document.getElementById(`${el.id}V`).textContent = `${v}/10`;
      },
      tVoice(el) { S.voice = !S.voice; el.setAttribute('aria-pressed', String(S.voice)); el.textContent = S.voice ? 'On' : 'Off'; },
      tSound(el) { S.sound = !S.sound; el.setAttribute('aria-pressed', String(S.sound)); el.textContent = S.sound ? 'On' : 'Off'; },
      begin() {
        S.phase = 'run'; S.t = 0; S.last = 0; S.idx = -1;
        draw();
        keepAwake(true);
        if (S.voice) say(s.script ? L.getComfortable : L.followOrb, { rate: 0.9 });
        S.raf = requestAnimationFrame(loop);
      },
      pause(el) { S.paused = !S.paused; el.textContent = S.paused ? 'Resume' : 'Pause'; if (S.paused) hush(); },
      end() {
        cancelAnimationFrame(S.raf);
        keepAwake(false);
        if (S.t < 30) { layer.actions.close(); return; }
        S.phase = 'post'; draw();
      },
      saveB() {
        const minutes = Math.max(1, Math.round(Math.min(S.t, total) / 60));
        update((st) => { st.meditations.push({ id: uid(), date: dayKey(), at: Date.now(), session: s.id, minutes, before: S.before, after: S.after }); });
        S.phase = 'done';
        draw();
        toast('Session saved');
      },
    },
  });
  draw();
}
