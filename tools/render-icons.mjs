import { chromium } from 'playwright';
import fs from 'fs';
const root = '/home/user/ramdeep123/';
const jobs = [
  ['assets/icon.svg', 'assets/icon-192.png', 192, false],
  ['assets/icon.svg', 'assets/icon-512.png', 512, false],
  ['tools/icon-maskable.svg', 'assets/icon-maskable-512.png', 512, false],
];
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, f] of Object.entries(dens)) {
  jobs.push(['assets/icon.svg', `android/res/mipmap-${d}/ic_launcher.png`, Math.round(48 * f), true]);
  jobs.push(['tools/icon-fg.svg', `android/res/mipmap-${d}/ic_launcher_foreground.png`, Math.round(108 * f), true]);
}
const b = await chromium.launch();
const p = await b.newPage();
for (const [src, out, size, transparent] of jobs) {
  const svg = fs.readFileSync(root + src, 'utf8');
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  fs.mkdirSync(root + out.split('/').slice(0, -1).join('/'), { recursive: true });
  await p.screenshot({ path: root + out, omitBackground: true });
}
await b.close();
console.log('icons ok', jobs.length);
