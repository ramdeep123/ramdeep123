// Razorpay subscription checkout. Needs server/server.mjs (or any backend that
// creates the subscription and verifies the signature) — keys never ship in the app.

import { CONFIG } from './config.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('checkout-load-failed'));
    document.head.appendChild(s);
  });
}

async function post(path, body) {
  const r = await fetch(CONFIG.payments.apiBase + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`api-${r.status}`);
  return r.json();
}

/** Resolves {ref} after a verified payment; rejects Error('dismissed') if closed. */
export async function checkout({ name }) {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  const { subscriptionId, key } = await post('/api/subscription', { name });
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key,
      subscription_id: subscriptionId,
      name: 'KAYA',
      description: 'KAYA Pass · 3 months',
      prefill: { name },
      theme: { color: '#FF6A2B' },
      handler: async (resp) => {
        try {
          const v = await post('/api/verify', resp);
          if (v.ok) resolve({ ref: resp.razorpay_payment_id });
          else reject(new Error('verify-failed'));
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => reject(new Error('dismissed')) },
    });
    rz.open();
  });
}
