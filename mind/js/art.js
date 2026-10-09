// Drawings, all inline SVG (works offline, scales, themes with CSS vars).
//  - contour(): a topographic "fingerprint" of the user's map, seeded by
//    their own answers, so every map looks like its own terrain.
//  - loopDiagram(): the trigger → urge → action → relief → cost cycle.
//  - urgeWave(): the rise-and-fall curve behind the urge timer.

import { hash, rng, esc } from './engine/util.js';

const f = (n) => Math.round(n * 10) / 10;

/** Closed smooth-ish path through points (Catmull-Rom → cubic Béziers). */
function closedPath(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

function hill(r, cx, cy, rings, gap, base, stretch = 1) {
  const waves = [0, 1, 2].map(() => ({ n: 2 + Math.floor(r() * 4), p: r() * Math.PI * 2, a: 0.04 + r() * 0.1 }));
  const paths = [];
  for (let k = 0; k < rings; k++) {
    const R = base + k * gap;
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const t = (i / 36) * Math.PI * 2;
      let m = 1;
      for (const w of waves) m += w.a * (0.5 + k / rings) * Math.sin(w.n * t + w.p + k * 0.15);
      pts.push([cx + Math.cos(t) * R * m * stretch, cy + Math.sin(t) * R * m]);
    }
    paths.push(closedPath(pts));
  }
  return paths;
}

/** Topographic fingerprint. `seed` is any string (e.g. the user's answers). */
export function contour(seed, { w = 400, h = 240, rings = 11, cls = 'contour' } = {}) {
  const r = rng(hash(seed || 'know your mind'));
  const unit = Math.min(w, h) / 240;
  const a = hill(r, w * (0.34 + r() * 0.12), h * (0.42 + r() * 0.16), rings, (13 + r() * 4) * unit, 8 * unit, 1.35);
  const b = hill(r, w * (0.74 + r() * 0.08), h * (0.3 + r() * 0.2), Math.round(rings * 0.55), (11 + r() * 3) * unit, 6 * unit, 1.2);
  const lines = [...a.map((d, i) => [d, i]), ...b.map((d, i) => [d, i])];
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${lines.map(([d, i]) => `<path d="${d}" class="${i % 4 === 0 ? 'idx' : ''}" style="--i:${i}"/>`).join('')}
  </svg>`;
}

/** The five-step loop as a cycle. steps: [{ key, label, text }] */
export function loopDiagram(steps, { breakAt = [] } = {}) {
  const S = 300, C = S / 2, R = 108;
  const n = steps.length;
  const pos = steps.map((_, i) => {
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [C + Math.cos(t) * R, C + Math.sin(t) * R];
  });
  const arcs = pos.map((_, i) => {
    const t1 = -Math.PI / 2 + ((i + 0.2) / n) * Math.PI * 2;
    const t2 = -Math.PI / 2 + ((i + 0.8) / n) * Math.PI * 2;
    const a = [C + Math.cos(t1) * R, C + Math.sin(t1) * R];
    const b = [C + Math.cos(t2) * R, C + Math.sin(t2) * R];
    return `<path class="arc" d="M${f(a[0])},${f(a[1])} A${R},${R} 0 0 1 ${f(b[0])},${f(b[1])}" marker-end="url(#head)"/>`;
  }).join('');
  const nodes = steps.map((s, i) => {
    const [x, y] = pos[i];
    const brk = breakAt.includes(s.key);
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const lx = Math.cos(t) * 32;
    const ly = Math.sin(t) * 32 + 5;
    const anchor = Math.abs(Math.cos(t)) < 0.3 ? 'middle' : Math.cos(t) > 0 ? 'start' : 'end';
    return `<g class="node ${brk ? 'break' : ''}" transform="translate(${f(x)},${f(y)})">
      ${brk ? '<circle r="24" class="halo"/>' : ''}
      <circle r="17"/>
      <text class="num" dy="5">${i + 1}</text>
      <text class="lbl" x="${f(lx)}" y="${f(Math.abs(Math.cos(t)) < 0.3 ? ly + Math.sign(ly) * 4 : ly)}" text-anchor="${anchor}">${esc(s.label)}</text>
    </g>`;
  }).join('');
  return `<svg class="loop" viewBox="-40 -14 ${S + 80} ${S + 28}" role="img" aria-label="The loop: ${steps.map((s) => esc(s.label)).join(', then ')}, and back to the start">
    <defs><marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9z" class="headp"/></marker></defs>
    <circle class="track" cx="${C}" cy="${C}" r="${R}"/>
    <circle class="flow" cx="${C}" cy="${C}" r="${R}"/>
    ${arcs}
    <text class="mid" x="${C}" y="${C - 4}">the loop</text>
    <text class="mid2" x="${C}" y="${C + 16}">feeds itself</text>
    ${nodes}
  </svg>`;
}

/** Urge intensity model: rises to a peak, then falls (minutes 0..total). */
export function urgeCurve(t, total) {
  const peak = total * 0.3;
  if (t <= peak) return 0.25 + 0.75 * Math.sin((t / peak) * Math.PI / 2);
  const k = (t - peak) / (total - peak);
  return Math.max(0.08, Math.cos(k * Math.PI / 2) ** 1.6);
}

/** progress 0..1; ratings: [{ t: 0..1, v: 0..10 }] */
export function urgeWave(progress, ratings = [], { w = 340, h = 150 } = {}) {
  const m = 10; // side margin so the dot is never cut off
  const X = (t) => m + t * (w - 2 * m);
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const x = i / 60;
    pts.push([X(x), h - 12 - urgeCurve(x, 1) * (h - 34)]);
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`).join('');
  const area = `${line}L${X(1)},${h}L${X(0)},${h}Z`;
  const px = X(progress);
  const py = h - 12 - urgeCurve(progress, 1) * (h - 34);
  const dots = ratings.map((r) => `<circle class="rate" cx="${f(X(r.t))}" cy="${f(h - 12 - (r.v / 10) * (h - 34))}" r="4.5"/>`).join('');
  return `<svg class="wave" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs>
      <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="s1"/><stop offset="1" class="s2"/></linearGradient>
      <clipPath id="wdone"><rect x="0" y="0" width="${f(px)}" height="${h}"/></clipPath>
    </defs>
    <path d="${area}" class="area"/>
    <path d="${area}" class="area done" clip-path="url(#wdone)"/>
    <path d="${line}" class="line"/>
    <text x="${f(w * 0.3)}" y="14" class="peak">peak</text>
    ${dots}
    <line x1="${f(px)}" x2="${f(px)}" y1="0" y2="${h}" class="now"/>
    <circle cx="${f(px)}" cy="${f(py)}" r="7" class="you"/>
  </svg>`;
}

/** Small sparkline for 0–100 belief ratings. */
export function spark(values, { w = 280, h = 54 } = {}) {
  if (values.length < 2) return '';
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - (v / 100) * (h - 12)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`).join('');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/><circle cx="${f(last[0])}" cy="${f(last[1])}" r="3.5"/></svg>`;
}
