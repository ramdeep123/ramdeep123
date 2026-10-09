// Interview flow (handoff §3): where the user is, what to ask next, how an
// answer is recorded. Pure functions over a plain object, so the UI can save
// after every answer and the user can stop and resume at any time.

import { STAGES, QUESTION_STAGES, TOTAL_QUESTIONS, stageByN, stepFor } from './content.js';
import { analyse } from './analyse.js';
import { crisisCheck, ageCheck, enforceOneQuestion } from './safety.js';
import { tidy } from './util.js';

export const MAX_FOLLOW_UPS_PER_STAGE = 1;

export function newInterview(now = Date.now()) {
  return { stage: 1, step: 0, turns: [], followUp: null, followUps: {}, done: false, focus: null, flag: null, startedAt: now, updatedAt: now };
}

/** What to show now: a question, the map reveal (7), or the focus choice (8). */
export function current(iv) {
  if (iv.done) return { kind: 'done' };
  if (iv.flag === 'age') return { kind: 'age' };
  if (iv.flag === 'crisis') return { kind: 'crisis' };
  const stage = stageByN(iv.stage);
  if (iv.followUp) {
    return {
      kind: 'question', stage, ai: true,
      step: {
        id: `ai-${iv.stage}`, multi: true, q: iv.followUp.question,
        options: (iv.followUp.options || []).map((label, i) => ({ id: 'o' + i, label, sig: [] })),
        placeholder: 'Say it your way…',
      },
    };
  }
  if (iv.stage === 7) return { kind: 'map', stage };
  if (iv.stage === 8) return { kind: 'focus', stage };
  const step = stepFor(iv.stage, iv.step, iv.turns);
  return { kind: 'question', stage, step, first: iv.step === 0 };
}

export function progress(iv) {
  const answered = iv.turns.filter((t) => !t.stepId.startsWith('ai-')).length;
  return {
    answered,
    total: TOTAL_QUESTIONS,
    pct: Math.min(1, iv.stage >= 7 ? 1 : answered / TOTAL_QUESTIONS),
    stage: iv.stage,
    stages: STAGES.map((s) => ({ n: s.n, short: s.short, state: s.n < iv.stage || iv.done ? 'done' : s.n === iv.stage ? 'now' : 'next' })),
  };
}

/**
 * Record an answer. Safety checks run first, on the phone, before any AI
 * call: a crisis statement pauses the interview within the same turn.
 * Returns { turn, flag } where flag is 'crisis', 'age' or null.
 */
export function answer(iv, step, { selectedIds = [], freeText = '', skipped = false } = {}, now = Date.now()) {
  const text = tidy(freeText, 1500);
  const chosen = step.options.filter((o) => selectedIds.includes(o.id));
  const turn = {
    stage: iv.stage,
    stepId: step.id,
    question: step.q,
    options: step.options.map((o) => o.label),
    selected: chosen.map((o) => o.label),
    selectedIds: chosen.map((o) => o.id),
    freeText: text,
    at: now,
  };
  if (skipped || (!chosen.length && !text)) turn.skipped = true;

  let flag = null;
  if (crisisCheck(text)) flag = 'crisis';
  else if (ageCheck(text)) flag = 'age';
  if (flag) turn.flagged = flag;

  iv.turns.push(turn);
  iv.updatedAt = now;
  if (flag) iv.flag = flag;

  if (flag) {
    turn.reflection = flag === 'crisis'
      ? ['Thank you for telling me. That sounds really hard. Let’s pause the questions — your safety comes first.']
      : ['This app is for adults (18+), so the questions stop here.'];
    turn.source = 'safety';
  } else {
    const r = analyse(iv.turns).perTurn.at(-1);
    turn.reflection = r.lines;
    turn.corrections = r.corrections;
    turn.source = 'local';
  }
  return { turn, flag };
}

/** Use the AI guide's reflection for the last turn (already validated). */
export function applyAiReflection(iv, ai) {
  const turn = iv.turns.at(-1);
  if (!turn || !ai) return;
  if (ai.reflection?.length) {
    turn.reflection = [...(ai.corrections || []), ...ai.reflection].slice(0, 5);
    turn.corrections = ai.corrections || [];
    turn.source = 'ai';
  }
  if (ai.mapUpdates?.length) turn.mapNotes = ai.mapUpdates;
  const used = iv.followUps[iv.stage] || 0;
  if (ai.nextQuestion && used < MAX_FOLLOW_UPS_PER_STAGE && iv.stage <= 6 && !iv.followUp && !turn.stepId.startsWith('ai-')) {
    iv.pendingFollowUp = { question: enforceOneQuestion(ai.nextQuestion), options: (ai.options || []).slice(0, 6) };
  }
}

/** Move to the next question (or the AI follow-up, if one was offered). */
export function advance(iv) {
  if (iv.pendingFollowUp) {
    iv.followUp = iv.pendingFollowUp;
    iv.followUps[iv.stage] = (iv.followUps[iv.stage] || 0) + 1;
    iv.pendingFollowUp = null;
    return;
  }
  const wasFollowUp = !!iv.followUp;
  iv.followUp = null;
  const stage = stageByN(iv.stage);
  if (wasFollowUp) {
    // a follow-up sits after the step that triggered it; continue from there
    if (iv.step + 1 < stage.steps.length) { iv.step++; return; }
  } else if (iv.stage <= 6 && iv.step + 1 < stage.steps.length) {
    iv.step++;
    return;
  }
  if (iv.stage < 8) { iv.stage++; iv.step = 0; }
}

/** Go back one answer, to change it. */
export function undo(iv) {
  const last = iv.turns.pop();
  if (!last) return false;
  iv.pendingFollowUp = null;
  iv.done = false;
  iv.flag = null;
  iv.stage = last.stage;
  if (last.stepId.startsWith('ai-')) {
    // re-ask the same follow-up
    iv.followUp = { question: last.question, options: last.options };
    const prev = [...iv.turns].reverse().find((t) => t.stage === last.stage && !t.stepId.startsWith('ai-'));
    iv.step = Math.max(0, stageByN(last.stage).steps.findIndex((s) => s.id === prev?.stepId));
  } else {
    iv.followUp = null;
    iv.step = Math.max(0, stageByN(last.stage).steps.findIndex((s) => s.id === last.stepId));
    if (iv.followUps[last.stage] && !iv.turns.some((t) => t.stage === last.stage && t.stepId.startsWith('ai-'))) iv.followUps[last.stage] = 0;
  }
  return true;
}

/** After the crisis screen, the person chose to go on. */
export function resumeAfterCrisis(iv) {
  if (iv.flag === 'crisis') iv.flag = null;
  advance(iv);
}

export function stageGoal(n) {
  return stageByN(n)?.goal || '';
}

export const isFinished = (iv) => iv.done;
export { QUESTION_STAGES };
