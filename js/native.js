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

/** Hand the next 7 days of reminders to the Android app (no-op in a browser). */
let lastPlan = '';
export function setReminders(plan) {
  const json = JSON.stringify(plan.map(({ at, title, body }) => ({ at, title, body })));
  if (json === lastPlan) return;
  lastPlan = json;
  try { N()?.setReminders?.(json); } catch (e) { /* ignore */ }
}

export const canRemind = () => !!N()?.setReminders;

export function testReminder(title, body) {
  try { N()?.testReminder?.(title, body); } catch (e) { /* ignore */ }
}

/** Ask for notification permission (Android 13+). Resolves true/false. */
export function requestNotifications() {
  return new Promise((resolve) => {
    const n = N();
    if (!n?.requestNotifications) { resolve(false); return; }
    try { if (n.notificationsAllowed()) { resolve(true); return; } } catch (e) { /* ignore */ }
    window.KayaNotifyResult = (ok) => { window.KayaNotifyResult = null; resolve(!!ok); };
    n.requestNotifications();
    setTimeout(() => { if (window.KayaNotifyResult) { window.KayaNotifyResult = null; resolve(false); } }, 20000);
  });
}
