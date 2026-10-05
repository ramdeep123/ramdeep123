// Coach: live camera form check (or an uploaded video), rep counting,
// mistake cues, ghost pacer that mirrors your depth, and a set summary.

import { state, update } from '../store.js';
import { header, gate, isPro } from '../core.js';
import { EXERCISES, BY_ID } from '../engine/exercises.js';
import { FigureView, cycleLength, segmentsFor } from '../engine/figure.js';
import { FormCoach, spokenNumber } from '../engine/formcheck.js';
import { loadPose, detect, openCamera, stopStream, coverMapper, drawSkeleton } from '../engine/pose.js';
import { say, buzz, setVoiceEnabled } from '../engine/voice.js';
import { esc, uid, dayKey } from '../engine/util.js';
import { icon, openStage, setLayerHTML, toast } from '../ui.js';
import { paintThumbs, thumb, cameraChecks } from './exercise.js';
import { keepAwake } from '../native.js';

const TRACKABLE = EXERCISES.filter((e) => e.track);

export function html() {
  return `${header('AI form coach · on-device', 'Coach')}
    <section class="card raised">
      <h2 class="h2">Your trainer can see you now</h2>
      <p class="muted">Prop your phone up, pick a move and train. KAYA tracks 33 points on your body, counts only full reps, and speaks up when a mistake is real — not on every wobble.</p>
      <div class="row wrap" style="gap:6px"><span class="tag good">${icon('lock')} Video never leaves your phone</span><span class="tag">Works offline</span></div>
    </section>
    <section class="card">
      <span class="eyebrow">How a set works</span>
      <ol class="steps">
        <li>Lean your phone 2–3 m away so your whole body fits — side-on or facing it, as shown.</li>
        <li>Start the set. Your skeleton lights up and a ghost coach mirrors the ideal depth.</li>
        <li>Fix what it calls out. Each rep gets a form score; the summary shows what to work on.</li>
      </ol>
    </section>
    <section class="stack">
      <div class="row between"><h2 class="h2">Pick a move</h2><span class="faint small mono">${TRACKABLE.length} tracked</span></div>
      <div class="card" style="padding:4px 16px"><div class="list">${TRACKABLE.map((e) => `<button class="li" data-act="pick" data-id="${e.id}">${thumb(e.id)}
        <span class="grow"><b>${esc(e.name)}</b><span>${e.track.view === 'front' ? 'Face the camera' : 'Stand side-on'} · ${e.track.mode === 'hold' ? 'timed hold' : 'rep counter'}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></div>
    </section>`;
}

export function mount(el) { paintThumbs(el); }

export const actions = {
  pick(el) { gate('coach', () => openCoach(el.dataset.id)); },
};

function placementSVG(view) {
  // phone on the left, a simple figure facing it (front) or side-on (side)
  const fig = view === 'front'
    ? '<circle cx="66" cy="22" r="7"/><path d="M66 29v26M66 36l-12 10M66 36l12 10M66 55l-8 22M66 55l8 22"/>'
    : '<circle cx="66" cy="22" r="7"/><path d="M66 29v26M66 37l8 12M66 55l6 22M66 55l-4 22"/><path d="M71 20h4" />';
  return `<svg viewBox="0 0 92 92" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
    <rect x="6" y="40" width="16" height="28" rx="3" stroke="var(--accent)"/><circle cx="14" cy="45" r="1.5" fill="var(--accent)" stroke="none"/>
    <path d="M24 54h22" stroke-dasharray="3 4" stroke="var(--text-3)"/>
    <g stroke="var(--text)">${fig}</g>
    <path d="M4 80h84" stroke="var(--line)"/></svg>`;
}

/**
 * Open a coached set. opts.onDone(summary) receives
 * {reps, avgScore, holdSec, faults, partials}.
 */
export function openCoach(exId, opts = {}) {
  const ex = BY_ID[exId];
  if (!ex?.track) { toast('Camera tracking isn’t available for this move yet'); return; }
  const S = {
    phase: 'setup', facing: ex.track.view === 'front' ? 'user' : 'environment', source: 'camera',
    stream: null, landmarker: null, coach: null, raf: 0, cue: null, cueTimer: 0, startedAt: 0, ghost: null,
    voice: state.settings.voice !== false, fileUrl: null, lastSeen: 0,
  };
  let layer = null;

  const view = () => {
    if (S.phase === 'setup') {
      const checks = cameraChecks(ex);
      return `<div class="stage-bar"><button class="icon-btn" data-act="close" aria-label="Close">${icon('back')}</button><span class="eyebrow">AI coach</span><span style="width:42px"></span></div>
        <h1 class="display" style="font-size:44px">${esc(ex.name)}</h1>
        <section class="card">
          <div class="placement">${placementSVG(ex.track.view)}
            <div class="stack" style="gap:6px">
              <b>${ex.track.view === 'front' ? 'Face the camera' : 'Turn side-on to the camera'}</b>
              <span class="muted small">Phone at waist height, 2–3 m away. Head to feet in the frame, good light, nothing bright behind you.</span>
            </div>
          </div>
        </section>
        <section class="card"><span class="eyebrow">What it counts and calls out</span><ul class="bullets">${checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <div class="seg" role="group" aria-label="Camera">
          <button data-act="facing" data-v="user" aria-pressed="${S.facing === 'user'}">Front camera</button>
          <button data-act="facing" data-v="environment" aria-pressed="${S.facing === 'environment'}">Back camera</button>
        </div>
        <button class="btn block" data-act="camGo">${icon('camera')} Start camera</button>
        <label class="btn line block" style="cursor:pointer">${icon('upload')} Analyse a recorded video<input type="file" accept="video/*" data-change="file" hidden></label>
        <div class="row between"><span class="muted small">Voice cues</span><button class="chip" data-act="voice" aria-pressed="${S.voice}">${S.voice ? 'On' : 'Off'}</button></div>`;
    }
    if (S.phase === 'live') {
      const hold = ex.track.mode === 'hold';
      return `<div class="stage-bar"><button class="icon-btn" data-act="finish" aria-label="End set">${icon('close')}</button><span class="eyebrow">${esc(ex.name)}</span><button class="icon-btn" data-act="voice" aria-label="Toggle voice">${icon(S.voice ? 'volume' : 'mute')}</button></div>
        <div class="cam">
          <video id="camV" playsinline muted ${S.source === 'camera' && S.facing === 'user' ? 'class="mirror"' : ''}></video>
          <canvas class="overlay" id="camC"></canvas>
          <div class="depth" aria-hidden="true"><i id="depthBar" style="height:0%"></i></div>
          <div class="cam-hud">
            <div class="cam-top">
              <div class="stack" style="gap:6px">
                <span class="bigrep tabnum" id="repN">${hold ? '0s' : '0'}</span>
                <span class="status" id="camStatus"><i></i><span id="camStatusT">Loading AI coach…</span></span>
              </div>
              <canvas class="ghost" id="ghost" aria-hidden="true"></canvas>
            </div>
            <div id="cueBox"></div>
          </div>
        </div>
        <div class="grid2">
          <div class="card"><span class="eyebrow">${hold ? 'Good form' : 'Form score'}</span><span class="num" style="font-size:34px" id="scoreN">—</span></div>
          <div class="card"><span class="eyebrow">${hold ? 'Time' : 'Target'}</span><span class="num" style="font-size:34px" id="targetN">${hold ? '0s' : opts.target ? `${opts.target} reps` : 'Free set'}</span></div>
        </div>
        <button class="btn block" data-act="finish">Finish set</button>`;
    }
    if (S.phase === 'error') {
      return `<div class="stage-bar"><button class="icon-btn" data-act="close" aria-label="Close">${icon('back')}</button><span class="eyebrow">AI coach</span><span style="width:42px"></span></div>
        <div class="card"><h2 class="h2">${esc(S.errTitle)}</h2><p class="muted">${esc(S.errText)}</p></div>
        <button class="btn block" data-act="retry">Try again</button>`;
    }
    // summary
    const sum = S.summary;
    const hold = ex.track.mode === 'hold';
    return `<div class="stage-bar"><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button><span class="eyebrow">Set summary</span><span style="width:42px"></span></div>
      <h1 class="display" style="font-size:46px">${esc(ex.name)}</h1>
      <div class="grid2">
        <div class="card"><span class="eyebrow">${hold ? 'Good-form time' : 'Full reps'}</span><span class="num" style="font-size:52px">${hold ? `${sum.holdSec}s` : sum.reps}</span></div>
        <div class="card"><span class="eyebrow">${hold ? 'Form held' : 'Avg form'}</span><span class="num" style="font-size:52px">${sum.avgScore ?? '—'}${sum.avgScore != null ? '<span class="faint" style="font-size:18px">%</span>' : ''}</span></div>
      </div>
      ${sum.partials ? `<div class="banner">${icon('info')}<span class="grow"><b>${sum.partials} partial rep${sum.partials > 1 ? 's' : ''}</b> didn’t count.</span></div>` : ''}
      <section class="card"><span class="eyebrow">What to work on</span>
        ${sum.faults.length ? `<div class="list">${sum.faults.map((f) => `<div class="li"><span class="grow"><b>${esc(f.msg)}</b><span>Seen ${f.count} time${f.count > 1 ? 's' : ''}</span></span></div>`).join('')}</div>`
          : '<p class="muted">Clean set. No consistent mistakes detected.</p>'}
      </section>
      <button class="btn block" data-act="done">${opts.onDone ? 'Use this set' : 'Save to log'}</button>
      <button class="btn line block" data-act="again">Go again</button>`;
  };

  const draw = () => setLayerHTML(layer, view());

  function showCue(msg, kind) {
    const box = document.getElementById('cueBox');
    if (!box) return;
    box.innerHTML = `<div class="cue ${kind}">${icon(kind === 'good' ? 'check' : 'info')}<span>${esc(msg)}</span></div>`;
    clearTimeout(S.cueTimer);
    S.cueTimer = setTimeout(() => { if (box.isConnected) box.innerHTML = ''; }, 3500);
  }

  function setStatus(text, ok) {
    const st = document.getElementById('camStatus');
    if (!st) return;
    st.classList.toggle('ok', !!ok);
    document.getElementById('camStatusT').textContent = text;
  }

  function stopAll() {
    cancelAnimationFrame(S.raf);
    S.raf = 0;
    stopStream(S.stream);
    S.stream = null;
    S.ghost?.stop?.();
    if (S.fileUrl) { URL.revokeObjectURL(S.fileUrl); S.fileUrl = null; }
    keepAwake(false);
  }

  async function startLive(file) {
    S.source = file ? 'file' : 'camera';
    S.phase = 'live';
    draw();
    keepAwake(true);
    const video = document.getElementById('camV');
    const canvas = document.getElementById('camC');
    const ctx = canvas.getContext('2d');
    const ghostC = document.getElementById('ghost');
    const ghost = new FigureView(ghostC, ex.anim, { style: 'ghost', floor: false, measure: false, path: false, pad: 6, glow: segmentsFor(ex.muscles.primary) });
    S.ghost = ghost;
    const hold = ex.track.mode === 'hold';
    const f0 = ex.anim.frames[0];
    const ghostAt = (p) => (f0.hold || 0) + (f0.dur || 0) * p;
    ghost.time = ghostAt(0);
    ghost.draw();

    S.coach = new FormCoach(ex, {
      onRep({ count, score }) {
        document.getElementById('repN').textContent = String(count);
        document.getElementById('scoreN').textContent = String(Math.round(S.coach.scores.reduce((a, b) => a + b, 0) / S.coach.scores.length));
        buzz(25);
        if (S.voice) say(spokenNumber(count), { urgent: false, rate: 1.15 });
        if (opts.target && count === opts.target && S.voice) setTimeout(() => say('Target reached. Finish when ready.'), 700);
      },
      onCue({ msg, kind }) {
        showCue(msg, kind);
        if (kind === 'fix') buzz([40, 50, 40]);
        if (S.voice) say(msg, { urgent: kind === 'fix' });
      },
    });

    try {
      if (file) {
        S.fileUrl = URL.createObjectURL(file);
        video.src = S.fileUrl;
        video.muted = true;
        video.playsInline = true;
        await video.play();
      } else {
        S.stream = await openCamera(video, S.facing);
      }
    } catch (e) {
      stopAll();
      S.phase = 'error';
      S.errTitle = 'Camera unavailable';
      S.errText = e?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access for KAYA in your phone settings, then try again.'
        : 'We couldn’t start the camera on this device. You can still analyse a recorded video.';
      draw();
      return;
    }

    try {
      S.landmarker = await loadPose();
    } catch (e) {
      stopAll();
      S.phase = 'error';
      S.errTitle = 'AI coach couldn’t load';
      S.errText = 'The pose model failed to start on this device. Update Android System WebView from the Play Store and try again.';
      draw();
      return;
    }
    setStatus(file ? 'Analysing video' : 'Step into frame', false);
    if (S.voice && !file) say(ex.track.view === 'front' ? 'Face the camera, whole body in frame.' : 'Turn side on, whole body in frame.');
    S.startedAt = performance.now();
    let lastVideoTime = -1;

    const loop = () => {
      if (!video.isConnected) return;
      S.raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      let lm = null;
      try { lm = detect(S.landmarker, video); } catch (e) { return; }
      const now = performance.now();
      const r = S.coach.update(lm, video.videoWidth, video.videoHeight, now);
      if (lm) {
        const map = coverMapper(video, cw, ch, S.source === 'camera' && S.facing === 'user');
        drawSkeleton(ctx, lm, map, r.flagged, r.progress || 0);
      }
      if (!r.visible) {
        setStatus(r.reason === 'none' ? 'No body found — step into frame' : 'Step back — show your whole body', false);
      } else {
        setStatus(hold ? (r.ok ? 'Holding good form' : 'Get into position') : 'Tracking', true);
        if (hold) {
          document.getElementById('repN').textContent = `${Math.round(r.holdMs / 1000)}s`;
          document.getElementById('targetN').textContent = `${Math.round(r.totalMs / 1000)}s`;
          document.getElementById('scoreN').textContent = r.totalMs > 2000 ? `${Math.round((r.holdMs / r.totalMs) * 100)}` : '—';
          ghost.time += 1 / 30;
        } else {
          ghost.time = ghostAt(r.progress || 0);
          const bar = document.getElementById('depthBar');
          if (bar) bar.style.height = `${Math.round((r.progress || 0) * 100)}%`;
        }
        ghost.draw();
      }
      if (S.source === 'file' && video.ended) finish();
    };
    loop();
    if (S.source === 'file') video.addEventListener('ended', () => finish(), { once: true });
  }

  function finish() {
    if (S.phase !== 'live') return;
    S.summary = S.coach ? S.coach.summary() : { reps: 0, avgScore: null, faults: [], partials: 0, holdSec: 0 };
    stopAll();
    S.phase = 'summary';
    draw();
    if (S.voice) say(ex.track.mode === 'hold' ? `${S.summary.holdSec} seconds of good form.` : `${S.summary.reps} reps.`);
  }

  layer = openStage({
    temp: 'coach',
    html: '',
    onClose() { stopAll(); clearTimeout(S.cueTimer); setVoiceEnabled(state.settings.voice !== false); },
    actions: {
      facing(el) { S.facing = el.dataset.v; draw(); },
      voice() { S.voice = !S.voice; setVoiceEnabled(S.voice); if (S.phase === 'setup') draw(); else { const b = document.querySelector('[data-act="voice"]'); if (b) b.innerHTML = icon(S.voice ? 'volume' : 'mute'); } },
      camGo() { startLive(null); },
      file(el) { const f = el.files?.[0]; if (f) startLive(f); },
      finish,
      retry() { S.phase = 'setup'; draw(); },
      again() { S.phase = 'setup'; draw(); },
      done() {
        const sum = S.summary;
        if (opts.onDone) {
          layer.actions.close();
          opts.onDone(sum);
          return;
        }
        if ((sum.reps || sum.holdSec) && isPro()) {
          update((s) => {
            const set = { reps: ex.track.mode === 'hold' ? sum.holdSec : sum.reps, kg: 0, form: sum.avgScore };
            const existing = s.workouts.find((w) => w.date === dayKey() && w.dayName === 'Coach session');
            if (existing) {
              const e = existing.exercises.find((x) => x.id === ex.id);
              if (e) e.sets.push(set); else existing.exercises.push({ id: ex.id, sets: [set] });
            } else {
              s.workouts.push({ id: uid(), date: dayKey(), at: Date.now(), dayName: 'Coach session', durationSec: 0, exercises: [{ id: ex.id, sets: [set] }] });
            }
          });
          toast('Set saved to your log');
        }
        layer.actions.close();
      },
    },
  });
  setVoiceEnabled(S.voice);
  draw();
}
