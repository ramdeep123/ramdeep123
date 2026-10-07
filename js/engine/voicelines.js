// Every line the KAYA coach can speak, with a stable id.
// The id is also the audio file name: assets/voice/<id>.mp3
// tools/voice-script.mjs turns this list into the ElevenLabs script.

import { EXERCISES } from './exercises.js';
import { SESSIONS } from './breath.js';

const NUMBER_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
  'Twenty-one', 'Twenty-two', 'Twenty-three', 'Twenty-four', 'Twenty-five', 'Twenty-six', 'Twenty-seven', 'Twenty-eight', 'Twenty-nine', 'Thirty'];

export const numberWord = (n) => NUMBER_WORDS[n - 1] || String(n);

/** Named lines used directly by the app (key → {id, text}). */
export const L = {
  // camera coach: setup and framing
  frameSide: { id: 'cam-turn-side-on', text: 'Turn side on to the camera. Whole body in frame.' },
  frameFront: { id: 'cam-face-camera', text: 'Face the camera. Whole body in frame.' },
  stepBack: { id: 'cam-step-back', text: 'Step back. I need to see you from head to feet.' },
  comeCloser: { id: 'cam-come-closer', text: 'Come a little closer.' },
  tooDark: { id: 'cam-too-dark', text: "It's too dark. Find more light." },
  turnMore: { id: 'cam-turn-more', text: 'Turn a little more side on.' },
  faceMore: { id: 'cam-face-more', text: 'Turn to face the camera.' },
  lost: { id: 'cam-lost-you', text: 'I lost you. Step back into the frame.' },
  locked: { id: 'cam-locked-on', text: 'Got you. Get into your start position.' },
  countdown: { id: 'cam-get-ready', text: 'Get ready.' },
  go: { id: 'go', text: 'Go!' },
  targetReached: { id: 'cam-target-reached', text: 'Target reached. Finish when you are ready.' },
  setDone: { id: 'cam-set-complete', text: 'Set complete. Nice work.' },
  holdDone: { id: 'cam-hold-complete', text: 'Hold complete. Well done.' },
  holdStart: { id: 'cam-hold-start', text: 'Hold it. Breathe.' },
  halfway: { id: 'cam-halfway', text: 'Halfway there. Stay strong.' },
  tempo: { id: 'fix-tempo', text: 'Slow down. Control every rep.' },
  // workout player
  restOver: { id: 'rest-over', text: 'Rest is over. Next set.' },
  nextExercise: { id: 'next-exercise', text: 'Next exercise. Watch the coach first.' },
  workoutDone: { id: 'workout-complete', text: 'Workout complete. Great job.' },
  // breathwork
  breatheIn: { id: 'breath-in', text: 'Breathe in.' },
  topUp: { id: 'breath-top-up', text: 'Top up.' },
  breatheOut: { id: 'breath-out', text: 'Breathe out.' },
  hold: { id: 'breath-hold', text: 'Hold.' },
  followOrb: { id: 'breath-follow-orb', text: 'Follow the orb. Let your breathing slow down.' },
  getComfortable: { id: 'breath-get-comfortable', text: 'Get comfortable.' },
  breathEnd: { id: 'breath-end', text: 'Gently return. Notice how you feel.' },
  // engagement
  welcome: { id: 'welcome', text: 'Welcome to KAYA. Your trainer is ready.' },
  dayClosed: { id: 'day-closed', text: 'All three done. Your day is closed. See you tomorrow.' },
  levelUp: { id: 'level-up', text: 'Level up. Keep that fire going.' },
};

export const PRAISE = [
  { id: 'praise-good-rep', text: 'Good rep.' },
  { id: 'praise-nice-control', text: 'Nice control.' },
  { id: 'praise-thats-it', text: "That's it." },
  { id: 'praise-clean-rep', text: 'Clean rep.' },
  { id: 'praise-strong', text: 'Strong!' },
  { id: 'praise-perfect-depth', text: 'Perfect depth.' },
];

export const BREATH_CUE = { in: L.breatheIn, in2: L.topUp, out: L.breatheOut, hold: L.hold, hold2: L.hold };

/** Build the full catalogue: [{id, text, group, note}] */
export function allLines() {
  const out = [];
  const seenText = new Map();
  const add = (group, id, text, note = '') => {
    const key = text.trim().toLowerCase();
    if (seenText.has(key)) return seenText.get(key);
    seenText.set(key, id);
    out.push({ id, text, group, note });
    return id;
  };

  NUMBER_WORDS.forEach((w, i) => add('Rep counts', `count-${String(i + 1).padStart(2, '0')}`, `${w}.`, 'Short and punchy, like a coach counting reps.'));
  const camera = ['frameSide', 'frameFront', 'stepBack', 'comeCloser', 'tooDark', 'turnMore', 'faceMore', 'lost', 'locked',
    'countdown', 'go', 'targetReached', 'setDone', 'holdDone', 'holdStart', 'halfway'];
  for (const k of camera) add('Camera coach', L[k].id, L[k].text, 'Clear and encouraging.');
  for (const p of PRAISE) add('Praise', p.id, p.text, 'Warm, upbeat, quick.');
  for (const ex of EXERCISES) {
    if (!ex.track) continue;
    if (ex.track.partialMsg) add('Form corrections', `fix-${ex.id}-partial`, ex.track.partialMsg, `${ex.name}: rep was too short. Firm but friendly.`);
    for (const r of ex.track.rules || []) add('Form corrections', `fix-${ex.id}-${r.id}`, r.msg, `${ex.name}: form mistake. Firm but friendly.`);
  }
  add('Form corrections', L.tempo.id, L.tempo.text, 'Any exercise: reps are rushed.');
  for (const k of ['restOver', 'nextExercise', 'workoutDone']) add('Workout', L[k].id, L[k].text, 'Energetic.');
  for (const k of ['breatheIn', 'topUp', 'breatheOut', 'hold', 'followOrb', 'getComfortable', 'breathEnd']) add('Breathwork', L[k].id, L[k].text, 'Slow, soft, calm. Leave space at the end.');
  const nsdr = SESSIONS.find((s) => s.id === 'nsdr');
  nsdr.script.forEach(([, text], i) => add('Deep rest (NSDR)', `nsdr-${String(i + 1).padStart(2, '0')}`, text, 'Very slow and soothing, almost a whisper.'));
  for (const k of ['welcome', 'dayClosed', 'levelUp']) add('App', L[k].id, L[k].text, 'Friendly.');
  return out;
}

let textIndex = null;
/** Find the clip id for a spoken sentence (case- and punctuation-insensitive). */
export function idForText(text) {
  if (!textIndex) {
    textIndex = new Map();
    for (const l of allLines()) textIndex.set(norm(l.text), l.id);
  }
  return textIndex.get(norm(text)) || null;
}
const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
