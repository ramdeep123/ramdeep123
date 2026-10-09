// Light ("paper") / dark ("night") / auto. The choice is not sensitive, so it
// is kept in localStorage too — the lock screen needs it before unlocking.

const KEY = 'kym.theme';

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  try { localStorage.setItem(KEY, t || 'auto'); } catch (e) { /* blocked */ }
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12141B' : '#F2ECE1');
  try { window.MindNative?.setDark?.(dark); } catch (e) { /* web */ }
}

export function savedTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
}
