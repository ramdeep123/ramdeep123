// The on-phone interviewer's brain (works with no internet and no AI).
//
// analyse(turns) replays every answer in order and returns:
//  - sig:      signal id → evidence list (what the user tapped or typed)
//  - guesses:  current best guesses (stress response, body signal, …)
//  - perTurn:  the reflection shown after each answer: corrections first,
//              then kind challenges to unhelpful beliefs, then patterns,
//              then single observations — at most five lines.
//
// Because it is a pure replay of the stored turns, resuming an interview,
// regenerating the map and testing all use the same code path.

import { stepById } from './content.js';
import { SIG, signalsForTurn } from './signals.js';
import { findBeliefs, replyFor } from './beliefs.js';
import { joinAnd, quote } from './util.js';

const NS_LABEL = { fight: 'fight', escape: 'escape', freeze: 'freeze', shutdown: 'shutdown' };
const ESCAPE_STORY = ['step.app', 'step.bed', 'step.browse', 'step.isolate', 'feel.numb', 'act.distract'];

/** Pattern lines, shown once, the first time all conditions hold. */
const LINKS = [
  { id: 'judged-quiet', all: ['think.judged', 'social.quiet'], covers: ['social.quiet'], text: 'Pattern: you worry how people see you, and going quiet keeps you safe.' },
  { id: 'topic', all: ['social.topicDependent'], any: ['social.quiet', 'think.judged', 'think.selfWatch'], covers: ['social.topicDependent', 'social.quiet', 'social.speaks'], text: 'So it is not that you can’t speak up. You speak freely on topics you know, and go quiet when it feels personal or social.' },
  { id: 'escape-phone', all: ['ns.escape'], any: ['step.app', 'step.bed', 'step.browse'], text: 'Pattern: escape again — and the phone is the exit door.' },
  { id: 'blocked-builder', any: ['trig.blocked', 'trig.waiting'], any2: ['act.actsNow', 'think.building', 'does.creating'], covers: ['trig.blocked'], text: 'Pattern: you move fast on things you believe in. Being blocked or waiting takes that away — and that is when the urge comes.' },
  { id: 'late-bed', all: ['time.lateNight'], any: ['place.bed', 'step.bed'], covers: ['time.lateNight', 'place.bed', 'step.bed'], text: 'Weak point: late night, in bed, phone in hand.' },
  { id: 'restart-noreview', all: ['recover.restart'], none: ['recover.review'], covers: ['recover.restart'], text: 'Restarting the count without looking at what happened leaves the trigger in place. A 2-minute slip review fixes that.' },
  { id: 'bounce', any: ['talk.kind', 'talk.none'], any2: ['recover.routine'], none: ['talk.harsh'], covers: ['recover.routine', 'talk.kind', 'talk.none'], text: 'You bounce back without beating yourself up. That is a real strength.' },
  { id: 'avoid-loop', all: ['recover.avoidPeople'], any: ['trig.lonely', 'trig.alone', 'place.alone'], text: 'Avoiding people after a slip creates more alone time — and being alone came before the slip. A loop inside the loop.' },
  { id: 'story-admired', all: ['cope.bigStory'], any: ['val.admired', 'think.compare', 'think.judged'], text: 'Then → now: as a child, bigger stories helped you feel big enough. Today, being admired and other people’s opinions play the same role.' },
  { id: 'hide-quiet', all: ['cope.hide'], any: ['social.quiet', 'social.hideHurt'], text: 'Then → now: hiding kept little-you safe. Today it shows up as going quiet and hiding hurt.' },
  { id: 'escape-then', all: ['cope.escape'], any: ['ns.escape', 'act.distract', 'step.app'], text: 'Then → now: escaping into games or TV was little-you’s way out. The phone is today’s version.' },
  { id: 'compared', all: ['orig.compared'], any: ['think.compare', 'think.judged'], text: 'Then → now: being compared as a kid; watching how you compare and what others think, today.' },
  { id: 'nice-nod', all: ['cope.nice'], any: ['social.nod', 'social.hideHurt'], text: 'Then → now: being extra nice kept the peace back then. Nodding along does the same today.' },
  { id: 'prove', all: ['cope.prove'], any: ['think.allOrNothing', 'think.selfCritic'], text: 'Then → now: proving yourself back then; perfect-or-nothing and self-criticism today.' },
  { id: 'money', all: ['orig.money'], any: ['val.money', 'val.admired'], text: 'Then → now: feeling small about money as a kid makes sense of wanting security and respect today.' },
];

/** A warm line after some steps, so the guide does not sound like a form. */
const STEP_NOTES = {
  habit: 'Thanks for naming it. Now let’s look at how it works — no judgement.',
  'future-day': 'Your ordinary day says a lot about what you want. Next, let’s check which parts are truly yours.',
  memory: 'Thank you for sharing that. Old memories often explain today’s habits.',
};

const holds = (has, r) =>
  (r.all || []).every(has) &&
  (!r.any || r.any.some(has)) &&
  (!r.any2 || r.any2.some(has)) &&
  !(r.none || []).some(has);

export function analyse(turns = []) {
  const st = {
    sig: new Map(),
    guesses: {},
    shown: new Set(),
    beliefs: new Set(),
    perTurn: [],
  };
  turns.forEach((turn, i) => st.perTurn.push(applyTurn(st, turn, turns.slice(0, i))));
  return st;
}

export const hasSig = (an, id) => an.sig.has(id);
/** The user's own words for a signal: typed text first, else the option they tapped. */
export function evidence(an, id) {
  const list = an.sig.get(id) || [];
  return (list.find((e) => e.src === 'text') || list[0])?.text || '';
}

function applyTurn(st, turn, before) {
  if (turn.skipped) return { lines: ['Okay, we’ll skip that one.'], corrections: [], beliefs: [] };
  if (turn.flagged) return { lines: [], corrections: [], beliefs: [] };

  const step = stepById(turn.stage, turn.stepId, before);
  const fresh = signalsForTurn(turn, step);
  const newIds = [];
  for (const s of fresh) {
    if (!st.sig.has(s.id)) { st.sig.set(s.id, []); newIds.push(s.id); }
    st.sig.get(s.id).push(s);
  }
  const has = (id) => st.sig.has(id);
  const now = new Set(fresh.map((s) => s.id));

  const { corrections, fits, covers } = correct(st, turn, now, has);
  const beliefs = findBeliefs(turn.freeText, new Set(st.sig.keys()), st.beliefs);
  beliefs.forEach((b) => st.beliefs.add(b.id));

  // a line that already says it covers the single-signal notes
  const covered = new Set(covers);
  beliefs.forEach((b) => (b.covers || []).forEach((id) => covered.add(id)));

  const links = [];
  for (const r of LINKS) {
    if (st.shown.has('link:' + r.id) || !holds(has, r)) continue;
    st.shown.add('link:' + r.id);
    links.push(r.text);
    (r.covers || []).forEach((id) => covered.add(id));
  }

  const warm = STEP_NOTES[turn.stepId] && fresh.length ? [STEP_NOTES[turn.stepId]] : [];
  const notes = [];
  const body = newIds.filter((id) => id.startsWith('body.') && id !== 'body.unclear');
  if (body.length && !body.some((id) => covered.has(id))) {
    notes.push(`Your body signal shows up in your ${joinAnd(body.map((id) => SIG[id].label))}.`);
  }
  body.forEach((id) => covered.add(id));
  for (const id of newIds) {
    const n = SIG[id]?.note;
    if (!n || covered.has(id) || st.shown.has('note:' + id)) continue;
    st.shown.add('note:' + id);
    notes.push(n);
  }
  // typed answers get one line that quotes them back, so the user feels heard
  if (turn.freeText && turn.freeText.trim() && !warm.length && !notes.length && !links.length && !beliefs.length && !corrections.length) {
    notes.push(`Noted, in your words: “${quote(turn.freeText, 80)}”.`);
  }

  const sigSet = new Set(st.sig.keys());
  const lines = [...warm, ...corrections, ...beliefs.map((b) => replyFor(b, sigSet)), ...fits, ...links, ...notes].slice(0, 5);
  if (!lines.length) lines.push('Got it. That helps fill in the map.');
  return { lines, corrections, beliefs: beliefs.map((b) => b.id) };
}

/** Correct earlier guesses out loud when a new answer contradicts them. */
function correct(st, turn, now, has) {
  const out = [];
  const fits = []; // confirmations: shown with the patterns, not as corrections
  const covers = [];
  const g = st.guesses;

  // Stress response: first guess from the quick screen, checked against the story.
  if (turn.stage === 1 && turn.stepId === 'body-stress') {
    const ns = ['escape', 'freeze', 'fight', 'shutdown'].find((k) => now.has('ns.' + k));
    if (ns) g.ns = { value: ns, stage: 1 };
  }
  if (turn.stage >= 3) {
    const storyEscape = ESCAPE_STORY.filter((id) => now.has(id));
    if (storyEscape.length) {
      if (g.ns && g.ns.value !== 'escape' && !g.ns.corrected) {
        out.push(`This corrects my earlier guess. I said your stress response looked like “${NS_LABEL[g.ns.value]}”. Your story looks more like escape: ${SIG[storyEscape[0]].label}.`);
        g.ns = { value: 'escape', stage: turn.stage, corrected: true };
      } else if (!g.ns) {
        g.ns = { value: 'escape', stage: turn.stage };
      } else if (g.ns.value === 'escape' && !g.ns.confirmed) {
        g.ns.confirmed = true;
        fits.push('This fits my earlier guess: escape is your main stress response.');
      }
    }
  }

  // Body signal: "I can't tell what I feel" vs. noticing it in a real moment.
  if (turn.stage === 1 && now.has('body.unclear')) g.body = { value: 'unclear', stage: 1 };
  if (turn.stage === 3 && g.body?.value === 'unclear') {
    const parts = ['stomach', 'chest', 'throat', 'head', 'restless'].filter((k) => now.has('body.' + k)).map((k) => SIG['body.' + k].label);
    if (parts.length) {
      out.push(`This corrects my earlier guess. Earlier you said you can't tell what your body feels. But here you noticed it in your ${joinAnd(parts)}. That is your earliest warning signal — and it is useful.`);
      covers.push('body.stomach', 'body.chest', 'body.throat', 'body.head', 'body.restless');
      g.body = { value: parts.join(','), stage: 3, corrected: true };
    }
  }

  // Inner critic: loud at the start, but calm after a real slip (or the reverse).
  if (turn.stage === 4 && turn.stepId === 'self-talk') {
    const critic = st.sig.get('think.selfCritic')?.some((s) => s.stage < 4);
    if (critic && (now.has('talk.kind') || now.has('talk.none')) && !now.has('talk.harsh')) {
      out.push('This corrects my earlier guess. I thought the inner critic was loud. After a slip you were actually calm with yourself. So the critic may be more about how you look to others than about slips.');
    } else if (!critic && now.has('talk.harsh')) {
      out.push('This adds to my earlier picture: you didn’t pick self-criticism at the start, but after a slip the inner voice gets harsh. The critic shows up when you slip.');
    }
  }

  // Fear of judgement vs. actually speaking up.
  if (turn.stage === 2 && turn.stepId === 'group-disagree' && now.has('social.speaks') && !now.has('social.quiet') && st.sig.get('think.judged')?.some((s) => s.stage === 1)) {
    out.push('This corrects my earlier guess. You worry what people think — but you still speak up. The fear is there, but it doesn’t run you.');
  }

  // Values: wanting admiration, but not when nobody is watching.
  if (turn.stepId === 'no-audience' && has('val.admired') && !now.has('keep.admired') && (turn.selectedIds || []).length) {
    out.push('This corrects my earlier guess. Being admired looked like a goal, but with no audience you would drop it. Guess: it is more a way to feel big enough than something you love for itself.');
  }
  if (turn.stepId === 'no-audience') {
    const kept = [...now].filter((id) => id.startsWith('keep.')).map((id) => SIG[id].label.split(' — ')[0].toLowerCase());
    if (kept.length) fits.push(`What you would keep with nobody watching — ${joinAnd(kept)} — those are your own values.`);
  }
  return { corrections: out, fits, covers };
}
