import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testTurns as sampleTurns, turn } from './fixtures/test-user.mjs';
import { analyse } from '../js/engine/analyse.js';
import { buildMap, focusOptions, SECTIONS, DISCLAIMER } from '../js/engine/mapbuild.js';
import { newInterview, current, answer, advance, undo, progress, applyAiReflection, resumeAfterCrisis } from '../js/engine/interview.js';
import { STAGES, TOTAL_QUESTIONS, stepFor } from '../js/engine/content.js';
import { countQuestions } from '../js/engine/safety.js';

test('every scripted step asks exactly one question, with options', () => {
  for (const s of STAGES) {
    for (const step of s.steps) {
      assert.equal(countQuestions(step.q), 1, step.id);
      if (!step.dynamic) assert.ok(step.options.length >= 3, step.id);
    }
  }
  assert.ok(TOTAL_QUESTIONS >= 15 && TOTAL_QUESTIONS <= 22);
});

test('test user (handoff §13 profile, fictional details) → expected map highlights', () => {
  const map = buildMap(sampleTurns());
  assert.equal(map.coreBelief.id, 'small');
  assert.equal(map.coreBelief.belief, 'I am small unless I am impressive.');
  assert.equal(map.coreBelief.confidence, 'guess');
  assert.equal(map.nervousSystem.response, 'escape');
  assert.match(map.nervousSystem.bodySignal, /stomach/);
  assert.ok(map.nervousSystem.weakTimes.includes('late night'));
  assert.match(map.loop.trigger, /blocked/i);
  assert.match(map.loop.trigger, /waiting/i);
  assert.ok(map.values.intrinsic.some((v) => /creating/i.test(v)));
  assert.ok(map.values.intrinsic.some((v) => /growth|mastery/i.test(v)));
  assert.ok(map.values.approvalBased.includes('Being admired'));
  const actions = map.actions.join('\n');
  assert.match(actions, /urge plan/i);
  assert.match(actions, /life starts after I quit/i);
  assert.match(actions, /attention/i);
  assert.match(actions, /I look ugly/);
  assert.match(actions, /slip review/i);
  assert.ok(map.actions.length >= 3 && map.actions.length <= 5);
  assert.ok(map.origins.some((o) => /bigger stories/i.test(o.then)));
  assert.ok(map.strengths.length >= 3);
  for (const s of map.strengths) assert.ok(s.evidence, 'every strength has evidence');
});

test('the map has all seven sections and the "not a diagnosis" line', () => {
  const map = buildMap(sampleTurns());
  assert.equal(SECTIONS.length, 7);
  for (const k of ['origins', 'coreBelief', 'thinkingHabits', 'nervousSystem', 'values', 'loop', 'strengths', 'actions']) assert.ok(k in map, k);
  for (const k of ['trigger', 'urge', 'action', 'relief', 'cost']) assert.ok(map.loop[k], k);
  assert.equal(map.disclaimer, DISCLAIMER);
  assert.equal(DISCLAIMER, 'This is a draft from your own answers, not a diagnosis.');
});

test('reflections: guesses, corrections out loud, kind challenges, no questions', () => {
  const an = analyse(sampleTurns());
  const all = an.perTurn.flatMap((r) => r.lines);
  for (const r of an.perTurn) {
    assert.ok(r.lines.length >= 1 && r.lines.length <= 5);
    for (const l of r.lines) assert.equal(countQuestions(l), 0, l);
  }
  // "can't tell what I feel" (stage 1) vs stomach and chest (stage 3)
  assert.ok(all.some((l) => /^This corrects my earlier guess\. Earlier you said you can't tell/.test(l)));
  // loud critic (stage 1) vs calm after the slip (stage 4)
  assert.ok(all.some((l) => /inner critic was loud/.test(l)));
  // "this habit makes my face ugly" is questioned, not agreed with
  assert.ok(all.some((l) => /no good evidence that porn or masturbation changes your face/.test(l)));
  assert.ok(an.beliefs.has('looks') && an.beliefs.has('wait'));
  assert.ok(all.some((l) => /^Guess:/.test(l)));
});

test('an empty or skipped interview still makes a safe map', () => {
  const map = buildMap([]);
  assert.equal(map.coreBelief.id, 'unclear');
  assert.equal(map.nervousSystem.response, 'unclear');
  assert.ok(map.actions.length >= 3);
  assert.equal(map.disclaimer, DISCLAIMER);
});

test('free text alone (messy typing) still finds signals', () => {
  const t = turn(3, 'before', [], 'was so borred and waitng... felt it in my stomch around 2am');
  const an = analyse([t]);
  assert.ok(an.sig.has('trig.bored'));
  assert.ok(an.sig.has('body.stomach'));
});

test('flow: answer, advance, undo, resume, map and focus stages', () => {
  const iv = newInterview(0);
  let cur = current(iv);
  assert.equal(cur.kind, 'question');
  assert.equal(cur.step.id, 'mind-goes');
  answer(iv, cur.step, { selectedIds: ['replay'] }, 1);
  assert.ok(iv.turns[0].reflection.length);
  advance(iv);
  assert.equal(current(iv).step.id, 'body-stress');
  undo(iv);
  assert.equal(current(iv).step.id, 'mind-goes');
  assert.equal(iv.turns.length, 0);
  // run through every scripted step
  while (current(iv).kind === 'question') {
    const c = current(iv);
    answer(iv, c.step, { selectedIds: [c.step.options[0]?.id].filter(Boolean), freeText: c.step.options.length ? '' : 'something' });
    advance(iv);
  }
  assert.equal(current(iv).kind, 'map');
  advance(iv);
  assert.equal(current(iv).kind, 'focus');
  assert.equal(progress(iv).answered, TOTAL_QUESTIONS);
  const opts = focusOptions(iv.turns);
  assert.equal(opts.length, 6);
});

test('a crisis answer pauses the interview within the same turn', () => {
  const iv = newInterview(0);
  const step = current(iv).step;
  const { flag, turn: t } = answer(iv, step, { freeText: 'honestly i want to die' });
  assert.equal(flag, 'crisis');
  assert.equal(t.flagged, 'crisis');
  assert.equal(current(iv).kind, 'crisis');
  resumeAfterCrisis(iv);
  assert.equal(current(iv).kind, 'question');
  assert.equal(current(iv).step.id, 'body-stress');
});

test('an under-18 answer stops the interview', () => {
  const iv = newInterview(0);
  answer(iv, current(iv).step, { freeText: "i'm 16 and worried" });
  assert.equal(current(iv).kind, 'age');
});

test('AI follow-up: at most one per stage, and only one question', () => {
  const iv = newInterview(0);
  const step = current(iv).step;
  answer(iv, step, { freeText: 'idk' });
  applyAiReflection(iv, { reflection: ['Okay.'], corrections: [], mapUpdates: [], nextQuestion: 'When did you last feel that? Where were you?', options: ['Yesterday', 'Last week'] });
  advance(iv);
  const cur = current(iv);
  assert.equal(cur.ai, true);
  assert.equal(cur.step.q, 'When did you last feel that?');
  answer(iv, cur.step, { selectedIds: ['o0'] });
  applyAiReflection(iv, { reflection: ['Noted.'], nextQuestion: 'And another?', options: [] });
  advance(iv);
  assert.equal(current(iv).ai, undefined);
  assert.equal(current(iv).step.id, 'body-stress');
});

test('the "no audience" step offers the values the user picked', () => {
  const t = turn(5, 'future-day', ['creating', 'admired']);
  const step = stepFor(5, 1, [t]);
  assert.deepEqual(step.options.map((o) => o.id), ['creating', 'admired']);
});
