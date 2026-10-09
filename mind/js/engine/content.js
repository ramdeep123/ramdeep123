// The interview script (handoff §2–3).
//
// Rules this file must keep:
//  - one question per step, about a real situation, in short plain sentences;
//  - tappable options + free text on every step;
//  - every option maps to "signals" (see signals.js) that build the map.
//
// To change wording, edit here. To add a language, copy this file's strings.

export const STAGES = [
  {
    n: 1, id: 'quick', title: 'Quick screen', short: 'Quick',
    goal: 'First draft of thoughts, body and behaviour: where the mind goes, what the body does under stress, what the person does when something is hard.',
    intro: 'Three quick ones to start. Pick everything that fits. There are no right answers.',
    steps: [
      {
        id: 'mind-goes', multi: true,
        q: 'When your mind is free — on the bus, or in bed before sleep — where does it go most often?',
        options: [
          { id: 'replay', label: 'Replaying things from the past', sig: ['think.replay'] },
          { id: 'judged', label: 'Worrying what people think of me', sig: ['think.judged'] },
          { id: 'critic', label: 'Criticising myself', sig: ['think.selfCritic'] },
          { id: 'worry', label: 'Worrying about what could go wrong', sig: ['think.worry'] },
          { id: 'compare', label: 'Comparing myself with others', sig: ['think.compare'] },
          { id: 'dream', label: 'Daydreaming about a better life', sig: ['think.fantasy'] },
          { id: 'build', label: 'Planning or building things', sig: ['think.building'] },
          { id: 'blank', label: 'Not sure, it goes blank', sig: ['think.blank'] },
        ],
        placeholder: 'Or say it your way…',
      },
      {
        id: 'body-stress', multi: true,
        q: 'Stress hits — a deadline, a fight, bad news. What does your body do first?',
        options: [
          { id: 'fight', label: 'I get angry or want to argue', sig: ['ns.fight'] },
          { id: 'escape', label: 'I want to get away — scroll, leave, sleep', sig: ['ns.escape'] },
          { id: 'freeze', label: 'I freeze or go blank', sig: ['ns.freeze'] },
          { id: 'shutdown', label: 'I go numb or tired and shut down', sig: ['ns.shutdown'] },
          { id: 'chest', label: 'Tight chest or fast heart', sig: ['body.chest'] },
          { id: 'stomach', label: 'A knot in my stomach', sig: ['body.stomach'] },
          { id: 'hot', label: 'Hot face or head', sig: ['body.head'] },
          { id: 'restless', label: "Restless, I can't sit still", sig: ['body.restless'] },
          { id: 'unclear', label: "I can't really tell what I feel", sig: ['body.unclear'] },
        ],
        placeholder: 'What happens in your body?',
      },
      {
        id: 'when-hard', multi: true,
        q: 'Something is hard — a task, a talk, a problem. What do you usually do?',
        options: [
          { id: 'avoid', label: 'Avoid it or put it off', sig: ['act.avoid'] },
          { id: 'overthink', label: 'Overthink it for a long time', sig: ['think.overthink'] },
          { id: 'phone', label: 'Distract myself with my phone', sig: ['act.distract'] },
          { id: 'perfect', label: 'Do it perfectly or not at all', sig: ['think.allOrNothing'] },
          { id: 'push', label: 'Push through and ignore how I feel', sig: ['act.pushThrough'] },
          { id: 'mask', label: 'Make it look fine to others', sig: ['act.mask'] },
          { id: 'help', label: 'Ask someone for help', sig: ['act.askHelp'] },
          { id: 'believe', label: 'Start right away, if I believe in it', sig: ['act.actsNow'] },
        ],
        placeholder: 'e.g. I put off emails, but I never miss practice',
      },
    ],
  },
  {
    n: 2, id: 'social', title: 'A moment with people', short: 'People',
    goal: 'Fear of judgement, people-pleasing and self-watching in a group disagreement; what happens later; how hurt is shown or hidden.',
    intro: 'Now a real moment with people.',
    steps: [
      {
        id: 'group-disagree', multi: true,
        q: "You're with a group. Someone says something you disagree with, and everyone nods. What do you do?",
        options: [
          { id: 'quiet', label: 'Stay quiet', sig: ['social.quiet'] },
          { id: 'nod', label: 'Nod along too', sig: ['social.nod'] },
          { id: 'speak', label: 'Say what I think', sig: ['social.speaks'] },
          { id: 'depends', label: 'Depends on the topic', sig: ['social.topicDependent'] },
          { id: 'watch', label: 'If I speak, I watch how I look and sound', sig: ['think.selfWatch'] },
          { id: 'laugh', label: "I think they'd judge or laugh at me", sig: ['think.judged'] },
        ],
        placeholder: 'e.g. I speak up at work, but not with family',
      },
      {
        id: 'group-later', multi: true,
        q: 'Later that night, what goes through your mind about it?',
        options: [
          { id: 'replay', label: 'I replay what I should have said', sig: ['social.replayLater'] },
          { id: 'annoyed', label: "I'm annoyed at myself", sig: ['think.selfCritic'] },
          { id: 'relief', label: "Relief that I didn't say anything", sig: ['social.relief'] },
          { id: 'forget', label: 'I forget about it', sig: ['social.letsGo'] },
          { id: 'glad', label: "I'm glad I spoke up", sig: ['social.speaks'] },
        ],
        placeholder: 'What do you think about that night?',
      },
      {
        id: 'joke', multi: true,
        q: 'Someone makes a joke about you in front of others. What happens inside, and what do you show?',
        options: [
          { id: 'hide', label: 'It hurts, but I laugh along', sig: ['social.hideHurt'] },
          { id: 'show', label: 'I show that it hurt', sig: ['social.showHurt'] },
          { id: 'back', label: 'I joke back', sig: ['social.jokeBack'] },
          { id: 'fine', label: "Honestly, I don't mind", sig: ['social.secure'] },
          { id: 'days', label: 'I think about it for days', sig: ['social.replayLater'] },
        ],
        placeholder: 'Inside I feel… and I show…',
      },
    ],
  },
  {
    n: 3, id: 'slip', title: 'Your last hard moment', short: 'Hard moment',
    goal: 'Walk through the day of the last slip or bad moment: triggers in the hours before, the first small step, the earliest body signal, when and where it happened, how it felt.',
    intro: "Now your last hard moment. No judgement — we're looking at how it works, like a mechanic looks at an engine.",
    steps: [
      {
        id: 'habit', multi: false,
        q: 'Which habit or hard moment do you want to look at?',
        hint: 'Pick the one that matters most right now.',
        options: [
          { id: 'phone', label: 'Phone or social media scrolling', sig: ['habit.phone'] },
          { id: 'porn', label: 'Porn', sig: ['habit.porn'] },
          { id: 'gaming', label: 'Gaming', sig: ['habit.gaming'] },
          { id: 'food', label: 'Eating when not hungry', sig: ['habit.food'] },
          { id: 'substance', label: 'Smoking, drinking or other substances', sig: ['habit.substance'] },
          { id: 'delay', label: 'Putting off important things', sig: ['habit.delay'] },
          { id: 'anger', label: 'Anger outbursts', sig: ['habit.anger'] },
          { id: 'other', label: 'Something else', sig: ['habit.other'] },
        ],
        placeholder: 'Say it in your own words',
      },
      {
        id: 'before', multi: true,
        q: 'Think of the day of your last slip. In the hours before, what was going on?',
        options: [
          { id: 'blocked', label: 'Stuck or blocked on a task', sig: ['trig.blocked'] },
          { id: 'waiting', label: 'Waiting for something or someone', sig: ['trig.waiting'] },
          { id: 'bored', label: 'Bored, nothing to do', sig: ['trig.bored'] },
          { id: 'lonely', label: 'Lonely', sig: ['trig.lonely'] },
          { id: 'stress', label: 'Stressed or under pressure', sig: ['trig.stress'] },
          { id: 'judged', label: 'Felt judged, rejected or small', sig: ['trig.judged'] },
          { id: 'tired', label: 'Tired', sig: ['trig.tired'] },
          { id: 'alone', label: 'Alone at home', sig: ['trig.alone'] },
        ],
        placeholder: 'What happened that day?',
      },
      {
        id: 'first-step', multi: true,
        q: 'What was the very first small step — the thing before the thing?',
        hint: 'It usually looks harmless.',
        options: [
          { id: 'app', label: 'Opened an app “just for a small look”', sig: ['step.app'] },
          { id: 'bed', label: 'Lay in bed with my phone', sig: ['step.bed'] },
          { id: 'browse', label: 'Started browsing with no plan', sig: ['step.browse'] },
          { id: 'skip', label: 'Skipped something good (gym, a walk, a call)', sig: ['step.skipRoutine'] },
          { id: 'room', label: 'Stayed alone in my room', sig: ['step.isolate'] },
          { id: 'once', label: 'Told myself “just once” or “I deserve it”', sig: ['step.justOnce'] },
          { id: 'none', label: 'It came out of nowhere', sig: ['step.unknown'] },
        ],
        placeholder: 'e.g. opened Instagram a few times, stopped, then later…',
      },
      {
        id: 'body-signal', multi: true,
        q: 'When the urge first showed up, where did you feel it in your body?',
        options: [
          { id: 'stomach', label: 'Stomach', sig: ['body.stomach'] },
          { id: 'chest', label: 'Chest', sig: ['body.chest'] },
          { id: 'throat', label: 'Throat or jaw', sig: ['body.throat'] },
          { id: 'head', label: 'Head or face', sig: ['body.head'] },
          { id: 'hands', label: 'Restless hands or legs', sig: ['body.restless'] },
          { id: 'none', label: "I didn't notice anything", sig: ['body.unclear'] },
        ],
        placeholder: 'e.g. a pull in my stomach',
      },
      {
        id: 'when-where', multi: true,
        q: 'When and where did the slip actually happen?',
        options: [
          { id: 'late', label: 'Late at night (after 12)', sig: ['time.lateNight'] },
          { id: 'evening', label: 'Evening', sig: ['time.evening'] },
          { id: 'afternoon', label: 'Afternoon', sig: ['time.afternoon'] },
          { id: 'morning', label: 'Morning', sig: ['time.morning'] },
          { id: 'bed', label: 'In bed with my phone', sig: ['place.bed'] },
          { id: 'alone', label: 'Alone in my room', sig: ['place.alone'] },
          { id: 'out', label: 'Outside the home', sig: ['place.out'] },
        ],
        placeholder: 'e.g. around 1 am, in bed',
      },
      {
        id: 'during', multi: true,
        q: 'During it and right after, how did it feel?',
        options: [
          { id: 'relief', label: 'Relief for a moment', sig: ['feel.relief'] },
          { id: 'nojoy', label: "I wasn't even enjoying it", sig: ['feel.noJoy'] },
          { id: 'numb', label: 'Numb, on autopilot', sig: ['feel.numb'] },
          { id: 'guilt', label: 'Guilty straight away', sig: ['feel.guilt'] },
          { id: 'goodbad', label: 'Good, then bad later', sig: ['feel.goodThenBad'] },
          { id: 'tired', label: 'Tired the next day', sig: ['cost.sleep'] },
        ],
        placeholder: 'How did it feel?',
      },
    ],
  },
  {
    n: 4, id: 'after', title: 'The morning after', short: 'Morning after',
    goal: 'Self-talk after a slip and recovery style: harsh or kind, reviewing or just restarting, avoiding people.',
    intro: 'The morning after.',
    steps: [
      {
        id: 'self-talk', multi: true,
        q: 'The next morning, what did you say to yourself — about yourself?',
        options: [
          { id: 'harsh', label: '“I\'m useless” or “I\'m disgusting”', sig: ['talk.harsh'] },
          { id: 'never', label: '“I\'ll never change”', sig: ['talk.hopeless'] },
          { id: 'looks', label: '“This is making me ugly or weak”', sig: ['talk.looks'] },
          { id: 'perfect', label: '“From now on I\'ll be perfect”', sig: ['talk.perfect'] },
          { id: 'okay', label: '“It\'s okay, start again”', sig: ['talk.kind'] },
          { id: 'nothing', label: 'Nothing much, I just moved on', sig: ['talk.none'] },
        ],
        placeholder: 'What did you say to yourself?',
      },
      {
        id: 'next-did', multi: true,
        q: 'And what did you do next?',
        options: [
          { id: 'restart', label: 'Restarted my streak or count', sig: ['recover.restart'] },
          { id: 'review', label: 'Looked at what led to it', sig: ['recover.review'] },
          { id: 'routine', label: 'Went back to my routine', sig: ['recover.routine'] },
          { id: 'punish', label: 'Punished myself (skipped food, no fun)', sig: ['recover.punish'] },
          { id: 'avoid', label: 'Avoided people, college or work', sig: ['recover.avoidPeople'] },
          { id: 'told', label: 'Told someone', sig: ['recover.told'] },
        ],
        placeholder: 'What did you do?',
      },
    ],
  },
  {
    n: 5, id: 'future', title: 'A future ordinary day', short: 'Future day',
    goal: 'Values and where self-worth comes from: what the person wants for its own sake versus what depends on other people’s approval.',
    intro: 'Now something lighter.',
    steps: [
      {
        id: 'future-day', multi: true,
        q: "It's five years from now and things went well. Picture one ordinary day, morning to night. What's in it?",
        options: [
          { id: 'creating', label: 'Building my own work or company', sig: ['val.creating'] },
          { id: 'mastery', label: 'Getting really good at something', sig: ['val.mastery'] },
          { id: 'smartPeople', label: 'Surrounded by smart people', sig: ['val.smartPeople'] },
          { id: 'admired', label: 'People admire or respect me', sig: ['val.admired'] },
          { id: 'love', label: 'A loving relationship', sig: ['val.love'] },
          { id: 'calm', label: 'A calm, healthy routine', sig: ['val.calm'] },
          { id: 'family', label: 'Taking care of my family', sig: ['val.family'] },
          { id: 'art', label: 'Making music or art', sig: ['val.art'] },
          { id: 'money', label: 'Money is not a worry', sig: ['val.money'] },
          { id: 'helping', label: 'Helping other people', sig: ['val.helping'] },
        ],
        placeholder: 'Your morning, your work, your evening…',
      },
      {
        id: 'no-audience', multi: true, dynamic: 'keep',
        q: 'Now imagine nobody would ever know or praise you for any of it. Which parts would you still want?',
        hint: 'Pick the ones you would keep.',
        options: [], // filled from the previous answer — see stepFor()
        placeholder: 'What would you still do?',
      },
    ],
  },
  {
    n: 6, id: 'origins', title: 'An early memory', short: 'Early memory',
    goal: 'Origins: an early experience of feeling small, different or avoiding people, and the coping strategy it produced — the likely source of the core belief.',
    intro: 'Last stage. This one goes back in time. Share only what feels okay — you can skip any question.',
    steps: [
      {
        id: 'memory', multi: true,
        q: "What's one early memory of feeling small, different, or wanting to avoid people?",
        options: [
          { id: 'compared', label: 'Being compared with other kids', sig: ['orig.compared'] },
          { id: 'grades', label: "Poor marks, or told I'm not smart", sig: ['orig.grades'] },
          { id: 'money', label: 'Feeling small about money at home', sig: ['orig.money'] },
          { id: 'teased', label: 'Being teased or bullied', sig: ['orig.teased'] },
          { id: 'scolded', label: 'Being scolded a lot', sig: ['orig.scolded'] },
          { id: 'different', label: 'Feeling different from other kids', sig: ['orig.different'] },
          { id: 'alone', label: 'Being left alone a lot', sig: ['orig.alone'] },
          { id: 'conflict', label: 'Fights or tension at home', sig: ['orig.conflict'] },
          { id: 'shy', label: 'Being very shy', sig: ['orig.shy'] },
        ],
        placeholder: 'One memory, in a few words',
      },
      {
        id: 'coping', multi: true,
        q: 'What did little you do to cope?',
        options: [
          { id: 'hide', label: 'Hid or kept quiet', sig: ['cope.hide'] },
          { id: 'story', label: 'Told bigger stories to look impressive', sig: ['cope.bigStory'] },
          { id: 'nice', label: 'Was extra nice or good', sig: ['cope.nice'] },
          { id: 'prove', label: 'Worked hard to prove myself', sig: ['cope.prove'] },
          { id: 'anger', label: 'Got angry', sig: ['cope.anger'] },
          { id: 'escape', label: 'Escaped into games, TV or imagination', sig: ['cope.escape'] },
          { id: 'cry', label: 'Cried or showed it', sig: ['cope.cry'] },
          { id: 'clown', label: 'Made people laugh', sig: ['cope.clown'] },
        ],
        placeholder: 'What did you do back then?',
      },
    ],
  },
  {
    n: 7, id: 'map', title: 'Your map', short: 'Map', steps: [],
    goal: 'Generate the full map from all answers.',
  },
  {
    n: 8, id: 'focus', title: 'Choose a focus', short: 'Focus', steps: [],
    goal: 'The user picks what to work on first; this starts the change plan.',
  },
];

export const QUESTION_STAGES = STAGES.filter((s) => s.steps.length);
export const TOTAL_QUESTIONS = QUESTION_STAGES.reduce((n, s) => n + s.steps.length, 0);
export const stageByN = (n) => STAGES.find((s) => s.n === n);

/**
 * The step to show, with dynamic options resolved. For "no-audience" the
 * options are the values the user picked for their future day.
 */
export function stepFor(stageN, stepIdx, turns = []) {
  const stage = stageByN(stageN);
  const step = stage?.steps[stepIdx];
  if (!step) return null;
  if (step.dynamic !== 'keep') return step;
  const future = STAGES[4].steps[0];
  const prev = [...turns].reverse().find((t) => t.stepId === 'future-day');
  const picked = future.options.filter((o) => prev?.selectedIds?.includes(o.id));
  const base = picked.length ? picked : future.options;
  return {
    ...step,
    options: base.map((o) => ({ id: o.id, label: o.label, sig: [`keep.${o.id}`] })),
  };
}

export function stepById(stageN, stepId, turns = []) {
  const stage = stageByN(stageN);
  const idx = stage ? stage.steps.findIndex((s) => s.id === stepId) : -1;
  return idx < 0 ? null : stepFor(stageN, idx, turns);
}

/** Change plan focuses (stage 8). `when` decides if it is relevant to this map. */
export const FOCUSES = [
  { id: 'loop', title: 'Break the loop', body: 'Catch the first small step, ride out urges, learn from slips.', tools: ['urge', 'slip', 'days'] },
  { id: 'social', title: 'Speak up without fear', body: 'Attention on others, one small disagreement a day.', tools: ['attention'] },
  { id: 'selftalk', title: 'Kinder, truer self-talk', body: 'Check harsh thoughts against the evidence.', tools: ['thought'] },
  { id: 'belief', title: 'A new core belief', body: 'Practise a new belief every day, and rate it.', tools: ['belief'] },
  { id: 'restless', title: 'Give restless energy a place', body: 'A short next-task list for blocked or waiting moments.', tools: ['tasks'] },
  { id: 'night', title: 'Protect the nights', body: 'Phone outside the bedroom, every night.', tools: ['night'] },
];
