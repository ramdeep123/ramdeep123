# How to help build Know Your Mind

Thank you. This app talks to people about hard things, so **how** we build matters as much as **what** we build.

## Rules everyone follows

1. **Safety first.** Never weaken crisis detection, the Help button, the age gate or the "not a diagnosis" line. See [SAFETY.md](SAFETY.md).
2. **Privacy.** No analytics, no ads, no tracking SDKs, no logging of answers — not even "temporarily". Nothing leaves the phone unless the user turned on the AI guide.
3. **Tone.** Short, plain sentences. Guesses are labelled as guesses. No shame, no lectures, no empty praise. Question false beliefs kindly, with reasons.
4. **One question at a time**, about a real situation.
5. **No health claims** beyond well-established basics.

## Ways to help — no coding needed

- **Read the interview wording** in [`js/engine/content.js`](../js/engine/content.js) and the reflections in [`signals.js`](../js/engine/signals.js) and [`beliefs.js`](../js/engine/beliefs.js). Is anything unclear, cold, or judging? Open an issue with the line and a better version.
- **Translate** (Hindi first, then other Indian languages). Start with `content.js`.
- **Verify crisis lines** for your country and send the number with the official source.
- **Test it on your phone** and write down where you got stuck.
- **Mental-health professionals:** review the method and the belief replies.

## Ways to help — code

```bash
npm run test:mind        # all tests must pass
npm run start:mind       # http://localhost:8090
```

Good first tasks:

- Hindi version of the interview (`content.js`, then `signals.js` notes).
- Urge timer with guided audio (handoff "later" list).
- Weekly re-check that updates the map from the last week's slip reviews.
- Optional evening reminder for night mode on Android (KAYA's `ReminderReceiver` shows how).
- Biometric unlock on Android (BiometricPrompt through the `MindNative` bridge).
- Accessibility pass with TalkBack.

Before you open a pull request:

- [ ] `npm run test:mind` passes; you added tests for new engine logic.
- [ ] You tried the change in the browser at phone width, light **and** dark.
- [ ] No new dependency in the app (the server may use the Anthropic SDK only).
- [ ] No answer text in logs, errors or analytics.
- [ ] Wording follows the tone rules above.

Code style: plain ES modules, small pure functions in `js/engine/` (no DOM there, so they run in Node), screens in `js/views/` as functions that return HTML strings, clicks wired with `data-act`. Match the comment style of the file you edit.
