import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { server, verifyPaymentSignature, verifyWebhook } from '../server/server.mjs';

test('payment signatures are verified with HMAC-SHA256', () => {
  const secret = 'test_secret';
  const p = { razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_1' };
  const sig = crypto.createHmac('sha256', secret).update('pay_1|sub_1').digest('hex');
  assert.equal(verifyPaymentSignature({ ...p, razorpay_signature: sig }, secret), true);
  assert.equal(verifyPaymentSignature({ ...p, razorpay_signature: sig.replace(/.$/, '0') }, secret), false);
  assert.equal(verifyPaymentSignature({ ...p, razorpay_signature: sig }, ''), false);
  const body = Buffer.from('{"event":"subscription.charged"}');
  const wsig = crypto.createHmac('sha256', 'wh').update(body).digest('hex');
  assert.equal(verifyWebhook(body, wsig, 'wh'), true);
  assert.equal(verifyWebhook(body, 'nope', 'wh'), false);
});

test('server serves the app and guards the API', async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>KAYA<\/title>/);
    const wasm = await fetch(`${base}/vendor/mediapipe/vision_wasm_internal.wasm`, { method: 'HEAD' });
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    const secret = await fetch(`${base}/server/server.mjs`);
    assert.doesNotMatch(await secret.text(), /RAZORPAY_KEY_SECRET/, 'server source is never served');
    const sub = await fetch(`${base}/api/subscription`, { method: 'POST', body: '{}' });
    assert.equal(sub.status, 503, 'unconfigured payments are refused');
    const v = await fetch(`${base}/api/verify`, { method: 'POST', body: JSON.stringify({ razorpay_payment_id: 'x' }) });
    assert.deepEqual(await v.json(), { ok: false });
  } finally {
    await new Promise((r) => server.close(r));
  }
});
