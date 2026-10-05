// "Holo-mannequin" animation engine.
// Exercises are authored as keyframed poses (angles + 2-bone IK targets),
// solved with forward kinematics every frame so bone lengths never stretch.
//
// World units: the figure is ~175 units tall, floor at y = 0, y grows downward
// (screen convention), side views face +x.

import { lerp, rad, easeInOut, clamp } from './util.js';

export const LEN = {
  torso: 50, shoulderAt: 45, neck: 8, head: 10.5,
  upperArm: 28, foreArm: 25, grip: 4,
  thigh: 42, shin: 41, foot: 13,
  shoulderHalf: 17, hipHalf: 9,
};

const W = { torso: 18, upperArm: 9, foreArm: 7.5, thigh: 12.5, shin: 9.5, foot: 5.5, neck: 6 };

export const THERMAL = ['#2A1A6E', '#7B2BB0', '#E3367A', '#FF6A2B', '#FFC24B', '#FFF1C9'];

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const THERMAL_RGB = THERMAL.map(hexToRgb);

/** Thermal ramp: 0 = cold indigo, 1 = white-hot. */
export function heatColor(t, alpha = 1) {
  t = clamp(t, 0, 1) * (THERMAL_RGB.length - 1);
  const i = Math.min(THERMAL_RGB.length - 2, Math.floor(t));
  const f = t - i;
  const a = THERMAL_RGB[i], b = THERMAL_RGB[i + 1];
  const c = a.map((v, k) => Math.round(lerp(v, b[k], f)));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

// ---------- vector helpers ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const rot = (v, r) => [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)];

/** limb angle: 0 = straight down, +90 = forward (+x), 180 = up */
const limbDir = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
/** torso angle: 0 = straight up, +90 = forward (+x) */
const torsoDir = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];

function dirFor(a, side, view) {
  const d = limbDir(a);
  if (view === 'front' && side === 'L') d[0] = -d[0];
  return d;
}

/** Two-bone IK. Returns [middleJoint, endJoint]. hint biases the bend side. */
export function ik2(A, T, l1, l2, hint = [1, 0]) {
  const v = sub(T, A);
  let d = len(v);
  const u = d > 1e-6 ? mul(v, 1 / d) : [0, 1];
  d = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.001);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);
  const b1 = add(A, mul(rot(u, a), l1));
  const b2 = add(A, mul(rot(u, -a), l1));
  const B = dot(sub(b1, A), hint) >= dot(sub(b2, A), hint) ? b1 : b2;
  const E = add(B, mul(norm(sub(add(A, mul(u, d)), B)), l2));
  return [B, E];
}

// ---------- pose interpolation ----------
export function mix(a, b, t) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mix(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = mix(a[k], b[k], t);
    return out;
  }
  return t < 0.5 ? a : b;
}

// ---------- solver ----------
export function solve(pose, view = 'side', ground = true) {
  const J = {};
  const p = pose.pelvis ? [...pose.pelvis] : [0, -86];
  const td = torsoDir(pose.torso ?? 0);
  const fwd = [-td[1], td[0]];
  J.td = td; J.fwd = fwd;
  J.pelvis = p;
  J.neck = add(p, mul(td, LEN.torso));
  const h = rad(pose.head ?? 0);
  J.headDir = norm(add(mul(td, Math.cos(h)), mul(fwd, Math.sin(h))));
  J.head = add(J.neck, mul(J.headDir, LEN.neck + LEN.head));
  const sc = add(p, mul(td, LEN.shoulderAt));
  if (view === 'front') {
    J.shoulderL = add(sc, mul(fwd, -LEN.shoulderHalf));
    J.shoulderR = add(sc, mul(fwd, LEN.shoulderHalf));
    J.hipL = add(p, mul(fwd, -LEN.hipHalf));
    J.hipR = add(p, mul(fwd, LEN.hipHalf));
  } else {
    J.shoulderL = J.shoulderR = sc;
    J.hipL = J.hipR = p;
  }

  const target = (t, S) => {
    if (Array.isArray(t)) return t;
    const base = J[t.rel] ?? J[t.rel + S] ?? p;
    let out = [...base];
    if (t.fwd || t.up) out = add(add(out, mul(fwd, t.fwd || 0)), mul(td, t.up || 0));
    if (t.x || t.y) out = add(out, [t.x || 0, t.y || 0]);
    return out;
  };

  for (const S of ['L', 'R']) {
    const arm = pose['arm' + S] || { up: 0, lo: 0 };
    const sh = J['shoulder' + S];
    let el, wr;
    if (arm.ik) {
      const hint = arm.hint ? [...arm.hint] : [-1, 0];
      if (view === 'front' && S === 'L') hint[0] = -hint[0];
      [el, wr] = ik2(sh, target(arm.ik, S), LEN.upperArm, LEN.foreArm, hint);
    } else {
      el = add(sh, mul(dirFor(arm.up ?? 0, S, view), LEN.upperArm));
      wr = add(el, mul(dirFor(arm.lo ?? arm.up ?? 0, S, view), LEN.foreArm));
    }
    J['elbow' + S] = el;
    J['wrist' + S] = wr;
    J['hand' + S] = add(wr, mul(norm(sub(wr, el)), LEN.grip));

    const leg = pose['leg' + S] || { up: 0, lo: 0 };
    const hp = J['hip' + S];
    let kn, an;
    if (leg.ik) {
      const hint = leg.hint ? [...leg.hint] : [1, 0];
      if (view === 'front' && S === 'L') hint[0] = -hint[0];
      [kn, an] = ik2(hp, target(leg.ik, S), LEN.thigh, LEN.shin, hint);
    } else {
      kn = add(hp, mul(dirFor(leg.up ?? 0, S, view), LEN.thigh));
      an = add(kn, mul(dirFor(leg.lo ?? leg.up ?? 0, S, view), LEN.shin));
    }
    J['knee' + S] = kn;
    J['ankle' + S] = an;
    if (view === 'front') {
      J['toe' + S] = add(an, [S === 'L' ? -5 : 5, 4]);
    } else {
      const fa = pose['foot' + S] ?? 90;
      J['toe' + S] = add(an, mul(limbDir(fa), LEN.foot));
    }
  }

  if (ground) {
    const low = Math.max(J.ankleL[1] + 4.5, J.ankleR[1] + 4.5, J.toeL[1] + 2.8, J.toeR[1] + 2.8);
    const lift = pose.lift ?? 0;
    const dy = -low - lift;
    for (const k of Object.keys(J)) {
      if (k === 'td' || k === 'fwd' || k === 'headDir') continue;
      J[k] = [J[k][0], J[k][1] + dy];
    }
  }
  return J;
}

// ---------- timeline ----------
export function cycleLength(anim) {
  return anim.frames.reduce((s, f) => s + (f.hold || 0) + (f.dur || 0), 0);
}

export function sample(anim, time) {
  const T = cycleLength(anim);
  const rep = Math.floor(time / T);
  let t = ((time % T) + T) % T;
  const n = anim.frames.length;
  for (let i = 0; i < n; i++) {
    const f = anim.frames[i];
    const next = anim.frames[(i + 1) % n];
    if (t < (f.hold || 0)) return { pose: f.pose, label: f.holdLabel || f.label || '', rep, i, k: 0 };
    t -= f.hold || 0;
    if (t < (f.dur || 0)) {
      const k = f.ease === 'linear' ? t / f.dur : easeInOut(t / f.dur);
      return { pose: mix(f.pose, next.pose, k), label: f.label || '', rep, i, k: t / f.dur };
    }
    t -= f.dur || 0;
  }
  return { pose: anim.frames[0].pose, label: anim.frames[0].label || '', rep, i: 0, k: 0 };
}

// ---------- drawing ----------
export const STYLE = {
  holo: {
    body: '#251F38', rim: 'rgba(160,146,214,0.55)', rimFar: 'rgba(120,108,170,0.28)',
    far: '#1A1628', joint: '#F4EFF7', visor: '#FFC24B',
    glowA: '#FF6A2B', glowB: '#FFC24B', glowShadow: 'rgba(255,106,43,0.85)',
    floor: 'rgba(255,106,43,0.22)', grid: 'rgba(160,146,214,0.10)', prop: '#3A3352', propRim: 'rgba(255,194,75,0.55)',
  },
  ghost: {
    body: 'rgba(79,216,208,0.16)', rim: 'rgba(79,216,208,0.85)', rimFar: 'rgba(79,216,208,0.35)',
    far: 'rgba(79,216,208,0.08)', joint: '#BFF5EE', visor: '#BFF5EE',
    glowA: '#4FD8D0', glowB: '#BFF5EE', glowShadow: 'rgba(79,216,208,0.9)',
    floor: 'rgba(79,216,208,0.25)', grid: 'rgba(79,216,208,0.08)', prop: 'rgba(79,216,208,0.18)', propRim: 'rgba(79,216,208,0.6)',
  },
};

const MUSCLE_SEG = {
  chest: ['torso'], abs: ['torso'], core: ['torso'], back: ['torso'], lats: ['torso'], traps: ['torso'],
  delts: ['delts'], biceps: ['upperArm'], triceps: ['upperArm'], forearms: ['foreArm'],
  quads: ['thigh'], hamstrings: ['thigh'], glutes: ['glutes'], calves: ['shin'], adductors: ['thigh'],
};

export function segmentsFor(muscles = []) {
  const s = new Set();
  for (const m of muscles) for (const seg of MUSCLE_SEG[m] || []) s.add(seg);
  return s;
}

function capsule(ctx, a, b, w, fill, rim, glow) {
  ctx.lineCap = 'round';
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = w + 2.4;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow.shadow;
    ctx.shadowBlur = glow.blur;
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, glow.a); g.addColorStop(1, glow.b);
    ctx.strokeStyle = g;
  } else {
    ctx.strokeStyle = fill;
  }
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  if (glow) ctx.restore();
}

function dot2(ctx, p, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
}

function drawPlate(ctx, c, style, dim) {
  ctx.save();
  ctx.globalAlpha = dim ? 0.45 : 1;
  ctx.fillStyle = style.prop;
  ctx.strokeStyle = style.propRim;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(c[0], c[1], 21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(c[0], c[1], 14, 0, Math.PI * 2); ctx.stroke();
  dot2(ctx, c, 3.2, style.propRim);
  ctx.restore();
}

function drawProps(ctx, J, props, style, layer, view) {
  for (const pr of props || []) {
    const type = pr.type || pr;
    if (type === 'barbell') {
      const c = mul(add(J.handL, J.handR), 0.5);
      if (view === 'front') {
        if (layer !== 'front') continue;
        ctx.strokeStyle = style.propRim; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(c[0] - 62, c[1]); ctx.lineTo(c[0] + 62, c[1]); ctx.stroke();
        for (const s of [-1, 1]) {
          ctx.fillStyle = style.prop; ctx.strokeStyle = style.propRim; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.roundRect(c[0] + s * 50 - 4, c[1] - 21, 8, 42, 2); ctx.fill(); ctx.stroke();
        }
      } else {
        drawPlate(ctx, c, style, layer === 'back');
      }
    } else if (type === 'dumbbell') {
      if (layer !== 'front') continue;
      for (const S of ['L', 'R']) {
        const h = J['hand' + S];
        if (view === 'front' && pr.axis !== 'end') {
          ctx.strokeStyle = style.propRim; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(h[0] - 9, h[1]); ctx.lineTo(h[0] + 9, h[1]); ctx.stroke();
          for (const s of [-1, 1]) {
            ctx.fillStyle = style.prop; ctx.strokeStyle = style.propRim; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.roundRect(h[0] + s * 10 - 3, h[1] - 7, 6, 14, 2); ctx.fill(); ctx.stroke();
          }
        } else {
          ctx.save();
          if (S === 'L' && view !== 'front') ctx.globalAlpha = 0.5;
          ctx.fillStyle = style.prop; ctx.strokeStyle = style.propRim; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(h[0], h[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
    } else if (type === 'bench' || type === 'box') {
      if (layer !== 'back') continue;
      const [x0, y0, x1, y1] = pr.rect;
      ctx.fillStyle = style.prop; ctx.strokeStyle = style.propRim; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, 7, 3); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 + 8, y0 + 7); ctx.lineTo(x0 + 8, y1);
      ctx.moveTo(x1 - 8, y0 + 7); ctx.lineTo(x1 - 8, y1);
      ctx.stroke();
    } else if (type === 'bar') {
      if (layer !== 'back') continue;
      ctx.strokeStyle = style.propRim; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pr.x0, pr.y); ctx.lineTo(pr.x1, pr.y); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = style.grid.replace('0.10', '0.35');
      ctx.beginPath(); ctx.moveTo(pr.x0, pr.y); ctx.lineTo(pr.x0, 0); ctx.moveTo(pr.x1, pr.y); ctx.lineTo(pr.x1, 0); ctx.stroke();
    } else if (type === 'wall') {
      if (layer !== 'back') continue;
      ctx.fillStyle = style.grid; ctx.fillRect(pr.x - 14, -190, 14, 190);
      ctx.strokeStyle = style.propRim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pr.x, -190); ctx.lineTo(pr.x, 0); ctx.stroke();
    } else if (type === 'mat') {
      if (layer !== 'back') continue;
      ctx.fillStyle = style.floor; ctx.beginPath(); ctx.roundRect(pr.x0, -3, pr.x1 - pr.x0, 3, 1.5); ctx.fill();
    }
  }
}

/**
 * Draw one solved figure.
 * opts: { view, style, glow:Set, heat:{seg:0..1}, props, scale }
 */
export function drawFigure(ctx, J, opts = {}) {
  const view = opts.view || 'side';
  const st = STYLE[opts.style || 'holo'];
  const glowSet = opts.glow || new Set();
  const heat = opts.heat;
  const glowFor = (seg) => {
    if (heat && heat[seg] != null) {
      const v = heat[seg];
      return { a: heatColor(0.15 + v * 0.75), b: heatColor(0.25 + v * 0.75), shadow: heatColor(0.3 + v * 0.7, v * 0.8), blur: 6 + v * 14 };
    }
    return glowSet.has(seg) ? { a: st.glowA, b: st.glowB, shadow: st.glowShadow, blur: 16 } : null;
  };

  drawProps(ctx, J, opts.props, st, 'back', view);

  const limbs = (S, far) => {
    const fill = far ? st.far : st.body;
    const rim = far ? st.rimFar : st.rim;
    const g = (seg) => (far && view !== 'front' ? null : glowFor(seg));
    capsule(ctx, J['hip' + S], J['knee' + S], W.thigh, fill, rim, g('thigh'));
    capsule(ctx, J['knee' + S], J['ankle' + S], W.shin, fill, rim, g('shin'));
    capsule(ctx, J['ankle' + S], J['toe' + S], W.foot, fill, rim, null);
  };
  const arms = (S, far) => {
    const fill = far ? st.far : st.body;
    const rim = far ? st.rimFar : st.rim;
    const g = (seg) => (far && view !== 'front' ? null : glowFor(seg));
    capsule(ctx, J['shoulder' + S], J['elbow' + S], W.upperArm, fill, rim, g('upperArm'));
    capsule(ctx, J['elbow' + S], J['wrist' + S], W.foreArm, fill, rim, g('foreArm'));
    dot2(ctx, J['hand' + S], 4, far && view !== 'front' ? st.rimFar : st.rim);
  };

  if (view !== 'front') {
    arms('L', true);
    limbs('L', true);
  } else {
    limbs('L', false);
    limbs('R', false);
  }

  // torso
  const tg = glowFor('torso');
  if (view === 'front') {
    const lat = J.fwd;
    const pts = [
      add(J.shoulderL, mul(lat, -4)), add(J.shoulderR, mul(lat, 4)),
      add(add(J.pelvis, mul(J.td, 22)), mul(lat, 11)), add(J.hipR, mul(lat, 4)),
      add(J.hipL, mul(lat, -4)), add(add(J.pelvis, mul(J.td, 22)), mul(lat, -11)),
    ];
    ctx.save();
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.rim; ctx.lineWidth = 2.4;
    if (tg) {
      ctx.shadowColor = tg.shadow; ctx.shadowBlur = tg.blur;
      const gr = ctx.createLinearGradient(J.neck[0], J.neck[1], J.pelvis[0], J.pelvis[1]);
      gr.addColorStop(0, tg.a); gr.addColorStop(1, tg.b);
      ctx.fillStyle = gr;
    } else ctx.fillStyle = st.body;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  } else {
    const mid = add(J.pelvis, mul(J.td, LEN.torso * 0.45));
    const chest = add(J.pelvis, mul(J.td, LEN.shoulderAt - 4));
    capsule(ctx, J.pelvis, mid, W.torso - 2, st.body, st.rim, tg);
    capsule(ctx, mid, chest, W.torso + 1, st.body, st.rim, tg);
  }
  const gg = glowFor('glutes');
  if (gg) {
    ctx.save(); ctx.shadowColor = gg.shadow; ctx.shadowBlur = gg.blur;
    const off = view === 'front' ? [0, 0] : mul(J.fwd, -4);
    dot2(ctx, add(J.pelvis, off), 8.5, gg.a); ctx.restore();
  }
  capsule(ctx, J.neck, add(J.neck, mul(J.headDir, LEN.neck)), W.neck, st.body, st.rim, null);

  // head
  ctx.fillStyle = st.body; ctx.strokeStyle = st.rim; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(J.head[0], J.head[1], LEN.head, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = st.visor; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath();
  if (opts.noFace) {
    // back view: no visor
  } else if (view === 'front') {
    ctx.moveTo(J.head[0] - 5.5, J.head[1] - 1); ctx.lineTo(J.head[0] + 5.5, J.head[1] - 1);
  } else {
    const fa = Math.atan2(J.fwd[1], J.fwd[0]);
    const face = Math.atan2(J.fwd[1] * 0.9 + J.headDir[1] * 0.1, J.fwd[0] * 0.9 + J.headDir[0] * 0.1) || fa;
    ctx.arc(J.head[0], J.head[1], LEN.head - 3.2, face - 0.75, face + 0.75);
  }
  ctx.stroke();

  if (view !== 'front') {
    limbs('R', false);
    arms('R', false);
  } else {
    arms('L', false);
    arms('R', false);
  }

  const dg = glowFor('delts');
  for (const S of view === 'front' ? ['L', 'R'] : ['R']) {
    if (dg) { ctx.save(); ctx.shadowColor = dg.shadow; ctx.shadowBlur = dg.blur; dot2(ctx, J['shoulder' + S], 7.5, dg.a); ctx.restore(); }
  }
  for (const k of ['kneeR', 'elbowR', 'pelvis', ...(view === 'front' ? ['kneeL', 'elbowL'] : [])]) {
    dot2(ctx, J[k], 2.3, st.joint);
  }

  drawProps(ctx, J, opts.props, st, 'front', view);
}

function jointAngle(a, b, c) {
  const v1 = sub(a, b), v2 = sub(c, b);
  const cos = dot(v1, v2) / ((len(v1) * len(v2)) || 1);
  return (Math.acos(clamp(cos, -1, 1)) * 180) / Math.PI;
}

function drawMeasure(ctx, J, m, scale) {
  const [a, b, c] = m.joints.map((k) => J[k]);
  const ang = jointAngle(a, b, c);
  const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = a2 - a1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,194,75,0.9)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([2.5, 2.5]);
  ctx.beginPath();
  ctx.arc(b[0], b[1], 17, a1, a1 + d, d < 0);
  ctx.stroke();
  ctx.setLineDash([]);
  const mid = a1 + d / 2;
  const tp = [b[0] + Math.cos(mid) * 30, b[1] + Math.sin(mid) * 30];
  ctx.fillStyle = '#FFC24B';
  ctx.font = `600 ${11 / Math.max(0.6, scale) * 1}px "Martian Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(ang)}°`, tp[0], tp[1]);
  ctx.restore();
}

function drawFloor(ctx, cx, halfW, st) {
  ctx.save();
  ctx.strokeStyle = st.grid;
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 22, 0);
    ctx.lineTo(cx + i * 46, 34);
    ctx.stroke();
  }
  for (let j = 1; j <= 3; j++) {
    const y = j * j * 3.6;
    ctx.beginPath(); ctx.moveTo(cx - halfW, y); ctx.lineTo(cx + halfW, y); ctx.stroke();
  }
  const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, st.floor); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = g; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - halfW, 0); ctx.lineTo(cx + halfW, 0); ctx.stroke();
  ctx.restore();
}

function bounds(anim) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = 0;
  const T = cycleLength(anim);
  const ground = anim.ground !== false;
  for (let i = 0; i <= 36; i++) {
    const s = sample(anim, (T * i) / 36);
    const J = solve(s.pose, anim.view, ground);
    for (const [k, v] of Object.entries(J)) {
      if (!Array.isArray(v) || k === 'td' || k === 'fwd' || k === 'headDir') continue;
      const r = k === 'head' ? LEN.head + 3 : 8;
      x0 = Math.min(x0, v[0] - r); x1 = Math.max(x1, v[0] + r);
      y0 = Math.min(y0, v[1] - r); y1 = Math.max(y1, v[1] + r);
    }
    if ((anim.props || []).some((p) => (p.type || p) === 'barbell') && anim.view !== 'front') {
      const c = mul(add(J.handL, J.handR), 0.5);
      x0 = Math.min(x0, c[0] - 23); x1 = Math.max(x1, c[0] + 23); y0 = Math.min(y0, c[1] - 23);
    }
  }
  for (const p of anim.props || []) {
    if (p.rect) { x0 = Math.min(x0, p.rect[0]); x1 = Math.max(x1, p.rect[2]); y0 = Math.min(y0, p.rect[1]); }
    if (p.type === 'bar') { x0 = Math.min(x0, p.x0 - 4); x1 = Math.max(x1, p.x1 + 4); y0 = Math.min(y0, p.y - 6); }
    if (p.type === 'wall') { x0 = Math.min(x0, p.x - 16); }
  }
  return { x0, x1, y0, y1: Math.max(y1, 14) };
}

/**
 * Animated canvas view for one exercise animation.
 */
export class FigureView {
  constructor(canvas, anim, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.anim = anim;
    this.opts = { style: 'holo', speed: 1, floor: true, measure: true, path: true, pad: 14, glow: new Set(), ...opts };
    this.time = opts.startTime || 0;
    this.trail = [];
    this.raf = 0;
    this.last = 0;
    this.box = bounds(anim);
    this.onPhase = opts.onPhase || null;
    this.lastLabel = null;
    this.lastRep = -1;
  }

  fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const b = this.box;
    const pad = this.opts.pad;
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const s = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    this.scale = s;
    this.tx = w / 2 - ((b.x0 + b.x1) / 2) * s;
    this.ty = h / 2 - ((b.y0 + b.y1) / 2) * s;
    this.dpr = dpr; this.w = w; this.h = h;
  }

  draw() {
    const { ctx } = this;
    this.fit();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.translate(this.tx, this.ty);
    ctx.scale(this.scale, this.scale);
    const s = sample(this.anim, this.time);
    const J = solve(s.pose, this.anim.view, this.anim.ground !== false);
    const st = STYLE[this.opts.style];
    if (this.opts.floor) {
      const cx = (this.box.x0 + this.box.x1) / 2;
      drawFloor(ctx, cx, (this.box.x1 - this.box.x0) / 2 + 30, st);
      const spread = Math.abs(J.ankleR[0] - J.ankleL[0]) + Math.abs(J.toeR[0] - J.pelvis[0]);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(J.pelvis[0], 1.5, 26 + spread * 0.4, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.opts.path && this.anim.path) {
      const key = this.anim.path;
      const pt = key === 'bar' ? mul(add(J.handL, J.handR), 0.5) : J[key];
      this.trail.push(pt);
      if (this.trail.length > 70) this.trail.shift();
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const a = i / this.trail.length;
        ctx.strokeStyle = this.opts.style === 'ghost' ? `rgba(191,245,238,${a * 0.5})` : `rgba(255,194,75,${a * 0.55})`;
        ctx.lineWidth = 1 + a * 1.6;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1][0], this.trail[i - 1][1]);
        ctx.lineTo(this.trail[i][0], this.trail[i][1]);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawFigure(ctx, J, { view: this.anim.view, style: this.opts.style, glow: this.opts.glow, props: this.anim.props });
    if (this.opts.measure && this.anim.measure) drawMeasure(ctx, J, this.anim.measure, this.scale);
    if (this.onPhase && (s.label !== this.lastLabel || s.rep !== this.lastRep)) {
      this.lastLabel = s.label;
      const newRep = s.rep !== this.lastRep;
      this.lastRep = s.rep;
      this.onPhase({ label: s.label, rep: s.rep, newRep });
    }
    return J;
  }

  tick = (now) => {
    if (!this.running) return;
    if (this.last) this.time += ((now - this.last) / 1000) * this.opts.speed;
    this.last = now;
    if (this.canvas.isConnected) this.draw();
    else { this.stop(); return; }
    this.raf = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.running) return this;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce && !this.opts.force) { this.renderStatic(); return this; }
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
    return this;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setSpeed(s) { this.opts.speed = s; }

  renderStatic(at = null) {
    const T = cycleLength(this.anim);
    const f = this.anim.frames;
    this.time = at != null ? at : (f[0].hold || 0) + (f[0].dur || 0) * 0.999 + (f[1]?.hold || 0) * 0.5;
    if (this.time > T) this.time = T * 0.4;
    this.opts.path = false;
    this.draw();
  }
}
