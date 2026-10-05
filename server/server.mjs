// KAYA backend: serves the web app and handles Razorpay subscriptions.
// Zero dependencies (Node 18+). Deploy on any Node host (Render, Railway, Fly, a VPS).
//
// Environment:
//   PORT                       default 8080
//   RAZORPAY_KEY_ID            rzp_live_... / rzp_test_...
//   RAZORPAY_KEY_SECRET        secret for the key above
//   RAZORPAY_PLAN_ID           plan_...  (₹49, period "monthly", interval 3)
//   RAZORPAY_INTRO_OFFER_ID    offer_... (₹20 off the first charge → ₹29), optional
//   RAZORPAY_WEBHOOK_SECRET    webhook secret, optional
//   TRIAL_DAYS                 default 7 (first charge is scheduled after the trial)
//   ALLOWED_ORIGIN             default * (set to your web origin in production)

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const PLAN_ID = process.env.RAZORPAY_PLAN_ID || '';
const OFFER_ID = process.env.RAZORPAY_INTRO_OFFER_ID || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.task': 'application/octet-stream',
};
const STATIC = new Set(['index.html', 'manifest.webmanifest', 'sw.js']);
const STATIC_DIRS = ['css/', 'js/', 'assets/', 'vendor/'];

export function verifyPaymentSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }, secret = KEY_SECRET) {
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest('hex');
  return safeEqual(expected, razorpay_signature);
}

export function verifyWebhook(rawBody, signature, secret = WEBHOOK_SECRET) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function razorpay(pathname, body) {
  const res = await fetch(`https://api.razorpay.com/v1${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.description || 'razorpay-error'), { status: res.status });
  return data;
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, obj, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, ...headers });
  res.end(JSON.stringify(obj));
}

async function api(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method-not-allowed' });
  const raw = await readBody(req);

  if (url.pathname === '/api/subscription') {
    if (!KEY_ID || !KEY_SECRET || !PLAN_ID) return send(res, 503, { error: 'payments-not-configured' });
    const body = JSON.parse(raw.toString() || '{}');
    const startAt = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86400;
    const sub = await razorpay('/subscriptions', {
      plan_id: PLAN_ID,
      total_count: 40, // up to 10 years of 3-month cycles
      quantity: 1,
      customer_notify: 1,
      start_at: startAt, // first charge after the free trial
      ...(OFFER_ID ? { offer_id: OFFER_ID } : {}),
      notes: { app: 'KAYA', name: String(body.name || '').slice(0, 40) },
    });
    return send(res, 200, { subscriptionId: sub.id, key: KEY_ID });
  }

  if (url.pathname === '/api/verify') {
    const body = JSON.parse(raw.toString() || '{}');
    return send(res, 200, { ok: verifyPaymentSignature(body) });
  }

  if (url.pathname === '/api/webhook') {
    if (!verifyWebhook(raw, req.headers['x-razorpay-signature'])) return send(res, 400, { error: 'bad-signature' });
    const event = JSON.parse(raw.toString());
    // Hook point: persist subscription state (event.payload.subscription.entity) in your database.
    console.log(`[webhook] ${event.event} ${event.payload?.subscription?.entity?.id || ''}`);
    return send(res, 200, { received: true });
  }

  return send(res, 404, { error: 'not-found' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel.includes('..') || !(STATIC.has(rel) || STATIC_DIRS.some((d) => rel.startsWith(d)))) rel = 'index.html';
  const file = path.join(ROOT, rel);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': rel.startsWith('vendor/') || rel.startsWith('assets/fonts/') ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    send(res, e.status && e.status < 500 ? 400 : 500, { error: e.message || 'server-error' });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`KAYA running on http://localhost:${PORT} (payments ${KEY_ID ? 'configured' : 'not configured'})`));
}
