// Spoken coaching cues (Web Speech) and soft breath tones (Web Audio).

let enabled = true;
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => /en[-_]IN/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || vs[0] || null;
}
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}

const native = () => (window.KayaNative && window.KayaNative.speak ? window.KayaNative : null);

export function setVoiceEnabled(on) {
  enabled = on;
  if (!on) hush();
}

/** Stop any speech in progress. */
export function hush() {
  try { native()?.stopSpeaking(); } catch (e) { /* ignore */ }
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

/** Speak a cue. urgent=true interrupts whatever is being said. */
export function say(text, { urgent = false, rate = 1.05 } = {}) {
  if (!enabled || !text) return;
  const n = native();
  if (n) { try { n.speak(String(text), !!urgent, rate); } catch (e) { /* ignore */ } return; }
  if (!('speechSynthesis' in window)) return;
  try {
    if (urgent) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice ||= pickVoice();
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch (e) { /* speech is optional */ }
}

export function buzz(pattern = 20) {
  try {
    if (window.KayaNative?.vibrate) {
      const ms = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : pattern;
      window.KayaNative.vibrate(ms);
      return;
    }
    navigator.vibrate?.(pattern);
  } catch (e) { /* optional */ }
}

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** A soft sine swell for breath phases: rising for inhale, falling for exhale. */
export function tone(kind, seconds) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const now = a.currentTime;
  const f0 = { in: 196, in2: 247, out: 220, hold: 0, hold2: 0 }[kind] ?? 0;
  if (!f0) return;
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, now);
  o.frequency.linearRampToValueAtTime(kind === 'out' ? f0 * 0.75 : f0 * 1.25, now + seconds);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.06, now + Math.min(0.8, seconds / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  o.connect(g).connect(a.destination);
  o.start(now);
  o.stop(now + seconds + 0.05);
}

/** Short tick used for rest-timer countdowns. */
export function beep(freq = 880, dur = 0.12) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const now = a.currentTime;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(a.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}
