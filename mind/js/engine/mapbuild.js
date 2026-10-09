// Builds the seven-section map (handoff §4) from the analysed answers.
// Used on the phone (no AI), as the live "map so far" during the interview,
// and as the fallback when the AI guide is off or offline.

import { analyse, evidence } from './analyse.js';
import { SIG } from './signals.js';
import { BELIEFS } from './beliefs.js';
import { FOCUSES } from './content.js';
import { joinAnd, upper1, lower1, quote } from './util.js';

export const DISCLAIMER = 'This is a draft from your own answers, not a diagnosis.';

export const SECTIONS = [
  { id: 'origins', n: 1, title: 'Where it started' },
  { id: 'coreBelief', n: 2, title: 'Core belief (best guess)' },
  { id: 'mind', n: 3, title: 'How your mind works' },
  { id: 'values', n: 4, title: 'What matters to you' },
  { id: 'loop', n: 5, title: 'The main loop' },
  { id: 'strengths', n: 6, title: 'Strengths' },
  { id: 'actions', n: 7, title: 'What to change' },
];

const CORE = [
  {
    id: 'small', belief: 'I am small unless I am impressive.',
    rule: 'If I impress people, I am safe. If I don’t, they will see I am nothing.',
    replacement: 'I am enough as I am. What I build is a bonus, not my ticket in.',
    w: { 'orig.compared': 2, 'orig.money': 2, 'orig.grades': 1, 'cope.bigStory': 3, 'val.admired': 2, 'think.compare': 2, 'think.judged': 1, 'cope.prove': 1, 'x.admiredDropped': 2, 'trig.judged': 1 },
  },
  {
    id: 'notEnough', belief: 'I am not good enough as I am.',
    rule: 'I must be perfect, or I will be rejected.',
    replacement: 'I am good enough as I am, mistakes included.',
    w: { 'think.selfCritic': 2, 'think.allOrNothing': 2, 'orig.scolded': 2, 'orig.grades': 2, 'cope.prove': 2, 'talk.harsh': 1, 'talk.perfect': 1 },
  },
  {
    id: 'different', belief: 'I am different, and different means I don’t belong.',
    rule: 'Stay quiet so nobody notices.',
    replacement: 'Being different is fine. The right people will like the real me.',
    w: { 'orig.different': 3, 'orig.shy': 2, 'orig.teased': 2, 'social.quiet': 1, 'cope.hide': 2, 'think.selfWatch': 1 },
  },
  {
    id: 'burden', belief: 'My feelings are too much for other people.',
    rule: 'Hide what I feel and keep everyone happy.',
    replacement: 'My feelings are normal, and it is okay to show them.',
    w: { 'social.hideHurt': 2, 'social.nod': 2, 'cope.nice': 3, 'orig.conflict': 1, 'orig.scolded': 1, 'cope.cry': 1, 'act.mask': 2 },
  },
  {
    id: 'unsafe', belief: 'Something bad is about to happen.',
    rule: 'Stay alert and in control, or things will fall apart.',
    replacement: 'I can handle what comes, one step at a time.',
    w: { 'think.worry': 3, 'orig.conflict': 2, 'ns.fight': 1, 'ns.freeze': 1, 'act.pushThrough': 1 },
  },
  {
    id: 'alone', belief: 'I am on my own. Nobody will really be there.',
    rule: 'Don’t need anyone. Handle everything alone.',
    replacement: 'I can let people help me.',
    w: { 'orig.alone': 3, 'trig.lonely': 2, 'cope.escape': 1, 'act.pushThrough': 1, 'act.askHelp': -2, 'recover.told': -1 },
  },
];

const ORIGIN = {
  'cope.hide': { then: 'Hiding or keeping quiet when you felt small', now: [['social.quiet', 'Going quiet in group disagreements'], ['social.hideHurt', 'Hiding hurt and laughing along'], [null, 'Keeping your real self out of sight']] },
  'cope.bigStory': { then: 'Telling bigger stories to feel big enough', now: [['val.admired', 'Wanting to be admired — a future where people look up to you'], ['think.compare', 'Comparing yourself with others'], [null, 'Feeling you must impress to be enough']] },
  'cope.nice': { then: 'Being extra nice so nobody was upset', now: [['social.nod', 'Nodding along to keep the peace'], ['social.hideHurt', 'Hiding hurt to keep things smooth'], [null, 'Putting others’ comfort before your own voice']] },
  'cope.prove': { then: 'Working hard to prove yourself', now: [['think.allOrNothing', 'Perfect-or-nothing standards'], ['think.selfCritic', 'A harsh inner critic'], [null, 'Feeling you must earn your place']] },
  'cope.anger': { then: 'Getting angry', now: [['ns.fight', 'A fight response under stress'], [null, 'Anger as a first response']] },
  'cope.escape': { then: 'Escaping into games, TV or imagination', now: [['step.app', 'Escaping into the phone when stuck or alone'], ['act.distract', 'Reaching for the phone when things are hard'], ['think.fantasy', 'Daydreaming about a better life'], [null, 'Escaping when things feel bad']] },
  'cope.cry': { then: 'Crying — feelings showed straight away', now: [['social.hideHurt', 'Feeling hurt easily, then hiding it'], [null, 'Feeling things strongly']] },
  'cope.clown': { then: 'Making people laugh', now: [['social.jokeBack', 'Using humour to stay safe in groups'], [null, 'Humour as protection']] },
};

const lbl = (id) => SIG[id]?.label || id;

/** Full map from stored turns. Pass `an` to reuse an existing analysis. */
export function buildMap(turns, { an = analyse(turns), nightHour = 23 } = {}) {
  const has = (id) => an.sig.has(id);
  const ids = [...an.sig.keys()];
  const answered = (stepId) => turns.some((t) => t.stepId === stepId && !t.skipped && !t.flagged && ((t.selectedIds || []).length || (t.freeText || '').trim()));
  if (answered('no-audience') && has('val.admired') && !has('keep.admired')) an.sig.set('x.admiredDropped', []);

  const map = {
    origins: origins(has, ids),
    coreBelief: coreBelief(has),
    thinkingHabits: thinking(an, has),
    nervousSystem: nervous(an, has, turns),
    values: values(has, ids, answered('no-audience')),
    loop: loop(an, has, ids, turns),
    strengths: strengths(an, has, ids),
    actions: [],
    disclaimer: DISCLAIMER,
  };
  map.actions = actions(has, map, nightHour);
  an.sig.delete('x.admiredDropped');
  return map;
}

const MEMORY_SHORT = {
  'orig.compared': 'being compared', 'orig.grades': 'poor marks', 'orig.money': 'feeling small about money',
  'orig.teased': 'being teased', 'orig.scolded': 'being scolded', 'orig.different': 'feeling different',
  'orig.alone': 'being left alone', 'orig.conflict': 'tension at home', 'orig.shy': 'being shy',
};

function origins(has, ids) {
  const memories = ids.filter((id) => id.startsWith('orig.')).map((id) => MEMORY_SHORT[id] || lower1(lbl(id)));
  const copes = ids.filter((id) => id.startsWith('cope.'));
  const when = memories.length ? ` (after ${joinAnd(memories.slice(0, 3))})` : '';
  const out = copes.map((id, i) => {
    const o = ORIGIN[id];
    const now = o.now.find(([sig]) => sig === null || has(sig))[1];
    return { then: o.then + (i === 0 ? when : ''), now };
  });
  if (!out.length && memories.length) out.push({ then: upper1(joinAnd(memories)), now: 'Not clear yet — what did little you do to cope? You can add it here.' });
  return out;
}

function coreBelief(has) {
  let best = null;
  for (const c of CORE) {
    const score = Object.entries(c.w).reduce((s, [id, w]) => s + (has(id) ? w : 0), 0);
    if (!best || score > best.score) best = { ...c, score };
  }
  if (!best || best.score < 3) {
    return { id: 'unclear', belief: 'Not clear yet.', rule: 'Answer the early-memory questions, or write your own best guess here.', replacement: 'I can learn how my mind works, one answer at a time.', confidence: 'guess' };
  }
  return { id: best.id, belief: best.belief, rule: best.rule, replacement: best.replacement, confidence: 'guess' };
}

const THINK = ['think.judged', 'think.selfWatch', 'think.compare', 'think.replay', 'think.selfCritic', 'think.allOrNothing', 'think.feelingIsFact', 'think.worry', 'think.overthink', 'think.waitUntilFixed', 'think.fantasy'];

function thinking(an, has) {
  const out = THINK.filter(has).map((id) => ({ name: lbl(id), example: `You said: “${quote(evidence(an, id), 80)}”` }));
  // "I feel it, so it is true": a feeling about yourself treated as a fact
  if (has('talk.looks') || has('talk.hopeless')) {
    out.push({ name: lbl('think.feelingIsFact'), example: has('talk.looks') ? 'Feeling ugly after a slip, and taking it as proof the habit changes your looks.' : 'Feeling hopeless, and taking it as proof you will never change.' });
  }
  return out;
}

function nervous(an, has, turns) {
  const score = { escape: 0, fight: 0, freeze: 0, shutdown: 0 };
  for (const k of Object.keys(score)) {
    for (const ev of an.sig.get('ns.' + k) || []) score[k] += ev.stage === 1 ? 1 : 2;
  }
  score.escape += ['step.app', 'step.bed', 'step.browse', 'step.isolate', 'feel.numb', 'act.distract'].filter(has).length;
  score.fight += has('habit.anger') ? 2 : 0;
  const top = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  const response = top[1] > 0 ? top[0] : 'unclear';

  const bodyIds = ['stomach', 'chest', 'throat', 'head', 'restless'].map((k) => 'body.' + k);
  const urgeBody = bodyIds.filter((id) => an.sig.get(id)?.some((e) => e.stage === 3)).map(lbl);
  const anyBody = bodyIds.filter(has).map(lbl);
  const body = urgeBody.length ? urgeBody : anyBody;

  const weakTimes = ['time.lateNight', 'time.evening', 'time.afternoon', 'time.morning'].filter(has).map(lbl);
  const weakSpots = [];
  if (has('trig.blocked') || has('trig.waiting')) weakSpots.push(has('trig.blocked') && has('trig.waiting') ? 'when blocked or waiting' : has('trig.blocked') ? 'when blocked on a task' : 'when waiting');
  if (has('place.bed') || has('step.bed')) weakSpots.push('in bed with the phone');
  if (has('trig.alone') || has('place.alone')) weakSpots.push('alone in your room');
  if (has('trig.tired')) weakSpots.push('when tired');
  if (has('trig.lonely')) weakSpots.push('when lonely');
  return {
    response,
    bodySignal: body.length ? joinAnd(body) : 'not clear yet',
    weakTimes,
    weakSpots,
    corrected: !!an.guesses.ns?.corrected,
  };
}

function values(has, ids, answered5b) {
  const picked = ids.filter((id) => id.startsWith('val.'));
  const kept = new Set(ids.filter((id) => id.startsWith('keep.')).map((id) => 'val.' + id.slice(5)));
  const intrinsic = [];
  const add = (s) => { if (s && !intrinsic.some((x) => x.split(' — ')[0] === s.split(' — ')[0])) intrinsic.push(s); };
  for (const id of picked) if (answered5b ? kept.has(id) : id !== 'val.admired') add(lbl(id));
  if (has('does.creating')) add(lbl('does.creating'));
  if (has('does.growth')) add(lbl('does.growth'));
  const approvalBased = picked.filter((id) => (answered5b ? !kept.has(id) : id === 'val.admired')).map(lbl);
  return { intrinsic, approvalBased };
}

const HABIT_IDS = ['habit.phone', 'habit.porn', 'habit.gaming', 'habit.food', 'habit.substance', 'habit.delay', 'habit.anger', 'habit.other'];

export function habitOf(turns, has) {
  const id = HABIT_IDS.find(has);
  const t = turns.find((x) => x.stepId === 'habit');
  if (id && id !== 'habit.other') return lbl(id);
  if (t?.freeText?.trim()) return quote(t.freeText, 40).toLowerCase();
  return id ? 'the habit' : '';
}

function loop(an, has, ids, turns) {
  const habit = habitOf(turns, has);
  const trig = ids.filter((id) => id.startsWith('trig.')).map(lbl);
  const when = ['time.lateNight', 'time.evening', 'time.afternoon', 'time.morning'].filter(has).map(lbl);
  if (has('place.bed')) when.push('in bed with the phone');
  else if (has('place.alone')) when.push('alone in your room');
  // the first small step(s); "lying in bed" is already said by the place
  const steps = ids.filter((id) => id.startsWith('step.') && id !== 'step.unknown' && !(id === 'step.bed' && has('place.bed'))).slice(0, 2).map(lbl);
  const body = nervous(an, has, turns).bodySignal;

  const relief = [];
  if (has('feel.relief')) relief.push('a moment of relief');
  if (has('feel.numb')) relief.push('numb autopilot');
  if (has('feel.goodThenBad')) relief.push('feels good for a moment');
  let reliefText = relief.length ? upper1(joinAnd(relief)) : 'A short break from the feeling';
  if (has('feel.noJoy')) reliefText += ' — though not even enjoyable';

  const cost = [];
  if (has('cost.sleep') || has('time.lateNight')) cost.push('lost sleep');
  if (has('step.skipRoutine')) cost.push('skipped the good things');
  if (has('feel.guilt') || has('feel.goodThenBad')) cost.push('guilt');
  if (has('talk.harsh')) cost.push('harsh self-talk');
  if (has('recover.avoidPeople')) cost.push('avoiding people');
  if (has('talk.looks')) cost.push('feeling worse about how you look');

  return {
    habit,
    trigger: trig.length ? upper1(joinAnd(trig)) : 'Not clear yet — the slip review will show it',
    urge: body !== 'not clear yet' ? `An urge, felt first in your ${body}` : 'An urge (the body signal is not clear yet)',
    action: (steps.length ? upper1(joinAnd(steps)) + (habit ? `, then ${habit}` : '') : upper1(habit || 'Not clear yet')) + (when.length ? ` — ${when.join(', ')}` : ''),
    relief: reliefText,
    cost: (cost.length ? upper1(joinAnd(cost)) : 'Less time, energy and confidence') + ' — which makes the next trigger stronger',
  };
}

function strengths(an, has, ids) {
  const out = [];
  const ev = (id) => quote(evidence(an, id), 90);
  const add = (strength, evidenceText) => { if (evidenceText) out.push({ strength, evidence: evidenceText }); };

  if (has('act.actsNow') || has('does.growth') || has('does.creating')) {
    const did = has('does.growth') ? ev('does.growth') : has('does.creating') ? ev('does.creating') : '';
    add('You act on what you believe in', did ? `You do it with nobody watching: “${did}”` : `You said: “${ev('act.actsNow')}”`);
  }
  if (has('strength.cleanRun')) add('You can go many days without it', `In your words: “${ev('strength.cleanRun')}”`);
  if (has('strength.reduced')) add('You have already cut it down', `In your words: “${ev('strength.reduced')}”`);
  if (has('strength.stopped')) add('You catch yourself and stop', `In your words: “${ev('strength.stopped')}”`);
  const body3 = ['stomach', 'chest', 'throat', 'head', 'restless'].filter((k) => an.sig.get('body.' + k)?.some((e) => e.stage === 3));
  if (body3.length) add('You can feel the urge early', `You noticed it in your ${joinAnd(body3.map((k) => lbl('body.' + k)))}.`);
  if (has('social.speaks') || has('social.topicDependent')) add('You speak up when you know a topic', `You said: “${ev(has('social.speaks') ? 'social.speaks' : 'social.topicDependent')}”`);
  if ((has('talk.kind') || has('talk.none')) && !has('talk.harsh')) add('You recover without beating yourself up', `After a slip: “${ev(has('talk.kind') ? 'talk.kind' : 'talk.none')}”`);
  if (has('recover.routine')) add('You get back to your routine', `You said: “${ev('recover.routine')}”`);
  if (has('recover.review')) add('You learn from slips', `You said: “${ev('recover.review')}”`);
  if (has('act.askHelp') || has('recover.told')) add('You can let people in', `You said: “${ev(has('act.askHelp') ? 'act.askHelp' : 'recover.told')}”`);
  if (has('social.showHurt')) add('You are honest about feelings', `You said: “${ev('social.showHurt')}”`);
  if (has('think.building') && !out.some((s) => s.strength.startsWith('You act'))) add('You are a builder', `You said: “${ev('think.building')}”`);
  if (ids.some((id) => id.startsWith('trig.') || id.startsWith('step.'))) add('You can look honestly at a hard moment', 'You walked through your last slip, step by step, without hiding it.');
  return out.slice(0, 6);
}

function actions(has, map, nightHour) {
  const a = [];
  const habit = map.loop.habit;
  const body = map.nervousSystem.bodySignal;
  if (habit) {
    const first = has('step.app') ? ' and opening an app “for a small look”' : has('step.bed') ? ' and picking up the phone in bed' : '';
    a.push(`Urge plan: your earliest signals are ${body !== 'not clear yet' ? `the feeling in your ${body}` : 'the first urge'}${first}. When one shows up, stand up, breathe out slowly and start the 20-minute timer. The urge rises and falls like a wave.`);
  }
  if (has('think.waitUntilFixed')) a.push('Drop the “life starts after I quit” rule. Go to class, work and friends now — a fuller day leaves the habit less room.');
  if (has('think.judged') || has('social.quiet') || has('think.selfWatch')) a.push('Attention outward: in conversations, put your attention on the other person’s words, not on how you look. Plus one small, low-risk disagreement a day.');
  if (has('talk.looks')) a.push('Thought record for “I look ugly”: write the evidence for and against, then a more balanced thought.');
  else if (has('talk.harsh') || has('think.selfCritic') || has('talk.hopeless')) a.push('Thought record when the inner critic gets loud: evidence for, evidence against, a fairer thought.');
  if (habit) a.push(has('recover.restart') && !has('recover.review') ? 'After any slip, do the 2-minute slip review instead of only restarting the count.' : 'After any slip, do the 2-minute slip review: trigger, first small step, one change.');
  if (has('time.lateNight') || has('place.bed') || has('step.bed')) a.push(`Night mode: the phone sleeps outside your bedroom from ${nightHour}:00.`);
  if (has('trig.blocked') || has('trig.waiting') || has('body.restless')) a.push('Keep a short next-task list for blocked or waiting moments, so restless energy has somewhere to go.');
  if (map.coreBelief.id !== 'unclear') a.push(`Practise a new belief daily: “${map.coreBelief.replacement}”`);
  const fallback = ['Notice the first small step before a hard moment, once a day.', 'Use the thought record once this week.', 'Write down one thing you did today that you believe in.'];
  while (a.length < 3) a.push(fallback[a.length]);
  return a.slice(0, 5);
}

/** Stage 8: focus options, most relevant first. */
export function focusOptions(turns, an = analyse(turns)) {
  const has = (id) => an.sig.has(id);
  const relevant = {
    loop: HABIT_IDS.some(has),
    social: ['think.judged', 'social.quiet', 'think.selfWatch', 'social.hideHurt', 'social.nod'].some(has),
    selftalk: ['think.selfCritic', 'talk.harsh', 'talk.looks', 'talk.hopeless'].some(has),
    belief: true,
    restless: ['trig.blocked', 'trig.waiting', 'trig.bored', 'body.restless', 'act.actsNow'].some(has),
    night: ['time.lateNight', 'place.bed', 'step.bed'].some(has),
  };
  return [...FOCUSES].sort((a, b) => Number(relevant[b.id]) - Number(relevant[a.id])).map((f) => ({ ...f, relevant: relevant[f.id] }));
}

/** The kind challenge text for a belief id, used by the thought record. */
export function beliefPrompt(id) {
  return BELIEFS.find((b) => b.id === id);
}
