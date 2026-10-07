// After you add recordings to assets/voice/, run: node tools/voice-manifest.mjs
// It lists which clips exist so the app knows to play them, and reports any
// missing or misnamed files.
import fs from 'node:fs';
import { allLines } from '../js/engine/voicelines.js';

const dir = 'assets/voice';
const ids = new Set(allLines().map((l) => l.id));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
const clips = files.filter((f) => ids.has(f)).sort();
const unknown = files.filter((f) => !ids.has(f));
const missing = [...ids].filter((id) => !files.includes(id));
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify({ clips }, null, 1) + '\n');
console.log(`${clips.length}/${ids.size} clips ready.`);
if (unknown.length) console.log(`Not used (check the file names): ${unknown.join(', ')}`);
if (missing.length) console.log(`Still missing ${missing.length}: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`);
