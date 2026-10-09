// Generates the app icon SVGs (contour rings = "a map of your mind") and
// renders the PNGs for the web manifest and the Android launcher.
//   node mind/tools/make-icons.mjs        (needs Playwright + Chromium)
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const f = (n) => Math.round(n * 10) / 10;

function rings(cx, cy, base, gap, n, scale = 1) {
  const waves = [{ n: 3, p: 0.6, a: 0.07 }, { n: 2, p: 2.1, a: 0.06 }, { n: 5, p: 4.0, a: 0.025 }];
  const out = [];
  for (let k = 0; k < n; k++) {
    const R = (base + k * gap) * scale;
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      let m = 1;
      for (const w of waves) m += w.a * (0.6 + k / n) * Math.sin(w.n * t + w.p + k * 0.2);
      pts.push([cx + Math.cos(t) * R * m * 1.06, cy + Math.sin(t) * R * m]);
    }
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
    }
    out.push(d + 'Z');
  }
  return out;
}

function mark(scale = 1, cx = 256, cy = 256) {
  const r = rings(cx - 8 * scale, cy + 6 * scale, 34, 30, 5, scale);
  return `<g fill="none" stroke="#FBF1E4" stroke-linecap="round">
    ${r.map((d, i) => `<path d="${d}" stroke-width="${f((i === 0 ? 15 : 11) * scale)}" opacity="${[1, 0.92, 0.78, 0.6, 0.42][i]}"/>`).join('')}
  </g>
  <circle cx="${f(cx - 6 * scale)}" cy="${f(cy + 4 * scale)}" r="${f(13 * scale)}" fill="#FBF1E4"/>`;
}

const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9623A"/><stop offset="1" stop-color="#8E3A1F"/></linearGradient></defs>`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<rect width="512" height="512" rx="116" fill="url(#g)"/>${mark(1)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<rect width="512" height="512" fill="url(#g)"/>${mark(0.78)}</svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${mark(0.62)}</svg>`;

fs.mkdirSync(join(ROOT, 'assets'), { recursive: true });
fs.writeFileSync(join(ROOT, 'assets/icon.svg'), icon);
fs.writeFileSync(join(ROOT, 'tools/icon-maskable.svg'), maskable);
fs.writeFileSync(join(ROOT, 'tools/icon-fg.svg'), fg);

const jobs = [
  [icon, 'assets/icon-192.png', 192],
  [icon, 'assets/icon-512.png', 512],
  [maskable, 'assets/icon-maskable-512.png', 512],
];
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  jobs.push([icon, `android/res/mipmap-${d}/ic_launcher.png`, Math.round(48 * k)]);
  jobs.push([fg, `android/res/mipmap-${d}/ic_launcher_foreground.png`, Math.round(108 * k)]);
}

// PLAYWRIGHT=/path/to/playwright/index.js if Playwright is installed globally
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const chromium = pw.chromium || pw.default.chromium;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
for (const [svg, out, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  fs.mkdirSync(join(ROOT, dirname(out)), { recursive: true });
  await page.screenshot({ path: join(ROOT, out), omitBackground: true });
}
await browser.close();
console.log('icons:', jobs.length);
