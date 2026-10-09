# HANDOFF: Self-Mapping App (working title: "Know Your Mind")

This file hands a product idea to a coding agent or developer. It contains the goal, the method the app must follow, the screens, the data model, a draft AI prompt, and the safety rules. Read all of it before writing code.

---

## 1. What we are building

An app where a person answers guided questions and gets back a clear "map" of how their mind works: thought patterns, core beliefs, nervous-system (stress) response, values, and a small change plan they can practise daily.

The method is CBT-style self-reflection led by an AI interviewer. It was tested in a real conversation and worked well for a user who types quickly and messily, dislikes abstract questions, and wanted to understand and change a compulsive habit and social fear.

**Who it is for:** adults (18+) who want to understand themselves and change habits such as compulsive phone or porn use, avoidance, overthinking, or social fear.

**What it is not:** therapy, diagnosis, or medical advice. The app must say this plainly at onboarding and in the map.

---

## 2. Interview rules (the core of the product)

The AI interviewer must follow these rules. They matter more than any feature.

1. Ask **one question at a time**.
2. Ask about **situations, not abstractions**. Bad: "How do you handle conflict?" Good: "Someone says something you disagree with and everyone nods. What goes through your mind, what do you do, and what do you think later that night?"
3. Offer **tappable options plus free text**. Many users find typing hard.
4. Use **plain, short sentences**. Accept typos and mixed language without comment.
5. After each answer, **reflect back a draft of the map** in a few lines, then ask the next question.
6. **Correct the map out loud** when a new answer contradicts an earlier guess ("This corrects my earlier guess...").
7. Label guesses as guesses. **Never diagnose** or name disorders as fact.
8. **Question unhelpful beliefs kindly, with reasons.** Do not agree with a false belief to be nice (example: "this habit makes my face ugly").
9. Name **real strengths** with evidence from the user's own answers. No empty praise.
10. No shame, no moral judgement, no lectures.

---

## 3. Interview flow

Each stage is one screen-sized exchange. The user can stop and resume at any time.

| # | Stage | What is asked | What it reveals |
|---|-------|---------------|-----------------|
| 1 | Quick screen | Three multi-select questions: where the mind goes most often, what the body does under stress, what the user does when something is hard | First draft of thoughts, body, behaviour |
| 2 | Social situation | A disagreement scenario in a group | Fear of judgement, people-pleasing, self-watching |
| 3 | Recent hard moment | "Walk me through the day of your last slip or bad moment. What happened in the hours before?" | Triggers, first small step, body signal, weak points |
| 4 | The morning after | "What did you say to yourself about yourself?" | Self-talk, recovery style |
| 5 | Future ordinary day | "It is five years from now and things went well. Describe one ordinary day." | Values, where self-worth comes from |
| 6 | Early memory | "What is one early memory of feeling small, different, or avoiding people?" | Origins, core belief |
| 7 | Full map | No question. The app generates the map (section 4) | |
| 8 | Choose a focus | "Which do you want to work on first?" | Starts the change plan (section 5) |

---

## 4. The map (main output)

The map is a saved, editable page with these sections:

1. **Where it started:** early experiences and the coping strategies they produced, each linked to a present-day behaviour ("then → now").
2. **Core belief (best guess):** one sentence, plus the life rule that follows from it.
3. **How your mind works:** thinking habits (for example all-or-nothing thinking, assuming others judge you, "I feel it so it is true"), nervous-system response (fight, escape, freeze, shutdown), earliest body signal, weakest times of day.
4. **What matters to you:** values shown by what the user does when nobody is watching, compared with what depends on other people's approval.
5. **The main loop:** trigger → urge → action → short relief → cost → more of the trigger. Show it as a simple cycle diagram.
6. **Strengths:** each with evidence from the user's answers.
7. **What to change:** three to five concrete actions.

Every map ends with: "This is a draft from your own answers, not a diagnosis."

---

## 5. Change tools (daily use after the map)

- **Urge plan:** the user records their earliest body signal, their usual "first small step" (for example opening a certain app), and a rule for each. Includes a 20 to 30 minute timer for letting an urge pass without feeding it.
- **Slip review (2 minutes):** three fields: what was the trigger, what was the first small step, what will I change. Framed as learning, not punishment.
- **Clean days per month:** show "12 of 13 days (92%)" instead of a streak that resets to zero.
- **Thought record:** the thought, evidence for, evidence against, a more balanced thought.
- **Attention practice:** a short prompt before social situations: "Put your attention on the other person's words, not on how you look." Plus one small, low-risk disagreement per day, logged afterwards.
- **New belief practice:** the user's chosen replacement belief shown daily.
- **Next-task list:** a short list to turn to when blocked or waiting, so restless energy has somewhere to go.
- **Night mode reminder:** an evening nudge to put the phone outside the bedroom.

---

## 6. Scope

**MVP**
- Onboarding with age gate (18+), "not therapy" notice, consent
- Interview stages 1 to 8 with save and resume
- Map page (view, edit, regenerate a section)
- Slip review, clean-days counter, thought record
- Crisis help screen reachable from every screen
- Delete all my data

**Later**
- Urge timer with guided audio
- Weekly re-check that updates the map
- Export map as PDF
- Multiple languages (Indian languages first)
- Optional reminders

---

## 7. Data model (sketch)

```json
{
  "user": { "id": "uuid", "ageConfirmed18": true, "language": "en" },
  "interview": {
    "stage": 4,
    "turns": [
      { "stage": 1, "question": "...", "options": ["..."], "selected": ["..."], "freeText": "..." }
    ]
  },
  "map": {
    "origins": [{ "then": "...", "now": "..." }],
    "coreBelief": { "belief": "...", "rule": "...", "confidence": "guess" },
    "thinkingHabits": ["..."],
    "nervousSystem": { "response": "escape", "bodySignal": "...", "weakTimes": ["late night"] },
    "values": { "intrinsic": ["..."], "approvalBased": ["..."] },
    "loop": ["trigger", "urge", "action", "relief", "cost"],
    "strengths": [{ "strength": "...", "evidence": "..." }],
    "actions": ["..."]
  },
  "tracking": {
    "days": [{ "date": "2026-10-09", "clean": true }],
    "slipReviews": [{ "date": "...", "trigger": "...", "firstStep": "...", "change": "..." }],
    "thoughtRecords": [{ "thought": "...", "for": "...", "against": "...", "balanced": "..." }]
  }
}
```

---

## 8. Draft system prompt for the AI interviewer

```
You are a warm, plain-spoken guide helping an adult understand how their own
mind works, using CBT-style self-reflection. You are not a therapist and you
never diagnose.

Rules:
- Ask exactly one question per message, and make it a concrete situation.
- Use short, simple sentences. Never comment on typos or grammar.
- After each answer, reflect back 3 to 5 short observations as a draft map,
  then ask the next question.
- Mark guesses as guesses. If a new answer contradicts an earlier guess,
  say so and correct it.
- Name strengths only with evidence from the user's own words.
- If the user states a belief that is not supported by evidence, say so
  kindly and explain what is more likely true.
- Never shame. Never moralise. Never promise results.
- Do not give medical advice or make claims about brain chemistry beyond
  well-established basics.
- If the user mentions wanting to die, self-harm, or harming someone, stop
  the interview, respond with care, and show the crisis help screen.
- If the user appears to be under 18, stop and show the age notice.

Current stage: {{stage}}
Stage goal: {{stage_goal}}
Map so far: {{map_json}}
Return JSON: { "reflection": [...], "mapUpdates": {...}, "nextQuestion": "...",
"options": [...], "safetyFlag": false }
```

---

## 9. Safety requirements (not optional)

1. **Crisis handling.** Detect mentions of suicide, self-harm, or harm to others. Pause the interview and show local crisis lines. Verify every phone number before launch and review them regularly.
2. **Not therapy.** State it at onboarding and on the map. Suggest a professional when a problem is severe or long-lasting.
3. **No false health claims.** The app must not claim that masturbation or porn changes appearance, lowers intelligence, or causes physical damage. It may say that compulsive use, lost sleep, and shame affect mood, energy, and confidence.
4. **No shame mechanics.** No public streaks, no leaderboards, no punishing messages after a slip.
5. **Adults only.** Age gate at onboarding. The content includes sexual-habit topics.
6. **No explicit content.** The app discusses habits in clinical language only.

---

## 10. Privacy requirements

- This is very sensitive data. Store as little as possible and encrypt it at rest and in transit.
- Prefer keeping the map and tracking data on the device. If a server is used, do not attach real names.
- AI calls go through our own backend. **Never put an API key inside the app.**
- Do not use analytics or ad SDKs that receive interview text.
- Provide "export my data" and "delete everything" in settings.
- App lock (PIN or biometric) so others who pick up the phone cannot read the map.
- Before publishing, check the current Google Play policies for health apps and user data.

---

## 11. Technical notes and open questions

**Assumptions (change if wrong):** mobile-first, Android first, published through Google Play. The AI is an LLM API reached through a small backend proxy.

**Open questions for the founder:**
1. Android only, or also web and iOS?
2. Free, paid, or free with a paid plan? (AI calls cost money per user.)
3. Which languages at launch?
4. Does data stay on the device only, or sync across devices?
5. App name and branding.

---

## 12. Acceptance criteria for the MVP

- A new user can finish the interview in 15 to 25 minutes and can stop and resume.
- Every AI message contains at most one question.
- The map contains all seven sections and the "not a diagnosis" line.
- A message containing a self-harm statement shows the crisis screen within one turn.
- "Delete everything" removes all local and server data.
- No interview text appears in logs or analytics.

---

## 13. Sample user for testing

Removed from this public copy, as the original handoff asks ("Remove this section before sharing the file widely"). The tests use a fictional profile with the same patterns: `tests/fixtures/test-user.mjs`.
