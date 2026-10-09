# Safety, privacy and launch checklist

These come from handoff §9 and §10. They are not optional.

## How each rule is enforced

| Rule | How | Test |
|---|---|---|
| Crisis statement → pause + crisis screen within one turn | `safety.crisisCheck` runs on the phone before anything else; server re-checks and skips the model; model's `safetyFlag` also pauses | `safety.test`, `engine.test`, `server.test` |
| Crisis screen reachable from every screen | The **Help** button is in every header, the lock screen and onboarding | manual |
| Not therapy | Onboarding notice + consent tick, map disclaimer, About | `engine.test` (disclaimer) |
| No false health claims | Belief replies written to the evidence; `dropFalseHealthClaims` on all model text; prompt rules | `safety.test`, `server.test` |
| No shame mechanics | No streaks, no leaderboards, nothing public; slips → "learning, not punishment" | — |
| Adults only | Age gate; explicit under-18 statements stop the interview | `safety.test`, `engine.test` |
| No explicit content | Clinical wording in all content and prompts | review |
| Encrypted at rest, app lock | `vault.js` AES-GCM, PIN → PBKDF2 | `privacy.test` |
| API key never in the app | Key only in `server/` env | review |
| No interview text in logs or analytics | No analytics SDKs; server logs method/path/status/time only | `server.test` |
| Export my data / delete everything | You → Your data | `privacy.test` |

Crisis detection is deliberately sensitive. A false alarm costs one gentle screen with "I'm safe right now — go back"; a miss costs far more. When you add phrases, add tests for both directions (`safety.test.mjs`).

## Crisis lines — verify before launch, then every 3 months

Lines live in [`js/engine/crisis-lines.js`](../js/engine/crisis-lines.js) with a `CHECKED` date shown to users.

| Region | Line | Number | Source to check |
|---|---|---|---|
| India | Tele-MANAS (Ministry of Health) | 14416 or 1-800-891-4416, 24×7 | telemanas.mohfw.gov.in |
| India | Emergency | 112 | 112.gov.in |
| US | 988 Suicide & Crisis Lifeline | call or text 988 | 988lifeline.org |
| UK / Ireland | Samaritans | 116 123 | samaritans.org |
| Anywhere | Find A Helpline | findahelpline.com | findahelpline.com |

Last checked 2026-10-09 from public sources. **Before launch a person must call or confirm each number from the official site**, then update `CHECKED`.

## Before publishing on Google Play

- [ ] Re-verify every crisis number (above) and update `CHECKED`.
- [ ] Read the current Google Play policies for **health apps**, **user data** and the **Data safety** form; declare what the AI guide sends (answers, no identity) or ship with the AI guide off.
- [ ] Play requires a recent target API and an app bundle: build `android/` with Android Studio / Gradle (the script here makes direct-install APKs).
- [ ] Create a real release keystore and keep it backed up (losing it means users must uninstall — and lose their data — to update).
- [ ] Have a mental-health professional review the wording in `content.js`, `signals.js`, `beliefs.js` and the prompts.
- [ ] Privacy policy page: on-device storage, what the AI guide sends, no storage on the server, how to delete.
- [ ] If the AI guide is on: host the server over https, set `ALLOWED_ORIGINS` and a spending limit on the Anthropic account.
- [x] The sample user (§13) is not in this public repository; tests use a fictional profile (`tests/fixtures/test-user.mjs`).
