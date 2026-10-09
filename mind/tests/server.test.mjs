import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/server.mjs';
import { createGuide } from '../server/guide.mjs';

/** A stand-in for the Anthropic client that records calls. */
function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (req) => {
          calls.push(req);
          const r = typeof reply === 'function' ? reply(req) : reply;
          return { stop_reason: r.stop_reason || 'end_turn', content: [{ type: 'text', text: JSON.stringify(r.json ?? r) }] };
        },
      },
    },
  };
}

async function start(opts) {
  const logs = [];
  const app = createApp({ log: (l) => logs.push(l), ...opts });
  await new Promise((r) => app.listen(0, r));
  const base = `http://127.0.0.1:${app.address().port}`;
  return { base, logs, close: () => new Promise((r) => app.close(r)) };
}

const post = (base, path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const turns = (text) => [{ stage: 1, question: 'Where does your mind go?', selected: ['Replaying things'], freeText: text }];

test('health says whether the AI guide is configured', async () => {
  const s = await start({ guide: null });
  const h = await (await fetch(s.base + '/api/health')).json();
  assert.deepEqual(h, { ok: true, ai: false, model: null });
  const r = await post(s.base, '/api/turn', { turns: turns('x') });
  assert.equal(r.status, 503);
  await s.close();
});

test('a turn: one Claude call with strict JSON, cleaned reply, and no answer text in logs', async () => {
  const client = fakeClient({
    reflection: ['Guess: you replay the past.', 'Porn makes your face ugly.', 'Want to say more?'],
    corrections: [],
    mapUpdates: [{ section: 'mind', note: 'Replaying' }],
    nextQuestion: 'When did that last happen? What did you do?',
    options: ['Yesterday', 'Today'],
    safetyFlag: false,
    ageFlag: false,
  });
  const guide = createGuide({ client });
  const s = await start({ guide });
  const secret = 'my very private answer about my habit';
  const res = await post(s.base, '/api/turn', { stage: 1, stageGoal: 'g', draftMap: {}, turns: turns(secret) });
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.deepEqual(out.reflection, ['Guess: you replay the past.']);
  assert.equal(out.nextQuestion, 'When did that last happen?');
  assert.equal(client.calls.length, 1);
  const req = client.calls[0];
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.fallbacks, 'default');
  assert.ok(req.messages[0].content.includes(secret));
  assert.ok(!s.logs.join('\n').includes(secret), 'answers never appear in logs');
  await s.close();
});

test('a crisis answer never reaches the model and is flagged', async () => {
  const client = fakeClient({});
  const s = await start({ guide: createGuide({ client }) });
  const out = await (await post(s.base, '/api/turn', { stage: 3, turns: turns('i want to kill myself') })).json();
  assert.equal(out.safetyFlag, true);
  assert.equal(client.calls.length, 0);
  assert.equal(out.nextQuestion, null);
  await s.close();
});

test('model safety flag wins over everything else', async () => {
  const client = fakeClient({ reflection: ['I hear you.', 'More text'], corrections: ['x'], mapUpdates: [], nextQuestion: 'Q?', options: ['a'], safetyFlag: true, ageFlag: false });
  const s = await start({ guide: createGuide({ client }) });
  const out = await (await post(s.base, '/api/turn', { stage: 3, turns: turns('it is all too much') })).json();
  assert.equal(out.safetyFlag, true);
  assert.deepEqual(out.reflection, ['I hear you.']);
  assert.equal(out.nextQuestion, null);
  await s.close();
});

test('refusals and broken output become errors (the app then uses its own guide)', async () => {
  const s1 = await start({ guide: createGuide({ client: fakeClient({ stop_reason: 'refusal', json: {} }) }) });
  assert.equal((await post(s1.base, '/api/turn', { turns: turns('x') })).status, 502);
  await s1.close();
  const bad = { beta: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }) } } };
  const s2 = await start({ guide: createGuide({ client: bad }) });
  assert.equal((await post(s2.base, '/api/map', { turns: turns('x') })).status, 502);
  await s2.close();
});

test('map and section endpoints return cleaned parts', async () => {
  const client = fakeClient((req) => (req.output_config.format.schema.required.includes('origins') && req.output_config.format.schema.required.length > 1
    ? { origins: [{ then: 'Hid', now: 'Quiet' }], coreBelief: { belief: 'I am small', rule: 'Impress', replacement: 'I am enough' }, thinkingHabits: [], nervousSystem: { response: 'escape', bodySignal: 'stomach', weakTimes: ['late night'], weakSpots: [] }, values: { intrinsic: ['Creating'], approvalBased: [] }, loop: { habit: 'h', trigger: 't', urge: 'u', action: 'a', relief: 'r', cost: 'c' }, strengths: [{ strength: 'S', evidence: 'E' }], actions: ['A1', 'A2', 'A3'] }
    : { actions: ['New 1', 'New 2', 'New 3'] }));
  const s = await start({ guide: createGuide({ client }) });
  const map = await (await post(s.base, '/api/map', { turns: turns('x'), draftMap: {} })).json();
  assert.equal(map.nervousSystem.response, 'escape');
  assert.equal(map.coreBelief.confidence, 'guess');
  const sec = await (await post(s.base, '/api/map/section', { section: 'actions', turns: turns('x'), draftMap: map })).json();
  assert.deepEqual(sec, { actions: ['New 1', 'New 2', 'New 3'] });
  assert.equal((await post(s.base, '/api/map/section', { section: 'bogus', turns: turns('x') })).status, 400);
  await s.close();
});

test('CORS only for allowed origins; optional client token; rate limit; body limit', async () => {
  const s = await start({ guide: createGuide({ client: fakeClient({ reflection: ['ok'] }) }), allowedOrigins: ['https://appassets.androidplatform.net'], clientToken: 't0k', rateLimit: { max: 2, windowMs: 60000 } });
  const pre = await fetch(s.base + '/api/turn', { method: 'OPTIONS', headers: { Origin: 'https://appassets.androidplatform.net' } });
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  const evil = await fetch(s.base + '/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal((await post(s.base, '/api/turn', { turns: turns('x') })).status, 401);
  const h = { 'X-Client-Token': 't0k' };
  assert.equal((await post(s.base, '/api/turn', { turns: turns('x') }, h)).status, 200);
  assert.equal((await post(s.base, '/api/turn', { turns: turns('x') }, h)).status, 200);
  assert.equal((await post(s.base, '/api/turn', { turns: turns('x') }, h)).status, 429);
  await s.close();
  const s2 = await start({ guide: createGuide({ client: fakeClient({}) }) });
  assert.equal((await post(s2.base, '/api/turn', { turns: turns('x'.repeat(300000)) })).status, 413);
  await s2.close();
});

test('only the app is served — never server code or docs', async () => {
  const s = await start({ guide: null });
  assert.equal((await fetch(s.base + '/')).status, 200);
  assert.equal((await fetch(s.base + '/js/engine/safety.js')).status, 200);
  assert.equal((await fetch(s.base + '/server/server.mjs')).status, 404);
  assert.equal((await fetch(s.base + '/docs/HANDOFF.md')).status, 404);
  assert.equal((await fetch(s.base + '/js/../server/guide.mjs')).status, 404);
  await s.close();
});
