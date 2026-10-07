// Precision form engine.
//
// Pipeline per camera frame:
//   1. One Euro filter on every landmark (removes jitter without adding lag)
//   2. joint angles from MediaPipe's 3D world landmarks when available, so
//      angles stay correct even when you're not perfectly side-on
//   3. side lock with hysteresis (the tracked side doesn't flicker)
//   4. personal calibration of your start position before counting
//   5. hysteresis rep state machine with per-rep depth (ROM), tempo and score
//   6. faults are only voiced when real: clearly visible, persisting ~0.5 s,
//      or repeated in 2 of the last 3 reps.

import { clamp } from './util.js';

export const LM = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32,
};

export const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];

const PART_IDX = { sh: [11, 12], el: [13, 14], wr: [15, 16], hip: [23, 24], kn: [25, 26], an: [27, 28], heel: [29, 30], toe: [31, 32] };
export const JOINT_IDX = { shoulder: [11, 12], elbow: [13, 14], wrist: [15, 16], hip: [23, 24], knee: [25, 26], ankle: [27, 28] };

/** Which three landmarks (per side, L/R offset 0/1) form the angle of each metric. */
export const METRIC_JOINTS = {
  knee: [23, 25, 27], kneeMin: [23, 25, 27], hip: [11, 23, 25], hipMin: [11, 23, 25],
  elbow: [11, 13, 15], elbowAvg: [11, 13, 15], armAbd: [23, 11, 13], torsoLean: [11, 23, 25], footPitch: [29, 27, 31],
};

// ---------- geometry ----------
function angle3(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)];
  const v2 = [c.x - b.x, c.y - b.y, (c.z || 0) - (b.z || 0)];
  const d = Math.hypot(...v1) * Math.hypot(...v2) || 1;
  return (Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / d, -1, 1)) * 180) / Math.PI;
}
const flat = (p) => ({ x: p.x, y: p.y, z: 0 });
const angle2 = (a, b, c) => angle3(flat(a), flat(b), flat(c));
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

// ---------- One Euro filter ----------
class LowPass {
  constructor() { this.y = null; }
  filter(x, a) { this.y = this.y == null ? x : a * x + (1 - a) * this.y; return this.y; }
}
export class OneEuro {
  constructor({ minCutoff = 1.6, beta = 0.9, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = new LowPass(); this.dx = new LowPass(); this.t = null;
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(value, tMs) {
    if (this.t == null) { this.t = tMs; this.dx.filter(0, 1); return this.x.filter(value, 1); }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const prev = this.x.y;
    const dv = this.dx.filter((value - prev) / dt, OneEuro.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(dv);
    return this.x.filter(value, OneEuro.alpha(cutoff, dt));
  }
}

class LandmarkFilter {
  constructor(opts) { this.opts = opts; this.f = null; }
  apply(lm, tMs) {
    if (!lm) return null;
    if (!this.f) this.f = lm.map(() => [new OneEuro(this.opts), new OneEuro(this.opts), new OneEuro(this.opts)]);
    return lm.map((p, i) => ({
      x: this.f[i][0].filter(p.x, tMs),
      y: this.f[i][1].filter(p.y, tMs),
      z: this.f[i][2].filter(p.z || 0, tMs),
      visibility: p.visibility ?? 1,
    }));
  }
}

// ---------- metrics ----------
function sideVis(lm, o) {
  return [11, 13, 15, 23, 25, 27].reduce((a, i) => a + (lm[i + o].visibility ?? 1), 0);
}

/**
 * Joint metrics. lm: 33 normalized image landmarks; world: optional 33 world
 * landmarks in metres (3D). side: 'L' | 'R' to force the tracked side.
 */
export function computeMetrics(lm, w, h, view = 'side', world = null, side = null) {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, z: 0, v: lm[i].visibility ?? 1 });
  const W = world ? (i) => ({ x: world[i].x, y: world[i].y, z: world[i].z }) : P;
  const ang = world ? angle3 : angle2;
  const pick = (S, f) => ({ sh: f(11 + S), el: f(13 + S), wr: f(15 + S), hip: f(23 + S), kn: f(25 + S), an: f(27 + S), heel: f(29 + S), toe: f(31 + S) });
  const o = side ? (side === 'L' ? 0 : 1) : (sideVis(lm, 0) >= sideVis(lm, 1) ? 0 : 1);
  const L2 = pick(0, P), R2 = pick(1, P), B2 = o === 0 ? L2 : R2;
  const L3 = pick(0, W), R3 = pick(1, W), B3 = o === 0 ? L3 : R3;

  const kneeL = ang(L3.hip, L3.kn, L3.an), kneeR = ang(R3.hip, R3.kn, R3.an);
  const hipL = ang(L3.sh, L3.hip, L3.kn), hipR = ang(R3.sh, R3.hip, R3.kn);
  const elbowL = ang(L3.sh, L3.el, L3.wr), elbowR = ang(R3.sh, R3.el, R3.wr);
  const armAbdL = ang(L3.hip, L3.sh, L3.el), armAbdR = ang(R3.hip, R3.sh, R3.el);

  // torso lean from vertical (image y and world y both point down)
  const tv = [B3.sh.x - B3.hip.x, B3.sh.y - B3.hip.y, (B3.sh.z || 0) - (B3.hip.z || 0)];
  const tl = Math.hypot(...tv) || 1;
  const torsoLean = (Math.acos(clamp(-tv[1] / tl, -1, 1)) * 180) / Math.PI;

  // hip sag relative to the shoulder–ankle line, measured in the image
  const torsoLen2 = dist2(B2.sh, B2.hip) || 1;
  let sag = 0;
  const dx = B2.an.x - B2.sh.x;
  if (Math.abs(dx) > torsoLen2 * 0.5) {
    const lineY = B2.sh.y + ((B2.an.y - B2.sh.y) * (B2.hip.x - B2.sh.x)) / dx;
    sag = (B2.hip.y - lineY) / torsoLen2;
  }

  const footDx = Math.abs(B2.toe.x - B2.heel.x) || 1;
  const footPitch = (Math.atan2(B2.heel.y - B2.toe.y, footDx) * 180) / Math.PI;
  const shoulderW3 = dist3(L3.sh, R3.sh) || 1e-6;

  const knee = view === 'front' ? (kneeL + kneeR) / 2 : (o === 0 ? kneeL : kneeR);
  const hip = view === 'front' ? (hipL + hipR) / 2 : (o === 0 ? hipL : hipR);
  const elbow = view === 'front' ? (elbowL + elbowR) / 2 : (o === 0 ? elbowL : elbowR);

  return {
    knee, kneeL, kneeR, kneeMin: Math.min(kneeL, kneeR),
    hip, hipL, hipR, hipMin: Math.min(hipL, hipR),
    elbow, elbowL, elbowR, elbowAvg: (elbowL + elbowR) / 2,
    armAbd: (armAbdL + armAbdR) / 2, armAbdL, armAbdR,
    asym: Math.abs(elbowL - elbowR),
    kneeAsym: Math.abs(kneeL - kneeR),
    torsoLean,
    bodyLine: ang(B3.sh, B3.hip, B3.an),
    sag,
    upperArm: ang(B3.hip, B3.sh, B3.el),
    ankleSpread: dist3(L3.an, R3.an) / shoulderW3,
    footPitch,
    side: o === 0 ? 'L' : 'R',
  };
}

/** Minimum visibility of the parts an exercise needs. */
export function visibility(lm, need, view) {
  let min = 1;
  for (const part of need) {
    const [l, r] = PART_IDX[part];
    const v = view === 'front'
      ? Math.min(lm[l].visibility ?? 1, lm[r].visibility ?? 1)
      : Math.max(lm[l].visibility ?? 1, lm[r].visibility ?? 1);
    min = Math.min(min, v);
  }
  return min;
}

/**
 * Is the person framed well? Returns null when fine, else an issue code:
 * 'out' (cut off), 'far', 'turn-side', 'turn-front'.
 */
export function framing(lm, view) {
  const vis = (i) => (lm[i].visibility ?? 1) > 0.5;
  const pts = [0, 11, 12, 23, 24, 27, 28].filter(vis).map((i) => lm[i]);
  if (pts.length < 4) return 'out';
  const ys = pts.map((p) => p.y), xs = pts.map((p) => p.x);
  if (Math.min(...ys) < -0.02 || Math.max(...ys) > 1.02 || Math.min(...xs) < -0.02 || Math.max(...xs) > 1.02) return 'out';
  const span = Math.max(...ys) - Math.min(...ys);
  const horizontal = Math.max(...xs) - Math.min(...xs) > span; // lying or plank positions
  if (!horizontal && span < 0.35) return 'far';
  const shW = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y);
  const torso = Math.hypot((lm[11].x + lm[12].x) / 2 - (lm[23].x + lm[24].x) / 2, (lm[11].y + lm[12].y) / 2 - (lm[23].y + lm[24].y) / 2) || 1;
  if (!horizontal && view === 'side' && shW / torso > 0.62) return 'turn-side';
  if (!horizontal && view === 'front' && shW / torso < 0.3) return 'turn-front';
  return null;
}

const PRAISE = ['Good rep', 'Nice control', "That's it", 'Clean rep', 'Strong', 'Perfect depth'];
const NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-one', 'Twenty-two', 'Twenty-three', 'Twenty-four', 'Twenty-five',
  'Twenty-six', 'Twenty-seven', 'Twenty-eight', 'Twenty-nine', 'Thirty'];
export const spokenNumber = (n) => NUMBERS[n - 1] || String(n);

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/**
 * Stateful coach for one exercise.
 * update() returns a frame report; events go to the callbacks:
 *   onRep(rep), onCue({msg, kind, id}), onPartial(), onCalibrated({rest})
 * Set coach.armed = false to calibrate without counting (e.g. during a countdown).
 */
export class FormCoach {
  constructor(ex, cb = {}) {
    this.ex = ex;
    this.t = ex.track;
    this.cb = cb;
    this.mode = this.t.mode || 'reps';
    this.state = 'wait';
    this.armed = true;
    this.count = 0;
    this.partials = 0;
    this.scores = [];
    this.reps = [];
    this.faultLog = {};
    this.recentRepFaults = [];
    this.liveSince = {};
    this.lastCueAt = {};
    this.lastAnyCue = -1e9;
    this.holdMs = 0;
    this.totalMs = 0;
    this.prevT = null;
    this.flagged = new Set();
    this.lastMetrics = null;
    this.filter2d = new LandmarkFilter({ minCutoff: 1.6, beta: 0.9 });
    this.filter3d = new LandmarkFilter({ minCutoff: 1.6, beta: 1.2 });
    this.side = null;
    this.sideVotes = 0;
    this.rest = this.t.rest;
    this.calibrated = this.mode === 'hold';
    this.calib = [];
  }

  inRest(v) { return this.t.dir === 'down' ? v >= this.rest : v <= this.rest; }
  inActive(v) { return this.t.dir === 'down' ? v <= this.t.active : v >= this.t.active; }
  beyondPartial(v) { return this.t.dir === 'down' ? v <= this.t.partial : v >= this.t.partial; }

  /** 0 at your start position, 1 at full depth. */
  progress(v) {
    return clamp((v - this.rest) / (this.t.active - this.rest), 0, 1);
  }

  cue(msg, kind, now, ruleId, force = false) {
    const last = this.lastCueAt[ruleId] ?? -1e9;
    if (!force && (now - last < 7000 || now - this.lastAnyCue < 2200)) return;
    this.lastCueAt[ruleId] = now;
    this.lastAnyCue = now;
    this.cb.onCue?.({ msg, kind, id: ruleId });
  }

  logFault(id, msg) {
    const f = (this.faultLog[id] ||= { id, msg, count: 0 });
    f.count++;
  }

  lockSide(lm) {
    const vl = sideVis(lm, 0), vr = sideVis(lm, 1);
    const best = vl >= vr ? 'L' : 'R';
    if (!this.side) { this.side = best; return; }
    if (best !== this.side && Math.abs(vl - vr) > 0.6) {
      if (++this.sideVotes > 12) { this.side = best; this.sideVotes = 0; }
    } else this.sideVotes = 0;
  }

  /** Learn the user's own start position so lockout depth isn't judged against a textbook angle. */
  calibrate(v, now) {
    this.calib.push([now, v]);
    while (this.calib.length && now - this.calib[0][0] > 900) this.calib.shift();
    if (this.calib.length < 8 || now - this.calib[0][0] < 700) return;
    const vals = this.calib.map((c) => c[1]);
    if (Math.max(...vals) - Math.min(...vals) > 8) return; // not holding still yet
    const m = median(vals);
    const nearRest = this.t.dir === 'down' ? m >= this.t.rest - 25 : m <= this.t.rest + 25;
    if (!nearRest) return;
    this.rest = this.t.dir === 'down' ? Math.min(this.t.rest, m - 6) : Math.max(this.t.rest, m + 6);
    this.calibrated = true;
    this.state = 'rest';
    this.cb.onCalibrated?.({ rest: this.rest, measured: m });
  }

  /**
   * @param lm normalized image landmarks (33)
   * @param w,h pixel size of the analysed frame
   * @param now ms timestamp
   * @param world optional world landmarks (33, metres)
   */
  update(lm, w, h, now, world = null) {
    const dt = this.prevT == null ? 0 : Math.min(250, now - this.prevT);
    this.prevT = now;
    if (!lm) return { visible: false, reason: 'none' };
    const s = this.filter2d.apply(lm, now);
    const sw = world ? this.filter3d.apply(world, now) : null;
    const vis = visibility(s, this.t.need || ['sh', 'hip'], this.t.view);
    if (vis < 0.55) {
      this.liveSince = {};
      return { visible: false, reason: 'partial', vis };
    }
    this.lockSide(s);
    const m = computeMetrics(s, w, h, this.t.view, sw, this.t.view === 'side' ? this.side : null);
    this.lastMetrics = m;
    this.flagged = new Set();
    const base = { visible: true, metrics: m, landmarks: s, side: this.side };

    if (!this.armed) {
      if (this.mode !== 'hold' && !this.calibrated) this.calibrate(m[this.t.metric], now);
      return { ...base, armed: false, calibrated: this.calibrated, progress: this.mode === 'hold' ? 0 : this.progress(m[this.t.metric]) };
    }

    // live rules
    for (const r of this.t.rules || []) {
      if (!r.live) continue;
      if (r.live(m)) {
        this.liveSince[r.id] ??= now;
        if (now - this.liveSince[r.id] >= 450) {
          (r.joints || []).forEach((j) => this.flagged.add(j));
          if (this.rep && !this.rep.faults.has(r.id)) { this.rep.faults.add(r.id); this.logFault(r.id, r.msg); }
          if (this.mode === 'hold' && !this.holdFaulted?.[r.id]) { (this.holdFaulted ||= {})[r.id] = true; this.logFault(r.id, r.msg); }
          this.cue(r.msg, 'fix', now, r.id);
        }
      } else {
        delete this.liveSince[r.id];
        if (this.holdFaulted) delete this.holdFaulted[r.id];
      }
    }

    if (this.mode === 'hold') {
      this.totalMs += dt;
      const ok = this.t.ok(m);
      if (ok) this.holdMs += dt;
      return { ...base, holdMs: this.holdMs, totalMs: this.totalMs, ok, flagged: this.flagged };
    }

    const v = m[this.t.metric];
    if (this.state === 'wait') {
      if (!this.calibrated) this.calibrate(v, now);
      if (this.state === 'wait' && this.inRest(v)) this.state = 'rest';
    } else if (this.state === 'rest' && !this.inRestWithMargin(v)) {
      this.state = 'rep';
      this.rep = { start: now, min: { ...m }, max: { ...m }, peakAt: now, reachedActive: false, faults: new Set() };
    } else if (this.state === 'rep') {
      const r = this.rep;
      const key = this.t.metric;
      for (const k of Object.keys(m)) {
        if (typeof m[k] !== 'number') continue;
        if (m[k] < r.min[k]) { r.min[k] = m[k]; if (k === key && this.t.dir === 'down') r.peakAt = now; }
        if (m[k] > r.max[k]) { r.max[k] = m[k]; if (k === key && this.t.dir === 'up') r.peakAt = now; }
      }
      if (this.inActive(v)) r.reachedActive = true;
      if (this.inRest(v)) this.finishRep(now);
    }
    return { ...base, value: v, progress: this.progress(v), state: this.state, count: this.count, flagged: this.flagged };
  }

  inRestWithMargin(v) {
    const margin = 4;
    return this.t.dir === 'down' ? v >= this.rest - margin : v <= this.rest + margin;
  }

  finishRep(now) {
    const r = this.rep;
    this.rep = null;
    this.state = 'rest';
    const key = this.t.metric;
    const peak = this.t.dir === 'down' ? r.min[key] : r.max[key];
    const rom = Math.round(clamp((peak - this.rest) / (this.t.active - this.rest), 0, 1.5) * 100);
    if (!r.reachedActive) {
      if (this.beyondPartial(peak)) {
        this.partials++;
        this.logFault('partial', this.t.partialMsg);
        this.cue(this.t.partialMsg, 'fix', now, 'partial');
        this.cb.onPartial?.({ rom });
      }
      return;
    }
    const summary = { min: r.min, max: r.max, range: {}, duration: now - r.start };
    for (const k of Object.keys(r.min)) if (typeof r.min[k] === 'number') summary.range[k] = r.max[k] - r.min[k];

    const repFaults = [];
    for (const rule of this.t.rules || []) {
      if (rule.rep && rule.rep(summary)) repFaults.push(rule);
    }
    if (!this.t.fast && summary.duration < 900) {
      repFaults.push({ id: 'tempo', msg: 'Slow down — control every rep' });
    }
    for (const f of repFaults) { r.faults.add(f.id); this.logFault(f.id, f.msg); }

    // speak a per-rep fault only if it showed up in 2 of the last 3 reps
    this.recentRepFaults.push(repFaults.map((f) => f.id));
    if (this.recentRepFaults.length > 3) this.recentRepFaults.shift();
    for (const f of repFaults) {
      const seen = this.recentRepFaults.filter((ids) => ids.includes(f.id)).length;
      if (seen >= 2) this.cue(f.msg, 'fix', now, f.id);
    }

    const score = clamp(100 - r.faults.size * 15, 40, 100);
    this.count++;
    this.scores.push(score);
    const rep = {
      n: this.count, score, rom, peak: Math.round(peak),
      down: Math.round((r.peakAt - r.start) / 100) / 10,
      up: Math.round((now - r.peakAt) / 100) / 10,
      faults: [...r.faults],
    };
    this.reps.push(rep);
    this.cb.onRep?.({ count: this.count, ...rep });
    if (r.faults.size === 0 && this.count % 4 === 0) {
      this.cue(PRAISE[(this.count / 4) % PRAISE.length | 0], 'good', now, 'praise');
    }
  }

  summary() {
    const avg = this.scores.length ? Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length) : null;
    const holdPct = this.totalMs ? Math.round((this.holdMs / this.totalMs) * 100) : null;
    const roms = this.reps.map((r) => r.rom);
    const mean = roms.length ? roms.reduce((a, b) => a + b, 0) / roms.length : 0;
    const sd = roms.length > 1 ? Math.sqrt(roms.reduce((a, b) => a + (b - mean) ** 2, 0) / roms.length) : 0;
    const tempo = this.reps.length ? {
      down: Math.round((this.reps.reduce((a, r) => a + r.down, 0) / this.reps.length) * 10) / 10,
      up: Math.round((this.reps.reduce((a, r) => a + r.up, 0) / this.reps.length) * 10) / 10,
    } : null;
    return {
      reps: this.count,
      partials: this.partials,
      avgScore: this.mode === 'hold' ? holdPct : avg,
      best: this.scores.length ? Math.max(...this.scores) : null,
      holdSec: Math.round(this.holdMs / 1000),
      depth: roms.length ? Math.round(mean) : null,
      consistency: roms.length > 1 ? Math.max(0, Math.round(100 - sd * 2)) : null,
      tempo,
      repLog: this.reps,
      faults: Object.values(this.faultLog).sort((a, b) => b.count - a.count),
    };
  }
}
