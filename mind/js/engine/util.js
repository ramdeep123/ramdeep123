// Small shared helpers: dates, text, HTML escaping. No DOM access, so the
// engine runs the same in the browser, in Node tests and on the server.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const DAY = 86400000;

/** Local YYYY-MM-DD for a timestamp (defaults to now). */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function keyToTs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** YYYY-MM for a day key or timestamp. */
export const monthKey = (x = Date.now()) => (typeof x === 'string' ? x : dayKey(x)).slice(0, 7);

export function daysInMonth(mKey) {
  const [y, m] = mKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthName = (mKey) => MONTHS[Number(mKey.slice(5, 7)) - 1];

export function fmtDate(ts) {
  const d = new Date(ts);
  return `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function greeting(ts = Date.now()) {
  const h = new Date(ts).getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night';
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Trim and collapse whitespace; cap the length for storage and display. */
export function tidy(s, max = 600) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** A short quote from the user's own words, cut on a word boundary. */
export function quote(s, max = 90) {
  const t = tidy(s, 400);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).replace(/[,;:.\s]+$/, '') + '…';
}

/** "a", "a and b", "a, b and c" */
export function joinAnd(list) {
  const l = list.filter(Boolean);
  if (l.length <= 1) return l[0] || '';
  return `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
}

export const lower1 = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const upper1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Deterministic 32-bit hash → seeded PRNG (mulberry32). */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
