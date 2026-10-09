// Unhelpful beliefs the guide questions kindly, with reasons (handoff §2.8,
// §9.3). The guide never agrees with a false belief to be nice, and never
// makes a health claim the evidence does not support.

export const BELIEFS = [
  {
    id: 'looks',
    covers: ['talk.looks'],
    test: (t, sig) => sig.has('talk.looks'),
    thought: 'This habit is making me ugly.',
    reply: (sig) => `I don’t agree with “this habit makes me ugly”, and here is why: there is no good evidence that ${sig.has('habit.porn') ? 'porn or masturbation changes' : 'this habit changes'} your face or your looks. What is real: late nights, poor sleep and shame make anyone look and feel tired, and shame changes how you see yourself in the mirror. Better sleep and less shame will help more than fear.`,
    against: 'No good evidence that the habit changes appearance. Tiredness from late nights and shame explain the feeling better.',
  },
  {
    id: 'brain',
    test: (t) => /(brain|memory|iq|intelligen\w*|dumb|stupid|focus).{0,50}(porn|masturbat\w*|fap\w*|habit)|(porn|masturbat\w*|fap\w*|habit).{0,50}(brain|memory|iq|intelligen\w*|dumb|stupid)/i.test(t),
    thought: 'This habit is damaging my brain or making me less intelligent.',
    reply: 'There is no good evidence that porn or masturbation lowers intelligence or damages the brain. What is real: compulsive use can eat your time, sleep and focus — and those are fixable.',
    against: 'No good evidence for brain damage or lower intelligence. Lost sleep and time explain the fog better.',
  },
  {
    id: 'semen',
    test: (t) => /(semen|virya|dhat|dhaat|nightfall|loss of (energy|strength)|body (is )?(getting )?weak)/i.test(t),
    thought: 'Losing semen is draining my body and strength.',
    reply: 'Losing semen does not drain your body or your strength — that is an old myth (sometimes called “dhat”). The body makes it all the time. Tiredness is far more likely to come from lost sleep and stress.',
    against: 'The body keeps making semen; it is not a limited store of strength. Sleep and stress explain tiredness better.',
  },
  {
    id: 'wait',
    covers: ['think.waitUntilFixed'],
    test: (t, sig) => sig.has('think.waitUntilFixed') || /((after|once|until|till) i (quit|stop|fix|change)|won'?t go .{0,30}(until|till|before) i)/i.test(t),
    thought: 'My life starts after I quit.',
    reply: 'There seems to be a rule: “I can go out and live properly only after I quit.” That rule usually keeps the loop going — avoiding college, friends or plans leaves more empty, alone time, which is exactly when the urge wins. Try it the other way round: live first, and the habit loses room.',
    against: 'Waiting to be “fixed” creates more empty, alone time — the habit’s best time. Living fully shrinks the habit.',
  },
  {
    id: 'never',
    covers: ['talk.hopeless'],
    test: (t, sig) => sig.has('talk.hopeless') || /(i('ll| will)? never (change|stop|get better)|no hope|i'?m (hopeless|broken|beyond help))/i.test(t),
    thought: 'I will never change.',
    reply: '“I\'ll never change” is a feeling, not a fact. Feelings speak in “always” and “never”. Your own answers already show change is possible — we will collect that evidence on your map.',
    against: 'Feelings speak in “always” and “never”. Look at the days that went well — that is evidence of change.',
  },
  {
    id: 'disgusting',
    covers: ['talk.harsh'],
    test: (t, sig) => sig.has('talk.harsh') || /(i'?m (so )?(disgusting|useless|worthless|a loser|pathetic|trash))/i.test(t),
    thought: 'I am disgusting / useless.',
    reply: 'Calling yourself disgusting or useless after a slip is shame talking. A habit is something you do, not who you are. Shame usually makes the next slip more likely, not less — so being fair to yourself is not “going soft”, it is part of changing.',
    against: 'A habit is a behaviour, not an identity. Shame tends to feed the loop.',
  },
  {
    id: 'everyone',
    test: (t) => /(everyone|everybody|they all|people always) (hates?|judges?|laughs? at|thinks? i'?m|notices?)/i.test(t),
    thought: 'Everyone is judging me.',
    reply: 'You can’t see inside other people’s heads, so “everyone judges me” is a guess your mind makes. Most people are busy thinking about themselves. A small test helps more than guessing: say one small thing and see what really happens.',
    against: 'It is mind-reading, not observation. Most people are focused on themselves.',
  },
];

/** Beliefs found in this text (with signals) that were not challenged before. */
export function findBeliefs(text, sigSet, already = new Set()) {
  return BELIEFS.filter((b) => !already.has(b.id) && b.test(String(text || ''), sigSet));
}

export const beliefById = (id) => BELIEFS.find((b) => b.id === id);

/** The reply text (some replies depend on the habit). */
export const replyFor = (b, sigSet) => (typeof b.reply === 'function' ? b.reply(sigSet) : b.reply);
