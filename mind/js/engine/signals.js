// Signals: the small facts the map is built from.
//
// Every answer becomes a list of signals, each with evidence (the option the
// user tapped or the words they typed). Signal ids look like "think.replay",
// "ns.escape", "body.stomach". The map, reflections and corrections only ever
// read signals, so the same engine works for tapped options and free text.

import { quote } from './util.js';

/**
 * label: short name used in the map; note: one reflection line (a guess,
 * in plain words) shown the first time the signal appears.
 */
export const SIG = {
  // thinking habits
  'think.replay': { label: 'Replaying the past', note: 'Guess: when your mind is free, it goes back and replays things.' },
  'think.judged': { label: 'Assuming others judge you', note: 'Guess: a big part of your thinking is about what other people think of you.' },
  'think.selfCritic': { label: 'Harsh self-talk', note: 'Guess: there is a loud inner critic.' },
  'think.worry': { label: 'What-if worrying', note: 'Guess: your mind runs ahead to what might go wrong.' },
  'think.compare': { label: 'Comparing yourself with others', note: 'Guess: you measure yourself against other people a lot.' },
  'think.fantasy': { label: 'Escaping into a better imagined life', note: 'Your mind escapes to a better life. That can be rest, or a way out of now.' },
  'think.building': { label: 'Planning and building', note: 'Your mind likes to plan and build. That is energy you can use.' },
  'think.blank': { label: 'Not sure yet', note: "Not knowing is fine. We'll find it through real moments instead." },
  'think.overthink': { label: 'Overthinking before acting', note: 'Guess: you think a long time before you act on hard things.' },
  'think.allOrNothing': { label: 'All-or-nothing thinking', note: 'Guess: things feel either perfect or failed, with little in between.' },
  'think.selfWatch': { label: 'Watching yourself through other people’s eyes', note: 'While you speak, part of your attention watches yourself. That makes talking harder.' },
  'think.feelingIsFact': { label: '“I feel it, so it is true”', note: 'Guess: when something feels true, your mind treats it as a fact.' },
  'think.waitUntilFixed': { label: '“Life starts after I fix this”', note: 'There may be a rule: “I can live fully only after I fix this.”' },

  // nervous system (stress response)
  'ns.fight': { label: 'Fight', note: 'Under stress your body gears up to fight — anger, arguing.' },
  'ns.escape': { label: 'Escape', note: 'Guess: under stress your first move is to get away. That is an “escape” response.' },
  'ns.freeze': { label: 'Freeze', note: 'Under stress you freeze — blank mind, stuck.' },
  'ns.shutdown': { label: 'Shutdown', note: 'Under stress you shut down — numb, tired, low.' },

  // body signals
  'body.stomach': { label: 'stomach', note: 'Your body signal shows up in your stomach.' },
  'body.chest': { label: 'chest', note: 'Your body signal shows up in your chest.' },
  'body.throat': { label: 'throat or jaw', note: 'Your body signal shows up in your throat or jaw.' },
  'body.head': { label: 'head or face', note: 'Your body signal shows up as heat in your head or face.' },
  'body.restless': { label: 'restless hands or legs', note: 'Your body signal is restlessness — hands, legs, can’t sit still.' },
  'body.unclear': { label: 'not clear yet', note: "You can't tell what your body feels yet. That's common. We'll look for it in a real moment." },

  // behaviour when things are hard
  'act.avoid': { label: 'Avoiding or delaying', note: 'When something is hard, you tend to avoid it or put it off.' },
  'act.distract': { label: 'Reaching for the phone', note: 'When something is hard, the phone is a quick way out.' },
  'act.pushThrough': { label: 'Pushing through feelings', note: 'You push through and ignore what you feel. It works — until it doesn’t.' },
  'act.mask': { label: 'Making it look fine', note: 'You make things look fine to others, even when they are not.' },
  'act.askHelp': { label: 'Asking for help', note: 'You ask for help. That is a real strength.' },
  'act.actsNow': { label: 'Acting on what you believe in', note: 'When you believe in something, you act on it right away.' },

  // social
  'social.quiet': { label: 'Going quiet in disagreements', note: 'In a group disagreement you go quiet.' },
  'social.nod': { label: 'Nodding along (people-pleasing)', note: 'You nod along to keep the peace. Guess: some people-pleasing.' },
  'social.speaks': { label: 'Speaking up', note: 'You say what you think, even when others disagree.' },
  'social.topicDependent': { label: 'Bold on some topics, quiet on others', note: 'You speak freely on some topics and go quiet on others.' },
  'social.replayLater': { label: 'Replaying conversations later', note: 'Later, you replay the conversation.' },
  'social.relief': { label: 'Relief after staying quiet', note: 'Staying quiet brings relief. Relief teaches the brain to stay quiet again next time.' },
  'social.letsGo': { label: 'Letting it go', note: 'You can let it go. Good.' },
  'social.hideHurt': { label: 'Hiding hurt', note: 'When a joke hurts, you hide it and laugh along.' },
  'social.showHurt': { label: 'Showing hurt', note: 'You show when something hurts. That is honest.' },
  'social.jokeBack': { label: 'Joking back', note: 'You can joke back. Humour is one of your tools.' },
  'social.secure': { label: 'Steady with jokes', note: 'Jokes about you don’t shake you much.' },

  // the habit
  'habit.phone': { label: 'phone and social media scrolling' },
  'habit.porn': { label: 'porn use' },
  'habit.gaming': { label: 'gaming' },
  'habit.food': { label: 'eating when not hungry' },
  'habit.substance': { label: 'smoking, drinking or substances' },
  'habit.delay': { label: 'putting things off' },
  'habit.anger': { label: 'anger outbursts' },
  'habit.other': { label: 'the habit' },

  // triggers (hours before)
  'trig.blocked': { label: 'blocked on a task', note: 'Before the slip, you were blocked on something.' },
  'trig.waiting': { label: 'waiting', note: 'Waiting was part of it. Empty, waiting time is a classic weak spot.' },
  'trig.bored': { label: 'bored', note: 'Boredom was part of it.' },
  'trig.lonely': { label: 'lonely', note: 'Loneliness was part of it.' },
  'trig.stress': { label: 'stressed', note: 'Stress was part of it.' },
  'trig.judged': { label: 'feeling judged or small', note: 'Feeling judged or small came before it.' },
  'trig.tired': { label: 'tired', note: 'Tiredness lowers the brakes. It was part of it.' },
  'trig.alone': { label: 'alone at home', note: 'Being alone at home was part of it.' },

  // first small step
  'step.app': { label: 'opening an app “just for a small look”', note: 'The first small step was opening an app “just for a look”. That small step is the real slip point.' },
  'step.bed': { label: 'lying in bed with the phone', note: 'The first small step was lying in bed with your phone.' },
  'step.browse': { label: 'browsing with no plan', note: 'The first small step was browsing with no plan.' },
  'step.skipRoutine': { label: 'skipping something good', note: 'Skipping something good (like the gym) was an early step. It removed a protector.' },
  'step.isolate': { label: 'staying alone in the room', note: 'Staying alone in your room was an early step.' },
  'step.justOnce': { label: 'telling yourself “just once”', note: '“Just once” was the permission thought. It is the habit talking, not you.' },
  'step.unknown': { label: 'not clear yet', note: 'It felt like it came from nowhere. Usually there is a small step — we will find it with the slip review.' },

  // when and where
  'time.lateNight': { label: 'late night', note: 'Weak time: late at night.' },
  'time.evening': { label: 'evening', note: 'Weak time: evening.' },
  'time.afternoon': { label: 'afternoon', note: 'Weak time: afternoon.' },
  'time.morning': { label: 'morning', note: 'Weak time: morning.' },
  'place.bed': { label: 'in bed with the phone', note: 'Weak place: in bed with the phone.' },
  'place.alone': { label: 'alone in your room', note: 'Weak place: alone in your room.' },
  'place.out': { label: 'outside', note: 'It happened outside the home.' },

  // how it felt / cost
  'feel.relief': { label: 'a moment of relief', note: 'It gave a moment of relief. That short relief is what keeps the loop going.' },
  'feel.noJoy': { label: 'not even enjoyable', note: 'You were not even enjoying it. That is a sign of a habit loop, not pleasure.' },
  'feel.numb': { label: 'numb, on autopilot', note: 'It felt numb, like autopilot. That fits an escape loop.' },
  'feel.guilt': { label: 'guilt straight after', note: 'Guilt came straight after.' },
  'feel.goodThenBad': { label: 'good, then bad', note: 'Good first, bad later — the classic loop shape.' },
  'cost.sleep': { label: 'lost sleep and a tired next day', note: 'It cost you sleep. Tired days make the next urge stronger.' },

  // morning after
  'talk.harsh': { label: 'Harsh self-talk after a slip', note: 'After a slip, the inner voice gets harsh.' },
  'talk.hopeless': { label: '“I\'ll never change”', note: '“I\'ll never change” is a feeling, not a fact.' },
  'talk.looks': { label: '“This habit makes me ugly”', note: '' },
  'talk.perfect': { label: '“From now on, perfect”', note: '“From now on I\'ll be perfect” sounds strong, but it sets up the next fall.' },
  'talk.kind': { label: 'Kind self-talk after a slip', note: 'After a slip you talk to yourself kindly.' },
  'talk.none': { label: 'Calm after a slip', note: 'After a slip you stay fairly calm and move on.' },
  'recover.restart': { label: 'Restarting the count', note: 'You restarted the count.' },
  'recover.review': { label: 'Reviewing what led to it', note: 'You looked at what led to it. That is exactly the right move.' },
  'recover.routine': { label: 'Back to routine', note: 'You went back to your routine. That is real recovery.' },
  'recover.punish': { label: 'Punishing yourself', note: 'You punished yourself. Punishment adds shame, and shame feeds the loop.' },
  'recover.avoidPeople': { label: 'Avoiding people after a slip', note: 'After a slip you avoid people. That leaves more empty, alone time.' },
  'recover.told': { label: 'Telling someone', note: 'You told someone. That takes courage.' },

  // values (future day) and what is kept with no audience
  'val.creating': { label: 'Creating — building your own things' },
  'val.mastery': { label: 'Mastery — getting really good at something' },
  'val.smartPeople': { label: 'Being around smart people' },
  'val.admired': { label: 'Being admired' },
  'val.love': { label: 'A loving relationship' },
  'val.calm': { label: 'A calm, healthy life' },
  'val.family': { label: 'Caring for family' },
  'val.art': { label: 'Making music or art' },
  'val.money': { label: 'Money security' },
  'val.helping': { label: 'Helping others' },
  // things the person already does with nobody watching (from free text)
  'does.growth': { label: 'Growth — training your body and mind' },
  'does.creating': { label: 'Creating — making things' },

  // origins
  'orig.compared': { label: 'Being compared with other kids' },
  'orig.grades': { label: 'Poor marks, told you’re not smart' },
  'orig.money': { label: 'Feeling small about money' },
  'orig.teased': { label: 'Being teased' },
  'orig.scolded': { label: 'Being scolded a lot' },
  'orig.different': { label: 'Feeling different' },
  'orig.alone': { label: 'Being left alone a lot' },
  'orig.conflict': { label: 'Tension at home' },
  'orig.shy': { label: 'Being very shy' },
  'cope.hide': { label: 'Hiding, keeping quiet' },
  'cope.bigStory': { label: 'Telling bigger stories' },
  'cope.nice': { label: 'Being extra nice' },
  'cope.prove': { label: 'Proving yourself' },
  'cope.anger': { label: 'Getting angry' },
  'cope.escape': { label: 'Escaping into games, TV, imagination' },
  'cope.cry': { label: 'Crying, showing it' },
  'cope.clown': { label: 'Making people laugh' },

  // strengths found in free text
  'strength.cleanRun': { label: 'Clean run', note: 'You have had clean runs. That proves the loop can be broken.' },
  'strength.reduced': { label: 'Already reduced it', note: 'You have already cut it down. That is evidence you can change.' },
  'strength.stopped': { label: 'Caught yourself and stopped', note: 'You caught yourself and stopped — more than once. That is a skill.' },
};

// keep.<valueId> → the value is kept with no audience
for (const k of Object.keys(SIG)) {
  if (k.startsWith('val.')) SIG['keep.' + k.slice(4)] = { label: SIG[k].label };
}

/**
 * Free-text patterns. Typos and Hinglish are expected, so the patterns are
 * loose. `stages` limits where a pattern counts (e.g. "money" means an origin
 * in stage 6 but a value in stage 5).
 */
const LEX = [
  ['think.replay', /\b(replay\w*|re-play\w*|keep thinking about|past)\b/i, [1, 2]],
  ['think.judged', /(what (people|others|they) (think|say)|judg(e|ed|ing)|log kya kahenge|how i look to)/i],
  ['think.selfCritic', /(critici[sz]\w*|hate myself|blame myself|i'?m (so )?(stupid|useless|worthless|a failure|pathetic))/i],
  ['think.worry', /\b(worr(y|ied|ies|ying)|anxious|anxiety|what if|tension)\b/i, [1]],
  ['think.compare', /\b(compar\w*)\b/i, [1, 2, 3, 4, 5]],
  ['think.overthink', /\b(over ?think\w*|think too much)\b/i],
  ['think.waitUntilFixed', /((after|once|until|till) i (quit|stop|fix|change|leave)|(life|everything|college) (will )?(start|begin)s? (after|when|once)|won'?t go .{0,30}(until|till|before) i)/i],
  ['ns.escape', /\b(escap\w*|run away|scroll\w*|sleep it off|hide in my room)\b/i, [1]],
  ['ns.fight', /\b(angry|anger|shout\w*|argue|gussa)\b/i, [1]],
  ['ns.freeze', /\b(freez\w*|froze|go blank|goes blank|can'?t move)\b/i, [1]],
  ['ns.shutdown', /\b(numb|shut ?down|no energy)\b/i, [1]],
  ['body.stomach', /\b(stomach|stomch|stomac|stmach|belly|gut|tummy|pet me)\b/i, [1, 3]],
  ['body.chest', /\b(chest|heart (beat|racing|pound)\w*)\b/i, [1, 3]],
  ['body.throat', /\b(throat|jaw)\b/i, [1, 3]],
  ['body.head', /\b(head|hot face|face (gets|goes) (hot|red))\b/i, [1, 3]],
  ['body.restless', /\b(restless|can'?t sit|jittery|shaky)\b/i, [1, 3]],
  ['body.unclear', /(can'?t (name|tell|feel)|don'?t (know|notice) what i feel|no idea what i feel)/i, [1, 3]],
  ['trig.blocked', /\b(block(ed)?|stuck|couldn'?t (do|finish|solve|fix)|not working|bug)\b/i, [3]],
  ['trig.waiting', /\b(wait\w*|wating)\b/i, [3]],
  ['trig.bored', /\b(bor+e?(d|ing|dom)|bore)\b/i, [3]],
  ['trig.lonely', /\b(lonely|loneliness)\b/i, [3]],
  ['trig.stress', /\b(stress\w*|pressure|deadline|exam)\b/i, [3]],
  ['trig.judged', /\b(judg\w*|reject\w*|insult\w*|laughed at|felt small)\b/i, [3]],
  ['trig.tired', /\b(tired|exhausted|sleepy)\b/i, [3]],
  ['step.app', /\b(insta(gram)?|reels?|youtube|shorts|snap(chat)?|twitter|facebook|reddit|tiktok|social (media|app)|small look|just (a )?(look|check|peek))\b/i, [3]],
  ['step.bed', /\b(in|on) (the |my )?bed\b/i, [3]],
  ['step.skipRoutine', /(skip(ped)? (the |my )?(gym|workout|meditation|walk|run|practice)|didn'?t go to (the )?gym|no gym)/i, [3]],
  ['step.justOnce', /\b(just once|only once|i deserve)\b/i, [3]],
  ['time.lateNight', /(\b([1-4])\s*(am|a\.m)\b|late ?ni(ght|te)|midnight|after 12|raat)/i, [3]],
  ['time.evening', /\b(evening|shaam)\b/i, [3]],
  ['time.morning', /\b(morning|subah)\b/i, [3]],
  ['place.bed', /\bbed\b/i, [3]],
  ['feel.noJoy', /((was ?n'?t|not|didn'?t|did not)( even)? enjoy\w*|no (joy|fun|pleasure))/i, [3]],
  ['feel.relief', /\b(relief|relieved)\b/i, [3]],
  ['feel.numb', /\b(numb|auto ?pilot|zombie)\b/i, [3]],
  ['feel.guilt', /\b(guilt\w*|shame\w*|ashamed|regret\w*)\b/i, [3, 4]],
  ['talk.harsh', /\b(useless|disgusting|loser|hate myself|failure)\b/i, [4]],
  ['talk.kind', /(it'?s ok|its ok|start again|be kind)/i, [4]],
  ['talk.none', /(no harsh|nothing much|moved on|didn'?t say anything|not harsh)/i, [4]],
  ['talk.looks', /(ugly|my face|look(s|ing)? (bad|ugly|worse|tired|old)|pimples?|acne|hair ?(fall|loss)|dark circles)/i, [3, 4]],
  ['recover.restart', /\b(restart\w*|streak|day 1|day one|counter|from zero)\b/i, [4]],
  ['recover.routine', /\b(meditat\w*|back to (my )?routine|journal\w*)\b/i, [4]],
  ['recover.review', /\b(review\w*|look(ed)? at what|analy[sz]\w*|what (led|caused))\b/i, [4]],
  ['social.topicDependent', /(depends|about (tech|science|code|coding|sports|cricket|games)|not about (people|social))/i, [2]],
  ['social.quiet', /\b(quiet|silent|say nothing|don'?t say|chup)\b/i, [2]],
  ['social.speaks', /\b(i (say|said) (what i think|my opinion)|i speak up|i argue|i disagree|argue freely)\b/i, [2]],
  ['social.hideHurt', /\b(hide|hid|hides|laugh along|pretend|don'?t show)\b/i, [2]],
  ['val.creating', /\b(build\w*|creat\w*|company|startup|business|my own (work|company)|apps?)\b/i, [5]],
  ['val.mastery', /\b(master\w*|expert|skill\w*|learn\w*)\b/i, [5]],
  ['val.smartPeople', /\b(smart|intelligent|brilliant) (people|friends|team)\b/i, [5]],
  ['val.admired', /\b(admir\w*|respect\w*|famous|status|look up to)\b/i, [5]],
  ['val.love', /\b(relationship|girlfriend|boyfriend|wife|husband|partner)\b/i, [5]],
  ['val.calm', /\b(calm|peace\w*|healthy)\b/i, [5]],
  ['val.family', /\b(family|parents|mom|dad|maa|papa)\b/i, [5]],
  ['val.art', /\b(music|art|paint\w*|draw\w*|guitar|sing\w*)\b/i, [5]],
  ['val.money', /\b(money|rich|wealth\w*|financial\w*)\b/i, [5]],
  ['val.helping', /\b(help\w* (people|others)|give back)\b/i, [5]],
  ['orig.compared', /\bcompar\w*/i, [6]],
  ['orig.grades', /\b(marks|grades|fail\w*|not smart|dumb|exam)\b/i, [6]],
  ['orig.money', /\b(money|poor|rich kids|afford|family money)\b/i, [6]],
  ['orig.teased', /\b(teas\w*|bull(y|ied)|mock\w*|laughed at)\b/i, [6]],
  ['orig.scolded', /\b(scold\w*|shout(ed)? at|beaten|punish\w*|daant|dant)\b/i, [6]],
  ['orig.different', /\b(different|didn'?t fit|weird|outsider)\b/i, [6]],
  ['orig.shy', /\bshy\b/i, [6]],
  ['cope.hide', /\b(hid|hide|quiet|silent)\b/i, [6]],
  ['cope.bigStory', /(big(ger)? stor(y|ies)|lied about|made (things )?up|invent\w*|show(ed)? off|boast\w*|bragg?\w*)/i, [6]],
  ['cope.nice', /\b(extra nice|good boy|good girl|please (everyone|people))\b/i, [6]],
  ['cope.prove', /\bprove\b/i, [6]],
  ['cope.escape', /\b(games?|tv|cartoons?|imagin\w*|daydream\w*)\b/i, [6]],
  ['cope.cry', /\b(cr(y|ied|ying))\b/i, [6]],
  ['does.growth', /\b(meditat\w*|journal\w*|gym|workout|exercis\w*|yoga|running|read(ing)? books)\b/i, [1, 2, 3, 4]],
  ['does.creating', /\b(music|guitar|piano|coding|code|build(ing)? (apps?|things|projects)|apps?)\b/i, [1, 2, 3, 4]],
  ['strength.cleanRun', /(\b\d{1,3}\s*(days?|din)\b.{0,25}(clean|without|no\b|streak)|(clean|streak|without).{0,25}\b\d{1,3}\s*(days?|din)\b)/i],
  ['strength.reduced', /\b(reduc\w*|less than before|cut down|better than (last|before)|improv\w*)\b/i],
  ['strength.stopped', /(stopp?ed (it )?(each|every) time|closed (it|the app)|put (the )?phone (down|away)|resisted)/i],
];

/** Signals from one interview turn, each with evidence text. */
export function signalsForTurn(turn, step) {
  const out = [];
  const ids = turn.selectedIds || [];
  for (const opt of step?.options || []) {
    if (!ids.includes(opt.id)) continue;
    for (const s of opt.sig) out.push({ id: s, stage: turn.stage, step: turn.stepId, src: 'option', text: opt.label });
  }
  // Follow-up questions written by the AI guide have no option ids: read the
  // tapped labels as text so they still count.
  const text = step ? (turn.freeText || '') : [...(turn.selected || []), turn.freeText || ''].join('. ');
  if (text.trim()) {
    for (const [id, re, stages] of LEX) {
      if (stages && !stages.includes(turn.stage)) continue;
      const m = text.match(re);
      if (m) out.push({ id, stage: turn.stage, step: turn.stepId, src: 'text', text: around(text, m.index, m[0].length) });
    }
  }
  return out;
}

/** The clause around a match, in the user's own words, for quoting. */
function around(text, i, len) {
  const [start, end] = clause(text, i, len);
  let a = start;
  if (end - start < 25 && start > 0) {
    const prevEnd = text.slice(0, start).replace(/([.;!?\n]|\s[-–—]\s)\s*$/, '').length;
    a = clause(text, Math.max(0, prevEnd - 1), 1)[0];
  }
  return quote(text.slice(a, end), 100);
}

function clause(text, i, len) {
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(/[.;!?\n]|\s[-–—]\s/g)) {
    if (m.index < i) start = m.index + m[0].length;
    else if (m.index >= i + len) { end = m.index; break; }
  }
  return [start, end];
}
