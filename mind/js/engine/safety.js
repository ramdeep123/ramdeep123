// Safety rules shared by the app and the server (handoff §9).
//
// - Crisis detection runs on every answer BEFORE anything else, on the phone,
//   so the crisis screen shows within one turn even with no internet.
// - It is deliberately sensitive: a false alarm costs one gentle screen with a
//   "I'm safe, go back" button; a miss costs far more.
// - English plus common Hindi / Hinglish phrasings (the first users are in India).

const PEOPLE = '(him|her|them|someone|somebody|everyone|people|my\\s+(dad|father|papa|mom|mother|mum|maa|brother|sister|wife|husband|girlfriend|boyfriend|boss|friend|teacher|parents?|family))';

const CRISIS = [
  // suicide / wanting to die
  /\bkill(ing)?\s+my\s*self\b/i,
  /\b(end(ing)?|take|taking)\s+my\s+(own\s+)?life\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want(ed|s)?|wanna|ready|plan(ning)?)\s+(to\s+)?die\b/i,
  /\b(wish|wishing)\s+(i\s+)?(was|were)\s+(dead|never\s+born)\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bend\s+it\s+all\b/i,
  /\b(no|nothing)\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b/i,
  /\b(hang|hanging)\s+my\s*self\b/i,
  /\boverdos(e|ing)\b/i,
  /\bjump\s+(off|from)\s+(a|the|my)?\s*(roof|bridge|building|terrace)\b/i,
  // self-harm
  /\bself[\s-]?harm/i,
  /\b(hurting|harming|cutting|burning)\s+my\s*self\b/i,
  /\b(want|wanted|wanna|going|thinking\s+of|thought\s+of|feel\s+like|urge\s+to|try(ing)?\s+to|will)\s+(to\s+)?(hurt|harm|cut|burn)\s+my\s*self\b/i,
  // harming someone else
  new RegExp(`\\b(kill|murder|stab|shoot)\\s+${PEOPLE}\\b`, 'i'),
  new RegExp(`\\b(want|going|plan(ning)?)\\s+to\\s+(hurt|harm|attack|beat)\\s+${PEOPLE}\\b`, 'i'),
  // Hindi / Hinglish (Latin script)
  /\b(mar\s*ja(u|un|aun|ana|na|unga|ungi)|marna\s+(chah|hai)|mar\s+jaaun|khud\s*kushi|aatm?\s*hatya|atma?hatya|suicide\s+kar)/i,
  /\b(jee?na|jine|jeene)\s+(nahi|nhi|nai)\s+(hai|chahta|chahti|chahiye)/i,
  /\bzindagi\s+(khatam|se\s+tang)/i,
  // Devanagari
  /(आत्महत्या|ख़ुदकुशी|खुदकुशी|मरना\s*चाहत|मर\s*जाऊं|मर\s*जाऊँ|जीना\s*नहीं)/,
];

/** True when the text mentions suicide, self-harm or harming someone. */
export function crisisCheck(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return CRISIS.some((re) => re.test(t));
}

// Under-18 signals: only explicit present-tense statements of age, so an early
// memory ("in class 8 I was teased") does not trigger it.
const AGE = [
  /\bi\s*(?:'?m|am|m)\s+(?:only\s+|just\s+)?(1[0-7]|[5-9])\b(?!\s*(?:kg|kgs|days?|hours?|hrs?|min|mins|minutes|months?|weeks?|%|times|th|st|nd|rd))/i,
  /\b(?:i\s*(?:'?m|am)\s+)?(1[0-7]|[5-9])\s*(?:years?\s*old|yrs?\s*old|y\/?o)\b/i,
  /\bmy\s+age\s+is\s+(1[0-7]|[5-9])\b/i,
  /\b(?:i\s*(?:'?m|am)|currently)\s+in\s+(?:class\s+)?(?:[6-9]|1[0-2])(?:th)?\s*(?:class|grade|std|standard)?\b/i,
];

export function ageCheck(text) {
  const t = String(text || '');
  for (const re of AGE) {
    const m = t.match(re);
    if (!m) continue;
    // "I'm in 12th" can be 17 or 18: only class 6–11 counts
    if (/class|grade|std|standard|\bin\b/i.test(m[0]) && /(^|\D)12(?!\d)/.test(m[0])) continue;
    return true;
  }
  return false;
}

/**
 * Keep at most one question (handoff §12: "Every AI message contains at most
 * one question"). Everything after the first "?" is dropped.
 */
export function enforceOneQuestion(text) {
  const t = String(text || '').trim();
  const i = t.search(/[?？]/);
  if (i < 0) return t;
  return t.slice(0, i + 1).trim();
}

export const countQuestions = (text) => (String(text || '').match(/[?？]/g) || []).length;

/** Reflections are statements, never extra questions. */
export function dropQuestions(lines) {
  return (lines || []).map((l) => String(l || '').trim()).filter((l) => l && !/[?？]/.test(l));
}

// No false health claims (handoff §9.3): sentences that say porn or
// masturbation changes looks, lowers intelligence or damages the body are
// removed unless the sentence is clearly denying it.
const HABIT = /\b(porn\w*|masturbat\w*|fap\w*|self[-\s]?pleasure|semen|nofap)\b/i;
const HARM_VERB = /\b(caus\w*|mak\w*|lead\w*\s+to|damag\w*|shrink\w*|lower\w*|reduc\w*|ruin\w*|destroy\w*|chang\w*|harm\w*|weaken\w*|drain\w*|give\w*|result\w*\s+in)\b/i;
const HARM_OBJ = /\b(ugly|ugliness|acne|pimples?|hair\s*loss|bald\w*|face|looks?|appearance|skin|dark\s+circles|iq|intelligen\w*|brain\s+damage|damage\w*\s+(your|the)\s+brain|memory\s+loss|weak(ness)?|impoten\w*|infertil\w*|physical\s+damage|energy\s+loss)\b/i;
const DENIAL = /\b(no|not|doesn'?t|does\s+not|don'?t|do\s+not|isn'?t|is\s+not|won'?t|cannot|can'?t|never|myth|untrue|false|no\s+evidence|no\s+good\s+evidence)\b/i;

export function isFalseHealthClaim(sentence) {
  const s = String(sentence || '');
  return HABIT.test(s) && HARM_VERB.test(s) && HARM_OBJ.test(s) && !DENIAL.test(s);
}

export function dropFalseHealthClaims(text) {
  const parts = String(text || '').split(/(?<=[.!?])\s+/);
  return parts.filter((p) => !isFalseHealthClaim(p)).join(' ').trim();
}

/** Clean one line of model output: no false claims, no extra questions. */
export function safeLine(line, max = 320) {
  return dropFalseHealthClaims(String(line || '').replace(/\s+/g, ' ').trim()).slice(0, max);
}
