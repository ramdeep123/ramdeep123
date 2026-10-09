import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crisisCheck, ageCheck, enforceOneQuestion, countQuestions, dropQuestions, isFalseHealthClaim, dropFalseHealthClaims } from '../js/engine/safety.js';
import { cleanTurn } from '../js/engine/aishape.js';

test('crisis statements are caught (English, Hinglish, Hindi)', () => {
  for (const t of [
    'i want to die',
    'Sometimes I think about killing myself',
    'i feel like ending my life',
    'thinking about suicide lately',
    'i have been cutting myself',
    'I want to hurt myself',
    'no reason to live anymore',
    'i dont want to wake up tomorrow',
    'everyone would be better off dead without me — me i mean',
    'I want to kill him',
    'mujhe marna chahta hu',
    'mar jaun toh accha',
    'khudkushi ke baare me soch raha hu',
    'jeena nahi chahta',
    'मैं आत्महत्या के बारे में सोचता हूँ',
  ]) assert.equal(crisisCheck(t), true, t);
});

test('ordinary sentences do not trigger the crisis screen', () => {
  for (const t of [
    'I take myself to the gym every day',
    'this traffic is killing me',
    'I want to kill this urge',
    'kill my time with reels',
    'I hurt my knee at the gym',
    'the deadline is tomorrow, I could die of embarrassment',
    'i am dying to see the new film',
    '',
  ]) assert.equal(crisisCheck(t), false, t);
});

test('under-18 signals: explicit present age only', () => {
  for (const t of ['I am 16', "i'm 15 years old", 'im 17', 'my age is 14', 'I am in class 10']) assert.equal(ageCheck(t), true, t);
  for (const t of ['I am 25', 'in class 8 I was teased', 'when I was 12 my dad shouted', 'I was 12 days clean', 'i am in 12th', 'I am 6 days clean', 'I am 18']) assert.equal(ageCheck(t), false, t);
});

test('at most one question per message', () => {
  assert.equal(enforceOneQuestion('What happened next? And how did you feel?'), 'What happened next?');
  assert.equal(enforceOneQuestion('Tell me more.'), 'Tell me more.');
  assert.equal(countQuestions(enforceOneQuestion('a? b? c?')), 1);
  assert.deepEqual(dropQuestions(['A statement.', 'Is this a question?', '']), ['A statement.']);
});

test('false health claims are removed, honest denials are kept', () => {
  assert.equal(isFalseHealthClaim('Porn makes your face ugly.'), true);
  assert.equal(isFalseHealthClaim('Masturbation lowers your IQ over time.'), true);
  assert.equal(isFalseHealthClaim('Losing semen causes weakness.'), true);
  assert.equal(isFalseHealthClaim('There is no good evidence that porn changes your face.'), false);
  assert.equal(isFalseHealthClaim('Masturbation does not damage the brain.'), false);
  assert.equal(isFalseHealthClaim('Late nights make anyone look tired.'), false);
  assert.equal(dropFalseHealthClaims('Good sleep helps. Porn causes acne. Shame lowers mood.'), 'Good sleep helps. Shame lowers mood.');
});

test('model output is cleaned before it is shown', () => {
  const out = cleanTurn({
    reflection: ['Guess: you escape under stress.', 'Is that right?', 'Porn makes your face ugly.'],
    corrections: [],
    mapUpdates: [{ section: 'loop', note: 'Trigger: waiting' }, { section: 'nope', note: 'x' }],
    nextQuestion: 'What did you do next? And why?',
    options: ['Scrolled', 'Slept?', 'Went out'],
    safetyFlag: false,
    ageFlag: false,
  });
  assert.deepEqual(out.reflection, ['Guess: you escape under stress.']);
  assert.equal(out.nextQuestion, 'What did you do next?');
  assert.deepEqual(out.options, ['Scrolled', 'Went out']);
  assert.equal(out.mapUpdates.length, 1);
  assert.equal(cleanTurn({ nextQuestion: 'Tell me more.' }).nextQuestion, null);
  assert.equal(cleanTurn(null).safetyFlag, false);
});
