// Generates every KAYA voice clip with the ElevenLabs API in one go.
//
//   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node tools/elevenlabs-generate.mjs
//
// Find the voice ID in ElevenLabs → Voices → (your voice) → "ID".
// Existing files are skipped, so you can re-run it after editing a line
// (delete that line's .mp3 first). Your API key is only sent to ElevenLabs.
import fs from 'node:fs';
import { allLines } from '../js/engine/voicelines.js';

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
if (!KEY || !VOICE) {
  console.error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID first.');
  process.exit(1);
}

// calmer, slower delivery for breathwork; punchier for counts and cues
const SETTINGS = {
  default: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
  'Rep counts': { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
  Breathwork: { stability: 0.8, similarity_boost: 0.8, style: 0.05, use_speaker_boost: true, speed: 0.85 },
  'Deep rest (NSDR)': { stability: 0.85, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true, speed: 0.8 },
};

const dir = 'assets/voice';
fs.mkdirSync(dir, { recursive: true });
let made = 0;
for (const line of allLines()) {
  const out = `${dir}/${line.id}.mp3`;
  if (fs.existsSync(out)) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: line.text, model_id: MODEL, voice_settings: SETTINGS[line.group] || SETTINGS.default }),
  });
  if (!res.ok) {
    console.error(`✗ ${line.id}: ${res.status} ${await res.text()}`);
    if (res.status === 401 || res.status === 403) process.exit(1);
    continue;
  }
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  made++;
  console.log(`✓ ${line.id}`);
}
console.log(`Done: ${made} new clips. Now run: node tools/voice-manifest.mjs`);
