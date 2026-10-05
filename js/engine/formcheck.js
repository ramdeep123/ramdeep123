// Turns MediaPipe pose landmarks into joint metrics, counts reps with a
// hysteresis state machine, and raises a form cue only when a mistake is real:
// landmarks must be clearly visible, live faults must persist, and per-rep
// faults must repeat before the coach speaks up.

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

function angle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
  return (Math.acos(clamp((v1x * v2x + v1y * v2y) / d, -1, 1)) * 180) / Math.PI;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Compute joint metrics in pixel space. lm: 33 normalized landmarks. */
export function computeMetrics(lm, w, h, view = 'side') {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const sideOf = (o) => ({ sh: P(11 + o), el: P(13 + o), wr: P(15 + o), hip: P(23 + o), kn: P(25 + o), an: P(27 + o), heel: P(29 + o), toe: P(31 + o) });
  const L = sideOf(0), R = sideOf(1);
  const visSum = (S) => S.sh.v + S.el.v + S.wr.v + S.hip.v + S.kn.v + S.an.v;
  const B = visSum(L) >= visSum(R) ? L : R;

  const kneeL = angle(L.hip, L.kn, L.an), kneeR = angle(R.hip, R.kn, R.an);
  const hipL = angle(L.sh, L.hip, L.kn), hipR = angle(R.sh, R.hip, R.kn);
  const elbowL = angle(L.sh, L.el, L.wr), elbowR = angle(R.sh, R.el, R.wr);
  const armAbdL = angle(L.hip, L.sh, L.el), armAbdR = angle(R.hip, R.sh, R.el);

  const tvx = B.sh.x - B.hip.x, tvy = B.sh.y - B.hip.y;
  const torsoLen = Math.hypot(tvx, tvy) || 1;
  const torsoLean = (Math.acos(clamp(-tvy / torsoLen, -1, 1)) * 180) / Math.PI;

  let sag = 0;
  const dx = B.an.x - B.sh.x;
  if (Math.abs(dx) > torsoLen * 0.5) {
    const lineY = B.sh.y + ((B.an.y - B.sh.y) * (B.hip.x - B.sh.x)) / dx;
    sag = (B.hip.y - lineY) / torsoLen;
  }

  const shoulderW = dist(L.sh, R.sh) || 1;
  const footDx = Math.abs(B.toe.x - B.heel.x) || 1;
  const footPitch = (Math.atan2(B.heel.y - B.toe.y, footDx) * 180) / Math.PI;

  const knee = view === 'front' ? (kneeL + kneeR) / 2 : angle(B.hip, B.kn, B.an);
  const hip = view === 'front' ? (hipL + hipR) / 2 : angle(B.sh, B.hip, B.kn);
  const elbow = view === 'front' ? (elbowL + elbowR) / 2 : angle(B.sh, B.el, B.wr);

  return {
    knee, kneeL, kneeR, kneeMin: Math.min(kneeL, kneeR),
    hip, hipL, hipR, hipMin: Math.min(hipL, hipR),
    elbow, elbowL, elbowR, elbowAvg: (elbowL + elbowR) / 2,
    armAbd: (armAbdL + armAbdR) / 2, armAbdL, armAbdR,
    asym: Math.abs(elbowL - elbowR),
    torsoLean,
    bodyLine: angle(B.sh, B.hip, B.an),
    sag,
    upperArm: angle(B.hip, B.sh, B.el),
    ankleSpread: dist(L.an, R.an) / shoulderW,
    footPitch,
    side: B === L ? 'L' : 'R',
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

const PRAISE = ['Good rep', 'Nice control', "That's it", 'Clean rep', 'Strong'];
const NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
export const spokenNumber = (n) => NUMBERS[n - 1] || String(n);

/**
 * Stateful coach for one exercise.
 * update() returns a frame report; events go to the callbacks:
 *   onRep({count, score, faults}), onCue({msg, kind}), onPartial()
 */
export class FormCoach {
  constructor(ex, cb = {}) {
    this.ex = ex;
    this.t = ex.track;
    this.cb = cb;
    this.mode = this.t.mode || 'reps';
    this.state = 'wait';
    this.count = 0;
    this.partials = 0;
    this.scores = [];
    this.faultLog = {};
    this.recentRepFaults = [];
    this.liveSince = {};
    this.lastCueAt = {};
    this.lastAnyCue = -1e9;
    this.holdMs = 0;
    this.totalMs = 0;
    this.prevT = null;
    this.smooth = null;
    this.flagged = new Set();
    this.lastMetrics = null;
  }

  smoothLandmarks(lm) {
    if (!this.smooth) {
      this.smooth = lm.map((p) => ({ ...p }));
      return this.smooth;
    }
    const a = 0.55;
    for (let i = 0; i < lm.length; i++) {
      const s = this.smooth[i], p = lm[i];
      s.x += a * (p.x - s.x); s.y += a * (p.y - s.y); s.z += a * ((p.z || 0) - (s.z || 0));
      s.visibility = p.visibility;
    }
    return this.smooth;
  }

  inRest(v) { return this.t.dir === 'down' ? v >= this.t.rest : v <= this.t.rest; }
  inActive(v) { return this.t.dir === 'down' ? v <= this.t.active : v >= this.t.active; }
  beyondPartial(v) { return this.t.dir === 'down' ? v <= this.t.partial : v >= this.t.partial; }

  /** 0 at rest threshold, 1 at active threshold. */
  progress(v) {
    const { rest, active } = this.t;
    return clamp((v - rest) / (active - rest), 0, 1);
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

  /**
   * @param lm normalized landmarks (33)
   * @param w,h pixel size of the analysed frame
   * @param now ms timestamp
   */
  update(lm, w, h, now) {
    const dt = this.prevT == null ? 0 : Math.min(250, now - this.prevT);
    this.prevT = now;
    if (!lm) return { visible: false, reason: 'none' };
    const s = this.smoothLandmarks(lm);
    const vis = visibility(s, this.t.need || ['sh', 'hip'], this.t.view);
    if (vis < 0.5) {
      this.liveSince = {};
      return { visible: false, reason: 'partial', vis };
    }
    const m = computeMetrics(s, w, h, this.t.view);
    this.lastMetrics = m;
    this.flagged = new Set();

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
      return { visible: true, metrics: m, holdMs: this.holdMs, totalMs: this.totalMs, ok, flagged: this.flagged };
    }

    const v = m[this.t.metric];
    if (this.state === 'wait' && this.inRest(v)) this.state = 'rest';
    else if (this.state === 'rest' && !this.inRestWithMargin(v)) {
      this.state = 'rep';
      this.rep = { start: now, min: { ...m }, max: { ...m }, reachedActive: false, faults: new Set() };
    } else if (this.state === 'rep') {
      const r = this.rep;
      for (const k of Object.keys(m)) {
        if (typeof m[k] !== 'number') continue;
        if (m[k] < r.min[k]) r.min[k] = m[k];
        if (m[k] > r.max[k]) r.max[k] = m[k];
      }
      if (this.inActive(v)) r.reachedActive = true;
      if (this.inRest(v)) this.finishRep(now);
    }
    return {
      visible: true, metrics: m, value: v, progress: this.progress(v), state: this.state,
      count: this.count, flagged: this.flagged,
    };
  }

  inRestWithMargin(v) {
    const margin = 4;
    return this.t.dir === 'down' ? v >= this.t.rest - margin : v <= this.t.rest + margin;
  }

  finishRep(now) {
    const r = this.rep;
    this.rep = null;
    this.state = 'rest';
    const key = this.t.metric;
    const peak = this.t.dir === 'down' ? r.min[key] : r.max[key];
    if (!r.reachedActive) {
      if (this.beyondPartial(peak)) {
        this.partials++;
        this.logFault('partial', this.t.partialMsg);
        this.cue(this.t.partialMsg, 'fix', now, 'partial');
        this.cb.onPartial?.();
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
    this.cb.onRep?.({ count: this.count, score, faults: [...r.faults] });
    if (r.faults.size === 0 && this.count % 4 === 0) {
      this.cue(PRAISE[(this.count / 4) % PRAISE.length | 0], 'good', now, 'praise');
    }
  }

  summary() {
    const avg = this.scores.length ? Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length) : null;
    const holdPct = this.totalMs ? Math.round((this.holdMs / this.totalMs) * 100) : null;
    return {
      reps: this.count,
      partials: this.partials,
      avgScore: this.mode === 'hold' ? holdPct : avg,
      best: this.scores.length ? Math.max(...this.scores) : null,
      holdSec: Math.round(this.holdMs / 1000),
      faults: Object.values(this.faultLog).sort((a, b) => b.count - a.count),
    };
  }
}
