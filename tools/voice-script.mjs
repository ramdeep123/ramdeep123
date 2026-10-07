// Writes the voice-over script for ElevenLabs (or any voice artist):
//   docs/voice/KAYA-voice-script.csv   one row per clip (file name, text, direction)
//   docs/voice/KAYA-voice-script.md    the same, grouped and easy to read
// Run: node tools/voice-script.mjs
import fs from 'node:fs';
import { allLines } from '../js/engine/voicelines.js';

const lines = allLines();
const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`;
const csv = ['file_name,text,section,direction', ...lines.map((l) => [`${l.id}.mp3`, l.text, l.group, l.note].map(csvCell).join(','))].join('\n');
fs.mkdirSync('docs/voice', { recursive: true });
fs.writeFileSync('docs/voice/KAYA-voice-script.csv', csv + '\n');

let md = `# KAYA voice-over script\n\n${lines.length} short clips. Record each line as its own audio file and name it exactly as shown (for example \`count-01.mp3\`).\nThe app plays your recording when the file exists, and falls back to the phone's built-in voice when it doesn't, so you can add clips a few at a time.\n\n`;
let group = '';
let n = 0;
for (const l of lines) {
  if (l.group !== group) {
    group = l.group;
    md += `\n## ${group}\n\n_${l.note}_\n\n| # | File name | Say this |\n|---|---|---|\n`;
  }
  n++;
  md += `| ${n} | \`${l.id}.mp3\` | ${l.text.replace(/\|/g, '\\|')} |\n`;
}
fs.writeFileSync('docs/voice/KAYA-voice-script.md', md);
console.log(`wrote ${lines.length} lines to docs/voice/`);
