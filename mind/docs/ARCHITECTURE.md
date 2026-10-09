# How Know Your Mind works

Plain JavaScript modules, no framework, no build step. The same files run in the browser, inside the Android WebView, and (for the engine) in Node tests and on the server.

## The flow of one answer

```
 you tap chips / type
        │
        ▼
 engine/interview.answer()
   1. safety.crisisCheck(text) ──► crisis? pause + crisis screen (same turn, on the phone)
   2. safety.ageCheck(text)    ──► under 18? stop + age notice
   3. save the turn  { stage, stepId, question, options, selected, freeText }
   4. analyse(turns) → reflection lines (on-phone guide)
        │
        ├── AI guide on and online?
        │      ai.aiTurn() → server /api/turn → Claude (strict JSON)
        │      → server cleans → app cleans again → replaces the reflection
        │      (may add ONE follow-up question per stage)
        │
        ▼
 advance() → next question … stage 7: the map … stage 8: choose a focus
```

Everything is saved after each answer (encrypted), so the user can stop at any moment and resume exactly there.

## Signals: how answers become a map

Every option in [`content.js`](../js/engine/content.js) carries **signals** — tiny facts like `think.judged`, `ns.escape`, `body.stomach`, `trig.waiting`, `step.app`, `cope.bigStory`. Typed text is read with loose patterns in [`signals.js`](../js/engine/signals.js) (typos and Hinglish expected), producing the same signals with the user's own words as **evidence**.

[`analyse.js`](../js/engine/analyse.js) replays all turns in order:

- **notes** — the first time a signal appears, one plain line (marked "Guess:" where it is one);
- **patterns** — lines that fire once when several signals meet (`think.judged` + `social.quiet` → "going quiet keeps you safe");
- **corrections** — when a new answer contradicts an earlier guess, said out loud ("This corrects my earlier guess…"): stress response, body signal, the inner critic, speaking up, admiration with no audience;
- **beliefs** — unhelpful beliefs from [`beliefs.js`](../js/engine/beliefs.js), answered kindly with reasons.

Because it is a pure replay, resume, regenerate and tests all use one code path.

[`mapbuild.js`](../js/engine/mapbuild.js) turns signals into the seven sections. The core belief is a weighted guess over six templates (e.g. *"I am small unless I am impressive"* scores on being compared, money worries, telling bigger stories, wanting admiration that is dropped with no audience). Actions are picked by priority from what the map shows.

## Map data (handoff §7, extended)

```json
{
  "origins": [{ "then": "...", "now": "..." }],
  "coreBelief": { "belief": "...", "rule": "...", "replacement": "...", "confidence": "guess" },
  "thinkingHabits": [{ "name": "...", "example": "..." }],
  "nervousSystem": { "response": "escape", "bodySignal": "stomach and chest", "weakTimes": ["late night"], "weakSpots": ["when blocked or waiting"] },
  "values": { "intrinsic": ["..."], "approvalBased": ["..."] },
  "loop": { "habit": "...", "trigger": "...", "urge": "...", "action": "...", "relief": "...", "cost": "..." },
  "strengths": [{ "strength": "...", "evidence": "..." }],
  "actions": ["..."],
  "disclaimer": "This is a draft from your own answers, not a diagnosis."
}
```

The handoff sketched `loop` as a list of step names; here it holds the text of each step. Tracking follows §7: `days: [{ date, clean }]`, `slipReviews`, `thoughtRecords`, plus `urges`, `disagreements`, `beliefRatings`, `nights`, `tasks`.

## Storage and privacy

[`vault.js`](../js/vault.js): the whole state is one AES-GCM record in IndexedDB.
- No PIN: the key is a random, **non-extractable** WebCrypto key kept by the browser.
- PIN: the key is derived from the PIN (PBKDF2-SHA-256, 210 000 rounds). Five free tries, then a growing wait. No recovery — only "delete everything".
- The app locks again after a minute in the background. On Android, `FLAG_SECURE` blocks screenshots and the recent-apps preview; backups are off.

## The AI guide

[`server/guide.mjs`](../server/guide.mjs) makes one Claude call per request with a stable, prompt-cached system prompt ([`server/prompt.mjs`](../server/prompt.mjs)) and a JSON schema ([`aishape.js`](../js/engine/aishape.js)) so the reply is always valid JSON. Then:

1. crisis words in the newest answer → reply with `safetyFlag` **without** calling the model;
2. the model's own `safetyFlag` wins over everything else;
3. `cleanTurn` / `cleanMapParts`: at most one question, no questions inside reflections, no false health claims, length caps;
4. any failure (offline, refusal, bad JSON, timeout) → the app keeps the on-phone reflection.

What is sent: stage, stage goal, the draft map, and the answers (question, chosen options, typed text). No names, ids, timestamps, or flagged crisis text.

## Adding or changing a question

1. Edit the step in [`content.js`](../js/engine/content.js) — one question, a real situation, short sentences, 3–9 options, each with signals.
2. If you invent a new signal, describe it in `SIG` in [`signals.js`](../js/engine/signals.js) (label + one-line note) and, if typed words should count, add a pattern to `LEX`.
3. Use it in `mapbuild.js` (and maybe a pattern or correction in `analyse.js`).
4. `npm run test:mind` — the test-user test must still produce the handoff's expected map.
