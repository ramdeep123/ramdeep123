// "Thermal core": a living heat-blob whose temperature follows a 0–100 value.
// Cool indigo when depleted, white-hot gold when ready. Also used, in its
// cool palette, as the breathing orb in the Mind lab.

import { heatColor } from './figure.js';
import { clamp, lerp } from './util.js';

const FROST = ['#0E1F3A', '#16466E', '#1F7FA0', '#4FD8D0', '#BFF5EE', '#F2FFFD'];
function frostColor(t, a = 1) {
  t = clamp(t, 0, 1) * (FROST.length - 1);
  const i = Math.min(FROST.length - 2, Math.floor(t));
  const f = t - i;
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const x = p(FROST[i]), y = p(FROST[i + 1]);
  return `rgba(${x.map((v, k) => Math.round(lerp(v, y[k], f))).join(',')},${a})`;
}

export class Orb {
  constructor(canvas, { value = 60, palette = 'heat', scale = 1 } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.value = value;
    this.shown = value;
    this.palette = palette;
    this.scale = scale; // breathing scale target 0.6..1.1
    this.curScale = scale;
    this.t = Math.random() * 100;
    this.running = false;
  }

  color(t, a) { return this.palette === 'frost' ? frostColor(t, a) : heatColor(t, a); }

  size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.c.clientWidth || 300, h = this.c.clientHeight || 300;
    if (this.c.width !== Math.round(w * dpr) || this.c.height !== Math.round(h * dpr)) { this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); }
    return { w, h, dpr };
  }

  draw() {
    const { ctx } = this;
    const { w, h, dpr } = this.size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.shown += (this.value - this.shown) * 0.04;
    this.curScale += (this.scale - this.curScale) * 0.08;
    const v = clamp(this.shown / 100, 0, 1);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.34 * this.curScale;
    const t = this.t;

    // halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.55);
    halo.addColorStop(0, this.color(0.35 + v * 0.4, 0.35));
    halo.addColorStop(1, this.color(0.1, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2); ctx.fill();

    // wobbling body
    ctx.save();
    ctx.beginPath();
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const n = Math.sin(a * 3 + t * 0.9) * 0.035 + Math.sin(a * 5 - t * 1.3) * 0.025 + Math.sin(a * 2 + t * 0.5) * 0.03;
      const r = R * (1 + n * (0.6 + v * 0.6));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const body = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 1.05);
    body.addColorStop(0, this.color(0.55 + v * 0.45, 1));
    body.addColorStop(0.45, this.color(0.3 + v * 0.5, 1));
    body.addColorStop(1, this.color(0.05 + v * 0.3, 1));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.clip();

    // moving hot spots
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const a = t * (0.35 + k * 0.13) + k * 1.7;
      const x = cx + Math.cos(a) * R * 0.45, y = cy + Math.sin(a * 1.3) * R * 0.4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.7);
      g.addColorStop(0, this.color(0.5 + v * 0.5, 0.35));
      g.addColorStop(1, this.color(0.5, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
    }
    ctx.restore();

    // contour rings like an isotherm map
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      const rr = R * (0.3 + k * 0.22);
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const n = Math.sin(a * 4 + t * (0.6 + k * 0.2)) * 0.03;
        const x = cx + Math.cos(a) * rr * (1 + n), y = cy + Math.sin(a) * rr * (1 + n);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  loop = () => {
    if (!this.running) return;
    if (!this.c.isConnected) { this.running = false; return; }
    this.t += 0.016;
    this.draw();
    requestAnimationFrame(this.loop);
  };

  start() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { this.shown = this.value; this.draw(); return this; }
    if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
    return this;
  }

  stop() { this.running = false; }
}
