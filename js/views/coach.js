// Coach: live camera form check (or an uploaded video), rep counting,
// mistake cues, ghost pacer that mirrors your depth, and a set summary.

import { state, update } from '../store.js';
import { header, gate, isPro } from '../core.js';
import { EXERCISES, BY_ID } from '../engine/exercises.js';
import { FigureView, cycleLength, segmentsFor } from '../engine/figure.js';
import { FormCoach, framing } from '../engine/formcheck.js';
import { loadPose, detect, openCamera, stopStream, coverMapper, drawSkeleton, frameBrightness, resetTrail, MODELS } from '../engine/pose.js';
import { L, numberWord } from '../engine/voicelines.js';
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
 * {reps, avgScore, holdSec, faults, partials, depth, tempo, repLog}.
 * opts.target = reps (or seconds for holds) to aim for.
 */
export function openCoach(exId, opts = {}) {
  const ex = BY_ID[exId];
  if (!ex?.track) { toast('Camera tracking isn’t available for this move yet'); return; }
  const hold = ex.track.mode === 'hold';
  const S = {
    phase: 'setup', facing: ex.track.view === 'front' ? 'user' : 'environment', source: 'camera',
    model: state.settings.poseModel || 'full',
    stream: null, landmarker: null, coach: null, raf: 0, cueTimer: 0, ghost: null,
    voice: state.settings.voice !== false, fileUrl: null,
    live: 'framing', okSince: 0, lostSince: 0, saidLost: false, frameIssue: null, issueSince: 0, lastIssueCue: {},
    countdownAt: 0, lastCount: 0, frames: [], lastLight: 0, targetSaid: false,
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
              <span class="muted small">Phone at waist height, 2–3 m away. Head to feet in the frame, good light, nothing bright behind you. KAYA checks all of this for you before it starts counting.</span>
            </div>
          </div>
        </section>
        <section class="card"><span class="eyebrow">What it counts and calls out</span><ul class="bullets">${checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <div class="field"><label>Camera</label><div class="seg" role="group" aria-label="Camera">
          <button data-act="facing" data-v="user" aria-pressed="${S.facing === 'user'}">Front</button>
          <button data-act="facing" data-v="environment" aria-pressed="${S.facing === 'environment'}">Back</button>
        </div></div>
        <div class="field"><label>Tracking</label><div class="seg" role="group" aria-label="Tracking quality">
          <button data-act="model" data-v="full" aria-pressed="${S.model === 'full'}">Precise</button>
          <button data-act="model" data-v="lite" aria-pressed="${S.model === 'lite'}">Fast</button>
        </div><span class="faint small">Precise uses the larger AI model with 3D joint angles. KAYA switches to Fast by itself if your phone can’t keep up.</span></div>
        <button class="btn block" data-act="camGo">${icon('camera')} Start camera</button>
        <label class="btn line block" style="cursor:pointer">${icon('upload')} Analyse a recorded video<input type="file" accept="video/*" data-change="file" hidden></label>
        <div class="row between"><span class="muted small">Voice cues</span><button class="chip" data-act="voice" aria-pressed="${S.voice}">${S.voice ? 'On' : 'Off'}</button></div>`;
    }
    if (S.phase === 'live') {
      return `<div class="stage-bar"><button class="icon-btn" data-act="finish" aria-label="End set">${icon('close')}</button><span class="eyebrow">${esc(ex.name)}</span><button class="icon-btn" data-act="voice" aria-label="Toggle voice">${icon(S.voice ? 'volume' : 'mute')}</button></div>
        <div class="cam">
          <video id="camV" playsinline muted ${S.source === 'camera' && S.facing === 'user' ? 'class="mirror"' : ''}></video>
          <canvas class="overlay" id="camC"></canvas>
          <div class="depth" aria-hidden="true"><i id="depthBar" style="height:0%"></i><b id="depthTarget"></b></div>
          <div class="countdown" id="countdown" hidden></div>
          <div class="cam-hud">
            <div class="cam-top">
              <div class="stack" style="gap:6px">
                <span class="bigrep tabnum" id="repN">${hold ? '0s' : '0'}</span>
                <span class="status" id="camStatus"><i></i><span id="camStatusT">Loading AI coach…</span></span>
                <span class="lastrep" id="lastRep" hidden></span>
              </div>
              <canvas class="ghost" id="ghost" aria-hidden="true"></canvas>
            </div>
            <div class="stack" style="gap:8px">
              <div id="cueBox"></div>
              <span class="aistat" id="aiStat">AI · ${MODELS[S.model]}</span>
            </div>
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
    const log = sum.repLog || [];
    const maxRom = Math.max(110, ...log.map((r) => r.rom));
    return `<div class="stage-bar"><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button><span class="eyebrow">Set summary</span><span style="width:42px"></span></div>
      <h1 class="display" style="font-size:46px">${esc(ex.name)}</h1>
      <div class="grid2">
        <div class="card"><span class="eyebrow">${hold ? 'Good-form time' : 'Full reps'}</span><span class="num" style="font-size:52px">${hold ? `${sum.holdSec}s` : sum.reps}</span></div>
        <div class="card"><span class="eyebrow">${hold ? 'Form held' : 'Avg form'}</span><span class="num" style="font-size:52px">${sum.avgScore ?? '—'}${sum.avgScore != null ? '<span class="faint" style="font-size:18px">%</span>' : ''}</span></div>
        ${hold ? '' : `<div class="card"><span class="eyebrow">Avg depth</span><span class="num" style="font-size:40px">${sum.depth ?? '—'}${sum.depth != null ? '<span class="faint" style="font-size:16px">%</span>' : ''}</span><span class="faint small">100% = full range</span></div>
        <div class="card"><span class="eyebrow">Tempo ↓ / ↑</span><span class="num" style="font-size:40px">${sum.tempo ? `${sum.tempo.down}s / ${sum.tempo.up}s` : '—'}</span><span class="faint small">Consistency ${sum.consistency ?? '—'}${sum.consistency != null ? '%' : ''}</span></div>`}
      </div>
      ${log.length ? `<section class="card"><span class="eyebrow">Every rep</span>
        <div class="reps-chart" role="img" aria-label="Depth and score of each rep">${log.map((r) => `<div class="rep-bar" title="Rep ${r.n}: depth ${r.rom}%, score ${r.score}, down ${r.down}s, up ${r.up}s">
          <i style="height:${Math.round((r.rom / maxRom) * 100)}%;background:${r.score >= 85 ? 'var(--good)' : r.score >= 70 ? 'var(--warn)' : 'var(--bad)'}"></i><span>${r.n}</span></div>`).join('')}</div>
        <div class="legend"><span><i style="background:var(--good)"></i>Clean</span><span><i style="background:var(--warn)"></i>1 fault</span><span><i style="background:var(--bad)"></i>2+ faults</span><span class="faint">Bar height = depth</span></div>
      </section>` : ''}
      ${sum.partials ? `<div class="banner">${icon('info')}<span class="grow"><b>${sum.partials} partial rep${sum.partials > 1 ? 's' : ''}</b> didn’t count.</span></div>` : ''}
      <section class="card"><span class="eyebrow">What to work on</span>
        ${sum.faults.length ? `<div class="list">${sum.faults.map((f) => `<div class="li"><span class="grow"><b>${esc(f.msg)}</b><span>Seen ${f.count} time${f.count > 1 ? 's' : ''}</span></span></div>`).join('')}</div>`
          : '<p class="muted">Clean set. No consistent mistakes detected.</p>'}
      </section>
      <button class="btn block" data-act="done">${opts.onDone ? 'Use this set' : 'Save to log'}</button>
      <button class="btn line block" data-act="again">Go again</button>`;
  };

  const draw = () => setLayerHTML(layer, view());
  const el = (id) => document.getElementById(id);

  function showCue(msg, kind) {
    const box = el('cueBox');
    if (!box) return;
    box.innerHTML = `<div class="cue ${kind}">${icon(kind === 'good' ? 'check' : 'info')}<span>${esc(msg)}</span></div>`;
    clearTimeout(S.cueTimer);
    S.cueTimer = setTimeout(() => { if (box.isConnected) box.innerHTML = ''; }, 3500);
  }

  function coachSay(line, urgent = false) {
    if (S.voice) say(line, { urgent });
  }

  function setStatus(text, ok) {
    const st = el('camStatus');
    if (!st) return;
    st.classList.toggle('ok', !!ok);
    el('camStatusT').textContent = text;
  }

  function stopAll() {
    cancelAnimationFrame(S.raf);
    S.raf = 0;
    stopStream(S.stream);
    S.stream = null;
    S.ghost?.stop?.();
    resetTrail();
    if (S.fileUrl) { URL.revokeObjectURL(S.fileUrl); S.fileUrl = null; }
    keepAwake(false);
  }

  const ISSUE = {
    out: ['Step back — show your whole body', L.stepBack],
    far: ['Come a little closer', L.comeCloser],
    'turn-side': ['Turn more side-on', L.turnMore],
    'turn-front': ['Turn to face the camera', L.faceMore],
    dark: ['Too dark — find more light', L.tooDark],
  };

  function issueCue(code, now) {
    const [text, line] = ISSUE[code];
    setStatus(text, false);
    if (now - (S.lastIssueCue[code] || -1e9) > 6000) {
      S.lastIssueCue[code] = now;
      showCue(text, 'fix');
      coachSay(line, true);
    }
  }

  async function startLive(file) {
    S.source = file ? 'file' : 'camera';
    S.phase = 'live';
    S.live = file ? 'tracking' : 'framing';
    draw();
    keepAwake(true);
    const video = el('camV');
    const canvas = el('camC');
    const ctx = canvas.getContext('2d');
    const ghost = new FigureView(el('ghost'), ex.anim, { style: 'ghost', floor: false, measure: false, path: false, pad: 6, glow: segmentsFor(ex.muscles.primary) });
    S.ghost = ghost;
    const f0 = ex.anim.frames[0];
    const ghostAt = (p) => (f0.hold || 0) + (f0.dur || 0) * p;
    ghost.time = ghostAt(0);
    ghost.draw();

    S.coach = new FormCoach(ex, {
      onRep(rep) {
        el('repN').textContent = String(rep.count);
        el('scoreN').textContent = String(Math.round(S.coach.scores.reduce((a, b) => a + b, 0) / S.coach.scores.length));
        const lr = el('lastRep');
        if (lr) {
          lr.hidden = false;
          lr.innerHTML = `Depth <b>${rep.rom}%</b> · ↓${rep.down}s ↑${rep.up}s`;
          lr.className = `lastrep ${rep.score >= 85 ? 'good' : rep.score >= 70 ? 'warn' : 'bad'}`;
        }
        buzz(25);
        coachSay(numberWord(rep.count));
        if (opts.target && rep.count === opts.target && !S.targetSaid) {
          S.targetSaid = true;
          setTimeout(() => coachSay(L.targetReached), 700);
        }
      },
      onCue({ msg, kind }) {
        showCue(msg, kind);
        if (kind === 'fix') buzz([40, 50, 40]);
        coachSay(msg, kind === 'fix');
      },
      onCalibrated() { /* start position learned */ },
    });
    S.coach.armed = !!file;

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
      S.landmarker = await loadPose(S.model);
    } catch (e) {
      try { S.model = 'lite'; S.landmarker = await loadPose('lite'); } catch (e2) {
        stopAll();
        S.phase = 'error';
        S.errTitle = 'AI coach couldn’t load';
        S.errText = 'The pose model failed to start on this device. Update Android System WebView from the Play Store and try again.';
        draw();
        return;
      }
    }
    setStatus(file ? 'Analysing video' : 'Step into frame', false);
    if (!file) coachSay(ex.track.view === 'front' ? L.frameFront : L.frameSide);
    let lastVideoTime = -1;
    let swapping = false;

    const loop = () => {
      if (!video.isConnected) return;
      S.raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();

      // processing speed; drop to the fast model if the phone can't keep up
      S.frames.push(now);
      while (S.frames.length && now - S.frames[0] > 3000) S.frames.shift();
      const fps = S.frames.length / 3;
      if (S.frames.length > 10 && now - S.frames[0] > 2500) {
        const stat = el('aiStat');
        if (stat) stat.textContent = `AI · ${MODELS[S.model]} · ${Math.round(fps)} fps${S.coach.calibrated && !hold ? ' · calibrated' : ''}`;
        if (S.model === 'full' && fps < 11 && !swapping && S.source === 'camera') {
          swapping = true;
          loadPose('lite').then((lm) => {
            S.landmarker = lm; S.model = 'lite'; S.frames = [];
            update((st) => { st.settings.poseModel = 'lite'; });
            toast('Switched to Fast tracking for smoother results on this phone');
          }).catch(() => {});
        }
      }

      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      let det = null;
      try { det = detect(S.landmarker, video); } catch (e) { return; }
      const r = S.coach.update(det?.landmarks || null, video.videoWidth, video.videoHeight, now, det?.world || null);

      // light check every 1.5 s
      if (S.source === 'camera' && now - S.lastLight > 1500) {
        S.lastLight = now;
        S.dark = frameBrightness(video) < 42;
      }

      // framing check (must persist ~0.8 s before we nag)
      let issue = null;
      if (det?.landmarks) issue = framing(det.landmarks, ex.track.view);
      if (!issue && S.dark) issue = 'dark';
      if (issue !== S.frameIssue) { S.frameIssue = issue; S.issueSince = now; }

      if (det?.landmarks) {
        const map = coverMapper(video, cw, ch, S.source === 'camera' && S.facing === 'user');
        const m = r.metrics;
        const focus = m && !hold ? {
          metric: ex.track.metric, side: ex.track.view === 'front' ? 'R' : r.side,
          value: m[ex.track.metric], target: ex.track.active, dir: ex.track.dir,
          reached: ex.track.dir === 'down' ? m[ex.track.metric] <= ex.track.active : m[ex.track.metric] >= ex.track.active,
        } : null;
        drawSkeleton(ctx, r.landmarks || det.landmarks, map, r.flagged || new Set(), r.progress || 0, focus);
      }

      // --- live state machine: framing → countdown → tracking (⇄ paused)
      if (S.live === 'framing') {
        if (r.visible && !S.frameIssue) {
          S.okSince ||= now;
          setStatus('Hold still…', true);
          if (now - S.okSince > 600) {
            S.live = 'countdown';
            S.countdownAt = now;
            S.lastCount = 4;
            coachSay(L.locked);
          }
        } else {
          S.okSince = 0;
          if (S.frameIssue && now - S.issueSince > 800) issueCue(S.frameIssue, now);
          else if (!r.visible) setStatus(r.reason === 'none' ? 'No body found — step into frame' : 'Step back — show your whole body', false);
        }
      } else if (S.live === 'countdown') {
        const left = 3 - Math.floor((now - S.countdownAt - 1200) / 1000);
        const cd = el('countdown');
        if (now - S.countdownAt < 1200) {
          if (cd) { cd.hidden = false; cd.textContent = 'Ready'; }
        } else if (left >= 1) {
          if (cd) { cd.hidden = false; cd.textContent = String(left); }
          if (left !== S.lastCount) { S.lastCount = left; coachSay(numberWord(left)); }
        } else {
          if (cd) cd.hidden = true;
          S.live = 'tracking';
          S.coach.armed = true;
          coachSay(hold ? L.holdStart : L.go, true);
        }
        setStatus(hold ? 'Get into position' : 'Get into your start position', true);
      } else if (S.live === 'tracking' || S.live === 'paused') {
        if (!r.visible) {
          S.lostSince ||= now;
          if (now - S.lostSince > 1500 && S.source === 'camera') {
            S.live = 'paused';
            setStatus('Paused — step back into frame', false);
            if (!S.saidLost) { S.saidLost = true; coachSay(L.lost, true); }
          }
        } else {
          S.lostSince = 0; S.saidLost = false;
          if (S.live === 'paused') S.live = 'tracking';
          if (S.frameIssue && now - S.issueSince > 1500) issueCue(S.frameIssue, now);
          else setStatus(hold ? (r.ok ? 'Holding good form' : 'Get into position') : `Tracking · ${r.side === 'L' ? 'left' : 'right'} side`, true);
          if (hold) {
            el('repN').textContent = `${Math.round(r.holdMs / 1000)}s`;
            el('targetN').textContent = `${Math.round(r.totalMs / 1000)}s`;
            el('scoreN').textContent = r.totalMs > 2000 ? `${Math.round((r.holdMs / r.totalMs) * 100)}` : '—';
            if (opts.target && r.holdMs >= opts.target * 1000 && !S.targetSaid) { S.targetSaid = true; coachSay(L.holdDone); }
            ghost.time += 1 / 30;
          } else {
            ghost.time = ghostAt(r.progress || 0);
            const bar = el('depthBar');
            if (bar) bar.style.height = `${Math.round((r.progress || 0) * 100)}%`;
          }
          ghost.draw();
        }
      }
      if (S.source === 'file' && video.ended) finish();
    };
    loop();
    if (S.source === 'file') video.addEventListener('ended', () => finish(), { once: true });
  }

  function finish() {
    if (S.phase !== 'live') return;
    S.summary = S.coach ? S.coach.summary() : { reps: 0, avgScore: null, faults: [], partials: 0, holdSec: 0, repLog: [] };
    stopAll();
    S.phase = 'summary';
    draw();
    coachSay(hold ? L.holdDone : L.setDone);
  }

  layer = openStage({
    temp: 'coach',
    html: '',
    onClose() { stopAll(); clearTimeout(S.cueTimer); setVoiceEnabled(state.settings.voice !== false); },
    actions: {
      facing(b) { S.facing = b.dataset.v; draw(); },
      model(b) { S.model = b.dataset.v; update((st) => { st.settings.poseModel = S.model; }); draw(); },
      voice() { S.voice = !S.voice; setVoiceEnabled(S.voice); if (S.phase === 'setup') draw(); else { const b = document.querySelector('.stage [data-act="voice"]'); if (b) b.innerHTML = icon(S.voice ? 'volume' : 'mute'); } },
      camGo() { startLive(null); },
      file(input) { const f = input.files?.[0]; if (f) startLive(f); },
      finish,
      retry() { S.phase = 'setup'; draw(); },
      again() {
        S.phase = 'setup'; S.targetSaid = false; S.okSince = 0; S.frames = [];
        draw();
      },
      done() {
        const sum = S.summary;
        if (opts.onDone) {
          layer.actions.close();
          opts.onDone(sum);
          return;
        }
        if ((sum.reps || sum.holdSec) && isPro()) {
          update((s) => {
            const set = { reps: hold ? sum.holdSec : sum.reps, kg: 0, form: sum.avgScore };
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
