// Bridge to the Android shell (KayaNative is injected by MainActivity).
// Every call degrades gracefully in a normal browser.

const N = () => window.KayaNative;

export const isNative = () => !!N();

let wakeLock = null;
export async function keepAwake(on) {
  try { N()?.keepAwake(!!on); } catch (e) { /* ignore */ }
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* optional */ }
}

/** Share text (backup file, progress) through the system share sheet. */
export async function shareText(title, text) {
  if (N()?.share) { N().share(title, text); return true; }
  if (navigator.share) {
    try { await navigator.share({ title, text }); return true; } catch (e) { return false; }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `${title.replace(/\W+/g, '-').toLowerCase()}.json`;
    a.click();
    return true;
  } catch (e) { return false; }
}

export function openExternal(url) {
  if (N()?.openUrl) N().openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

export function appVersion() {
  try { return N()?.version?.() || null; } catch (e) { return null; }
}
