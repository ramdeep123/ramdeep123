// Know Your Mind — optional backend.
//
//   node mind/server/server.mjs          (PORT=8090 by default)
//
// 1. Serves the web app (the same files the Android APK ships).
// 2. A stateless AI proxy: /api/turn, /api/map, /api/map/section.
//    The API key stays here; the app never sees it.
//
// Privacy rules (handoff §10): no database, no accounts, no analytics, and
// request bodies are never logged — only method, path, status and timing.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGuide, claudeClient, GuideError, DEFAULT_MODEL } from './guide.mjs';
import { MAP_SECTIONS } from '../js/engine/aishape.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 200 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8',
};
// Only the app itself is public — never server code, tests or docs.
const PUBLIC = /^\/(index\.html|manifest\.webmanifest|sw\.js|(css|js|assets)\/[\w./-]+)$/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function createApp({
  guide = null,
  root = ROOT,
  allowedOrigins = ['https://appassets.androidplatform.net', 'http://localhost:8090'],
  clientToken = '',
  rateLimit = { max: 60, windowMs: 10 * 60 * 1000 },
  log = (line) => console.log(line),
} = {}) {
  const hits = new Map(); // ip → timestamps (memory only, pruned)

  function limited(ip, now = Date.now()) {
    const list = (hits.get(ip) || []).filter((t) => now - t < rateLimit.windowMs);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < rateLimit.windowMs)) hits.delete(k);
    return list.length > rateLimit.max;
  }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Token');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  }

  const send = (res, status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
    res.end(JSON.stringify(obj));
  };

  async function readJson(req) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      // keep reading (without storing) so the client gets a clean 413,
      // but cut off anything absurd
      if (size > MAX_BODY * 10) { req.destroy(); throw new GuideError('too-large', 413); }
      if (size <= MAX_BODY) chunks.push(c);
    }
    if (size > MAX_BODY) throw new GuideError('too-large', 413);
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (e) {
      throw new GuideError('bad-json', 400);
    }
  }

  function checkTurns(turns) {
    if (!Array.isArray(turns) || turns.length > 80) throw new GuideError('bad-turns', 400);
    return turns.map((t) => ({
      stage: Number(t?.stage) || 0,
      question: String(t?.question || '').slice(0, 400),
      selected: (Array.isArray(t?.selected) ? t.selected : []).slice(0, 12).map((s) => String(s).slice(0, 160)),
      freeText: String(t?.freeText || '').slice(0, 2000),
      skipped: !!t?.skipped,
    }));
  }

  async function api(req, res, path) {
    if (path === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, ai: !!guide, model: guide?.model || null });
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (clientToken && req.headers['x-client-token'] !== clientToken) return send(res, 401, { error: 'token' });
    if (!guide) return send(res, 503, { error: 'ai-off' });
    const ip = req.socket.remoteAddress || 'unknown';
    if (limited(ip)) return send(res, 429, { error: 'slow-down' });

    const body = await readJson(req);
    const turns = checkTurns(body.turns);
    const draftMap = body.draftMap && typeof body.draftMap === 'object' ? body.draftMap : body.map || null;
    if (path === '/api/turn') {
      if (!turns.length) throw new GuideError('bad-turns', 400);
      return send(res, 200, await guide.turn({ stage: Number(body.stage) || 1, stageGoal: String(body.stageGoal || '').slice(0, 400), draftMap, turns }));
    }
    if (path === '/api/map') return send(res, 200, await guide.map({ turns, draftMap }));
    if (path === '/api/map/section') {
      if (!MAP_SECTIONS.includes(body.section)) throw new GuideError('bad-section', 400);
      return send(res, 200, await guide.section({ section: body.section, turns, map: draftMap }));
    }
    return send(res, 404, { error: 'not-found' });
  }

  async function serveStatic(req, res, path) {
    if (path === '/') path = '/index.html';
    const clean = normalize(path).replace(/\\/g, '/');
    if (!PUBLIC.test(clean) || clean.includes('..')) return send(res, 404, { error: 'not-found' });
    const file = join(root, clean);
    try {
      const s = await stat(file);
      if (!s.isFile()) throw new Error('not a file');
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        'Cache-Control': clean === '/index.html' || clean === '/sw.js' ? 'no-cache' : 'public, max-age=3600',
        ...SECURITY_HEADERS,
      });
      res.end(data);
    } catch (e) {
      send(res, 404, { error: 'not-found' });
    }
  }

  return http.createServer(async (req, res) => {
    const t0 = Date.now();
    const path = (req.url || '/').split('?')[0];
    res.on('finish', () => log(`${req.method} ${path} ${res.statusCode} ${Date.now() - t0}ms`));
    try {
      cors(req, res);
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (path.startsWith('/api/')) return await api(req, res, path);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });
      return await serveStatic(req, res, path);
    } catch (e) {
      // Log the kind of failure only — never the request or the model's text.
      const status = e instanceof GuideError ? e.status : e?.status === 429 ? 503 : 502;
      const code = e instanceof GuideError ? e.code : e?.status ? `upstream-${e.status}` : 'upstream';
      if (!(e instanceof GuideError)) log(`guide error: ${e?.constructor?.name || 'Error'} ${e?.status || ''}`.trim());
      if (!res.headersSent) send(res, status, { error: code });
    }
  });
}

async function main() {
  const port = Number(process.env.PORT) || 8090;
  let guide = null;
  if (process.env.ANTHROPIC_API_KEY) {
    guide = createGuide({
      client: await claudeClient(),
      model: process.env.MIND_MODEL || DEFAULT_MODEL,
      effortTurn: process.env.MIND_EFFORT_TURN || 'low',
      effortMap: process.env.MIND_EFFORT_MAP || 'medium',
    });
  }
  const allowed = (process.env.ALLOWED_ORIGINS || `https://appassets.androidplatform.net,http://localhost:${port}`).split(',').map((s) => s.trim()).filter(Boolean);
  createApp({ guide, allowedOrigins: allowed, clientToken: process.env.CLIENT_TOKEN || '' }).listen(port, () => {
    console.log(`Know Your Mind on http://localhost:${port} — AI guide ${guide ? 'on (' + guide.model + ')' : 'off (set ANTHROPIC_API_KEY)'}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
