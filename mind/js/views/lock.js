// App lock (handoff §10): a PIN pad shown before anything else when a PIN is
// set. The PIN is the encryption key, so a forgotten PIN means starting over.

import { unlock, pinWait, wipeAll } from '../store.js';
import { icon, toast } from '../ui.js';
import { helpButton } from '../core.js';

export function pinPad(title, sub, { forgot = false } = {}) {
  return `<div class="lock">
    <div class="lock-top">${helpButton()}</div>
    <div class="lock-mid">
      <div class="lock-ic">${icon('lock')}</div>
      <h1 class="display">${title}</h1>
      <p class="lead">${sub}</p>
      <div class="pin-dots" aria-live="polite">${'<i></i>'.repeat(6)}</div>
      <p class="pin-msg" role="status"></p>
    </div>
    <div class="pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
      <button data-key="back" aria-label="Delete">${icon('back')}</button>
      <button data-key="0">0</button>
      <button data-key="ok" class="ok" aria-label="Enter">${icon('arrow')}</button>
    </div>
    ${forgot ? `<button class="link-btn" data-key="forgot">Forgot PIN?</button>` : ''}
  </div>`;
}

/** Wires a pin pad inside `root`; calls onPin(pin) when 4–6 digits are entered. */
export function wirePad(root, onPin, { onForgot } = {}) {
  let pin = '';
  const dots = [...root.querySelectorAll('.pin-dots i')];
  const msg = root.querySelector('.pin-msg');
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const submit = async () => {
    if (pin.length < 4) { msg.textContent = 'At least 4 digits.'; return; }
    const p = pin;
    pin = '';
    paint();
    await onPin(p, (text) => { msg.textContent = text; root.querySelector('.pin-dots').classList.add('shake'); setTimeout(() => root.querySelector('.pin-dots')?.classList.remove('shake'), 400); });
  };
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-key]');
    if (!b) return;
    const k = b.dataset.key;
    msg.textContent = '';
    if (k === 'back') pin = pin.slice(0, -1);
    else if (k === 'ok') return submit();
    else if (k === 'forgot') return onForgot?.();
    else if (pin.length < 6) pin += k;
    paint();
  });
  root.addEventListener('keydown', (ev) => {
    if (/^\d$/.test(ev.key) && pin.length < 6) { pin += ev.key; paint(); }
    else if (ev.key === 'Backspace') { pin = pin.slice(0, -1); paint(); }
    else if (ev.key === 'Enter') submit();
  });
}

export function showLock(app, onUnlocked) {
  app.innerHTML = pinPad('Locked', 'Enter your PIN to open your map.', { forgot: true });
  const root = app.querySelector('.lock');
  root.tabIndex = -1;
  root.focus();
  wirePad(root, async (pin, fail) => {
    try {
      await unlock(pin);
      onUnlocked();
    } catch (e) {
      if (e.message === 'wait' || e.wait) fail(`Too many tries. Wait ${Math.ceil((e.wait || (await pinWait())) / 1000)} seconds.`);
      else fail('That PIN didn’t work.');
    }
  }, {
    onForgot: async () => {
      const ok = confirm('Your data is encrypted with your PIN, so it can’t be recovered without it.\n\nDelete everything on this phone and start again?');
      if (!ok) return;
      await wipeAll();
      toast('Everything was deleted.');
      location.reload();
    },
  });
}
