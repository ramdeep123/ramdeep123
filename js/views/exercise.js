// Exercise detail stage (animated coach) + static thumbnails.

import { BY_ID, MUSCLE_LABEL, EQUIP_LABEL } from '../engine/exercises.js';
import { FigureView, segmentsFor } from '../engine/figure.js';
import { esc } from '../engine/util.js';
import { icon, openStage } from '../ui.js';
import { gate } from '../core.js';

export function paintThumbs(root) {
  root.querySelectorAll('canvas[data-thumb]').forEach((c) => {
    const ex = BY_ID[c.dataset.thumb];
    if (!ex) return;
    const fv = new FigureView(c, ex.anim, { floor: false, measure: false, path: false, pad: 5, glow: segmentsFor(ex.muscles.primary) });
    fv.renderStatic();
  });
}

export const thumb = (id) => `<canvas data-thumb="${id}" aria-hidden="true"></canvas>`;

export function cameraChecks(ex) {
  if (!ex.track) return null;
  const list = [];
  if (ex.track.mode === 'hold') list.push('Times only the seconds you hold good position');
  else list.push('Counts full reps only — partial reps don\u2019t count', `If you stop short: \u201c${ex.track.partialMsg}\u201d`);
  for (const r of ex.track.rules || []) list.push(r.msg);
  if (!ex.track.fast && ex.track.mode !== 'hold') list.push('Flags rushed reps under one second');
  return list;
}

export function figureStage(ex, { speed = 1 } = {}) {
  return `<div class="fig-stage">
    <canvas id="exFig" aria-label="Animated demonstration of ${esc(ex.name)}"></canvas>
    <div class="fig-hud"><span class="phase" id="exPhase">Ready</span><span class="reps" id="exRep">0</span></div>
    <div class="fig-ctrl">
      <button class="chip" data-act="exSpeed" data-speed="0.5" aria-pressed="${speed === 0.5}">0.5×</button>
      <button class="chip" data-act="exSpeed" data-speed="1" aria-pressed="${speed === 1}">1×</button>
      <button class="icon-btn" data-act="exPause" aria-label="Pause">${icon('pause')}</button>
    </div>
  </div>`;
}

export function mountFigure(el, ex) {
  const canvas = el.querySelector('#exFig');
  const phase = el.querySelector('#exPhase');
  const rep = el.querySelector('#exRep');
  const fv = new FigureView(canvas, ex.anim, {
    glow: segmentsFor(ex.muscles.primary),
    onPhase: ({ label, rep: r }) => { phase.textContent = label; rep.textContent = String(r); },
  });
  fv.start();
  return fv;
}

export function openExercise(id, { onCoach } = {}) {
  const ex = BY_ID[id];
  if (!ex) return;
  let fv = null;
  const checks = cameraChecks(ex);
  const muscles = [...ex.muscles.primary.map((m) => `<span class="tag hot">${MUSCLE_LABEL[m]}</span>`), ...ex.muscles.secondary.map((m) => `<span class="tag">${MUSCLE_LABEL[m]}</span>`)].join('');
  openStage({
    temp: 'train',
    html: `<div class="stage-bar">
        <button class="icon-btn" data-act="close" aria-label="Close">${icon('back')}</button>
        <span class="eyebrow">${esc(EQUIP_LABEL[ex.equip] || '')} · ${ex.anim.view === 'front' ? 'Front view' : 'Side view'}</span>
        <span style="width:42px"></span>
      </div>
      <div class="stack" style="gap:6px">
        <h1 class="display" style="font-size:46px">${esc(ex.name)}</h1>
        ${ex.alias ? `<span class="faint mono small">${esc(ex.alias)}</span>` : ''}
      </div>
      ${figureStage(ex)}
      <div class="chips">${muscles}</div>
      ${ex.track
        ? `<button class="btn block" data-act="coachIt">${icon('camera')} Check my form with camera</button>`
        : '<div class="banner">' + icon('info') + '<span class="grow">Camera tracking isn’t available for this move yet. Follow the animated coach and log your sets.</span></div>'}
      <section class="card">
        <span class="eyebrow">How to do it</span>
        <ol class="steps">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </section>
      <section class="card">
        <span class="eyebrow">Coach cues</span>
        <div class="chips">${ex.cues.map((c) => `<span class="chip static">${esc(c)}</span>`).join('')}</div>
      </section>
      <section class="card">
        <span class="eyebrow">Common mistakes</span>
        <ul class="bullets bad">${ex.mistakes.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </section>
      ${checks ? `<section class="card"><span class="eyebrow">What the camera checks</span><ul class="bullets">${checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}`,
    mount(el) { fv = mountFigure(el, ex); },
    onClose() { fv?.stop(); },
    actions: {
      exSpeed(el) {
        fv?.setSpeed(parseFloat(el.dataset.speed));
        el.parentElement.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      },
      exPause(el) {
        if (!fv) return;
        if (fv.running) { fv.stop(); el.innerHTML = icon('play'); el.setAttribute('aria-label', 'Play'); }
        else { fv.opts.force = true; fv.start(); el.innerHTML = icon('pause'); el.setAttribute('aria-label', 'Pause'); }
      },
      coachIt() {
        gate('coach', async () => {
          const { openCoach } = await import('./coach.js');
          openCoach(ex.id, { onDone: onCoach });
        });
      },
    },
  });
}
