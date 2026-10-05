// Small SVG charts with hover/touch readouts. Marks carry colour; text uses ink tokens.

const NS = 'http://www.w3.org/2000/svg';

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

/**
 * series: [{ name, color, points: [{x, y}], dots: bool }]
 * x values are timestamps; fmtX/fmtY format readouts.
 */
export function lineChart(host, { series, fmtX, fmtY, height = 170, yPad = 0.5 }) {
  host.innerHTML = '';
  host.classList.add('chart');
  const W = Math.max(280, host.clientWidth || 320), H = height;
  const m = { l: 34, r: 14, t: 12, b: 22 };
  const all = series.flatMap((s) => s.points);
  if (!all.length) return;
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000; x1 += 86400000; }
  const ticks = niceTicks(Math.min(...ys) - yPad, Math.max(...ys) + yPad);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = (x) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (y) => m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  const grid = el('g', { class: 'grid' }, svg);
  const axis = el('g', { class: 'axis' }, svg);
  for (const t of ticks) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid);
    const tx = el('text', { x: m.l - 6, y: Y(t) + 3, 'text-anchor': 'end' }, axis);
    tx.textContent = fmtY ? fmtY(t, true) : t;
  }
  const xl = el('text', { x: m.l, y: H - 4, 'text-anchor': 'start' }, axis);
  xl.textContent = fmtX(x0);
  const xr = el('text', { x: W - m.r, y: H - 4, 'text-anchor': 'end' }, axis);
  xr.textContent = fmtX(x1);

  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    if (s.area) {
      const d = `M${X(pts[0].x)},${Y(y0)} ` + pts.map((p) => `L${X(p.x)},${Y(p.y)}`).join(' ') + ` L${X(pts[pts.length - 1].x)},${Y(y0)} Z`;
      el('path', { d, fill: s.color, 'fill-opacity': 0.1, stroke: 'none' }, svg);
    }
    if (s.line !== false && pts.length > 1) {
      el('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    }
    if (s.dots) {
      for (const p of pts) el('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    } else {
      const p = pts[pts.length - 1];
      el('circle', { cx: X(p.x), cy: Y(p.y), r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    }
  }

  const cross = el('line', { y1: m.t, y2: H - m.b, stroke: 'var(--text-3)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  host.appendChild(svg);
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  host.appendChild(tip);

  const allX = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let best = allX[0];
    for (const x of allX) if (Math.abs(X(x) - px) < Math.abs(X(best) - px)) best = x;
    cross.setAttribute('x1', X(best)); cross.setAttribute('x2', X(best));
    cross.setAttribute('visibility', 'visible');
    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = 'faint small';
    head.textContent = fmtX(best);
    tip.appendChild(head);
    for (const s of series) {
      const p = s.points.reduce((a, b) => (Math.abs(b.x - best) < Math.abs(a.x - best) ? b : a));
      const row = document.createElement('div');
      const key = document.createElement('span');
      key.style.cssText = `display:inline-block;width:12px;height:2px;background:${s.color};margin-right:6px;vertical-align:middle`;
      const v = document.createElement('b');
      v.textContent = fmtY ? fmtY(p.y) : p.y;
      const n = document.createElement('span');
      n.className = 'faint';
      n.textContent = s.name;
      row.append(key, v, n);
      tip.appendChild(row);
    }
    tip.hidden = false;
    tip.style.left = `${(X(best) / W) * 100}%`;
    tip.style.top = `${(m.t / H) * 100 + 8}%`;
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}

/** bars: [{label, value}] */
export function barChart(host, { bars, color, fmtY, height = 150 }) {
  host.innerHTML = '';
  host.classList.add('chart');
  const W = Math.max(280, host.clientWidth || 320), H = height;
  const m = { l: 34, r: 8, t: 14, b: 22 };
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = niceTicks(0, max, 3).filter((t) => t >= 0);
  const top = ticks[ticks.length - 1];
  const Y = (v) => m.t + (1 - v / top) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / bars.length;
  const bw = Math.min(24, band * 0.6);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  const grid = el('g', { class: 'grid' }, svg);
  const axis = el('g', { class: 'axis' }, svg);
  for (const t of ticks) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid);
    const tx = el('text', { x: m.l - 6, y: Y(t) + 3, 'text-anchor': 'end' }, axis);
    tx.textContent = fmtY ? fmtY(t, true) : t;
  }
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  bars.forEach((b, i) => {
    const cx = m.l + band * i + band / 2;
    const h = Math.max(0, Y(0) - Y(b.value));
    const x = cx - bw / 2, y = Y(b.value);
    const r = Math.min(4, h);
    const d = h > 0
      ? `M${x},${Y(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${Y(0)} Z`
      : '';
    if (d) el('path', { d, fill: color, opacity: i === bars.length - 1 ? 1 : 0.55 }, svg);
    const lab = el('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, axis);
    lab.textContent = b.label;
    const hit = el('rect', { x: cx - band / 2, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const show = () => {
      tip.replaceChildren();
      const v = document.createElement('b');
      v.textContent = fmtY ? fmtY(b.value) : b.value;
      const n = document.createElement('span');
      n.className = 'faint';
      n.textContent = b.full || b.label;
      tip.append(v, n);
      tip.hidden = false;
      tip.style.left = `${(cx / W) * 100}%`;
      tip.style.top = `${(y / H) * 100}%`;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  host.appendChild(svg);
  host.appendChild(tip);
}
