// The shape of everything the AI guide may return, shared by the server
// (which asks the model for exactly this JSON) and the app (which checks it
// again before showing anything). Model output is never trusted as-is:
// every string goes through the safety filters below.

import { dropQuestions, enforceOneQuestion, safeLine } from './safety.js';

const str = { type: 'string' };
const strList = { type: 'array', items: str };
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });

export const MAP_SECTIONS = ['origins', 'coreBelief', 'mind', 'values', 'loop', 'strengths', 'actions'];

export const TURN_SCHEMA = obj({
  reflection: strList,
  corrections: strList,
  mapUpdates: { type: 'array', items: obj({ section: { type: 'string', enum: MAP_SECTIONS }, note: str }) },
  nextQuestion: { anyOf: [str, { type: 'null' }] },
  options: strList,
  safetyFlag: { type: 'boolean' },
  ageFlag: { type: 'boolean' },
});

const MAP_PROPS = {
  origins: { type: 'array', items: obj({ then: str, now: str }) },
  coreBelief: obj({ belief: str, rule: str, replacement: str }),
  thinkingHabits: { type: 'array', items: obj({ name: str, example: str }) },
  nervousSystem: obj({
    response: { type: 'string', enum: ['fight', 'escape', 'freeze', 'shutdown', 'mixed', 'unclear'] },
    bodySignal: str,
    weakTimes: strList,
    weakSpots: strList,
  }),
  values: obj({ intrinsic: strList, approvalBased: strList }),
  loop: obj({ habit: str, trigger: str, urge: str, action: str, relief: str, cost: str }),
  strengths: { type: 'array', items: obj({ strength: str, evidence: str }) },
  actions: strList,
};

export const MAP_SCHEMA = obj(MAP_PROPS);

/** Which map keys each of the seven sections owns. */
export const SECTION_KEYS = {
  origins: ['origins'],
  coreBelief: ['coreBelief'],
  mind: ['thinkingHabits', 'nervousSystem'],
  values: ['values'],
  loop: ['loop'],
  strengths: ['strengths'],
  actions: ['actions'],
};

export function sectionSchema(section) {
  const props = {};
  for (const k of SECTION_KEYS[section]) props[k] = MAP_PROPS[k];
  return obj(props);
}

// ---------- cleaning ----------

const line = (s, max) => safeLine(typeof s === 'string' ? s : '', max);
const lines = (a, n, max) => (Array.isArray(a) ? a : []).map((s) => line(s, max)).filter(Boolean).slice(0, n);

/** A turn reply from the model, made safe to show. */
export function cleanTurn(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let q = typeof r.nextQuestion === 'string' ? enforceOneQuestion(line(r.nextQuestion, 240)) : null;
  if (q && !/[?？]$/.test(q)) q = null; // a follow-up must be a question
  return {
    reflection: dropQuestions(lines(r.reflection, 5, 400)),
    corrections: dropQuestions(lines(r.corrections, 2, 400)),
    mapUpdates: (Array.isArray(r.mapUpdates) ? r.mapUpdates : [])
      .filter((u) => u && MAP_SECTIONS.includes(u.section))
      .map((u) => ({ section: u.section, note: line(u.note, 200) }))
      .filter((u) => u.note && !/[?？]/.test(u.note))
      .slice(0, 6),
    nextQuestion: q || null,
    options: q ? dropQuestions(lines(r.options, 6, 80)) : [],
    safetyFlag: r.safetyFlag === true,
    ageFlag: r.ageFlag === true,
  };
}

const cleaners = {
  origins: (v) => (Array.isArray(v) ? v : []).map((o) => ({ then: line(o?.then, 200), now: line(o?.now, 200) })).filter((o) => o.then && o.now).slice(0, 5),
  coreBelief: (v) => ({ belief: line(v?.belief, 160), rule: line(v?.rule, 200), replacement: line(v?.replacement, 160), confidence: 'guess' }),
  thinkingHabits: (v) => (Array.isArray(v) ? v : []).map((o) => ({ name: line(o?.name, 80), example: line(o?.example, 200) })).filter((o) => o.name).slice(0, 8),
  nervousSystem: (v) => ({
    response: ['fight', 'escape', 'freeze', 'shutdown', 'mixed', 'unclear'].includes(v?.response) ? v.response : 'unclear',
    bodySignal: line(v?.bodySignal, 80) || 'not clear yet',
    weakTimes: lines(v?.weakTimes, 4, 60),
    weakSpots: lines(v?.weakSpots, 4, 80),
  }),
  values: (v) => ({ intrinsic: lines(v?.intrinsic, 6, 80), approvalBased: lines(v?.approvalBased, 6, 80) }),
  loop: (v) => ({
    habit: line(v?.habit, 60), trigger: line(v?.trigger, 160), urge: line(v?.urge, 160),
    action: line(v?.action, 200), relief: line(v?.relief, 160), cost: line(v?.cost, 200),
  }),
  strengths: (v) => (Array.isArray(v) ? v : []).map((o) => ({ strength: line(o?.strength, 100), evidence: line(o?.evidence, 220) })).filter((o) => o.strength && o.evidence).slice(0, 6),
  actions: (v) => lines(v, 5, 280),
};

/** A whole map (or some of its keys) from the model, cleaned. Missing keys are left out. */
export function cleanMapParts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, fn] of Object.entries(cleaners)) if (k in raw) out[k] = fn(raw[k]);
  return out;
}

/** True when a cleaned section has real content (else keep the on-phone version). */
export function sectionFilled(key, v) {
  if (Array.isArray(v)) return v.length > 0;
  if (key === 'coreBelief') return !!v?.belief;
  if (key === 'nervousSystem') return !!v?.response;
  if (key === 'values') return (v?.intrinsic?.length || 0) + (v?.approvalBased?.length || 0) > 0;
  if (key === 'loop') return !!(v?.trigger && v?.action);
  return !!v;
}

/** What the app sends: answers only — no names, ids or timestamps. */
export function compactTurns(turns) {
  return (turns || [])
    .filter((t) => !t.flagged)
    .map((t) => ({ stage: t.stage, question: t.question, selected: t.selected || [], freeText: t.freeText || '', skipped: !!t.skipped }));
}
