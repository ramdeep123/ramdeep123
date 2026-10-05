// Breathwork & meditation sessions plus the evidence notes behind them.

export const SESSIONS = [
  {
    id: 'sigh', name: 'Physiological Sigh', minutes: 3, free: true,
    bestFor: 'Fast calm, any time', tag: 'Fastest reset',
    how: 'Two inhales through the nose (a full breath, then a short top-up), then one long, slow exhale through the mouth.',
    pattern: [{ phase: 'in', label: 'Inhale', sec: 2 }, { phase: 'in2', label: 'Top up', sec: 1 }, { phase: 'out', label: 'Long exhale', sec: 6 }],
  },
  {
    id: 'box', name: 'Box Breathing', minutes: 4,
    bestFor: 'Focus before a heavy set', tag: 'Focus',
    how: 'Inhale, hold, exhale, hold — four seconds each. Used to steady nerves under pressure.',
    pattern: [{ phase: 'in', label: 'Inhale', sec: 4 }, { phase: 'hold', label: 'Hold', sec: 4 }, { phase: 'out', label: 'Exhale', sec: 4 }, { phase: 'hold2', label: 'Hold', sec: 4 }],
  },
  {
    id: 'coherent', name: 'Resonance Breathing', minutes: 6,
    bestFor: 'Recovery & heart-rate variability', tag: 'Recovery',
    how: 'Smooth, equal breaths at about 5.5 per minute. This pace tends to maximise heart-rate variability.',
    pattern: [{ phase: 'in', label: 'Inhale', sec: 5.5 }, { phase: 'out', label: 'Exhale', sec: 5.5 }],
  },
  {
    id: '478', name: '4-7-8 Wind-down', minutes: 5,
    bestFor: 'Falling asleep', tag: 'Sleep',
    how: 'Inhale for 4, hold for 7, exhale slowly for 8. The long exhale slows the heart.',
    pattern: [{ phase: 'in', label: 'Inhale', sec: 4 }, { phase: 'hold', label: 'Hold', sec: 7 }, { phase: 'out', label: 'Exhale', sec: 8 }],
  },
  {
    id: 'cooldown', name: 'Post-workout Down-shift', minutes: 4,
    bestFor: 'Right after training', tag: 'After gym',
    how: 'Inhale 4, exhale 6 while lying down. Moves your body from "fight" mode into "rest and repair".',
    pattern: [{ phase: 'in', label: 'Inhale', sec: 4 }, { phase: 'out', label: 'Exhale', sec: 6 }],
  },
  {
    id: 'nsdr', name: 'NSDR Body Scan', minutes: 10,
    bestFor: 'Deep recovery, afternoon slump', tag: 'Deep rest',
    how: 'Non-sleep deep rest (yoga nidra style): slow breathing while moving attention through the body.',
    pattern: [{ phase: 'in', label: 'Inhale', sec: 4 }, { phase: 'out', label: 'Exhale', sec: 7 }],
    script: [
      [0, 'Lie down. Let your eyes close. Breathe in through the nose, and let the exhale be long.'],
      [40, 'Bring attention to your feet. Notice the weight of your heels. Let them soften.'],
      [90, 'Move to your calves and knees. Release any effort you find there.'],
      [140, 'Your thighs and hips. Let the floor hold you completely.'],
      [190, 'Your belly rises and falls on its own. You do not need to control it.'],
      [250, 'Chest, shoulders, arms, hands. Let each one become heavy and warm.'],
      [320, 'Your jaw unclenches. Your tongue rests. The space between your eyebrows smooths out.'],
      [390, 'Rest as the whole body at once. Awake, but completely still.'],
      [480, 'If thoughts arrive, let them pass like traffic outside a window.'],
      [560, 'Begin to deepen the breath. Wiggle your fingers and toes.'],
      [590, 'When you are ready, open your eyes. Take this calm with you.'],
    ],
  },
];

export const sessionById = (id) => SESSIONS.find((s) => s.id === id);

export const CORTISOL = {
  intro: 'Cortisol is your main stress hormone, made by the adrenal glands. It is not the enemy: it wakes you up in the morning and helps you push through a hard set. Problems start when it stays high all day, every day.',
  rhythm: 'Healthy cortisol peaks about 30–45 minutes after waking, then falls through the day so you can sleep. Chronic stress flattens that curve: tired in the morning, wired at night.',
  effects: [
    { title: 'Belly fat storage', text: 'Long-term high cortisol is linked with more fat stored around the waist and stronger cravings for sugary, salty food.' },
    { title: 'Slower muscle growth', text: 'Cortisol is catabolic: it breaks tissue down for fuel. Chronically high levels work against the repair your training needs.' },
    { title: 'Worse sleep', text: 'Evening cortisol keeps the brain alert, and poor sleep in turn raises next-day cortisol — a loop that hurts recovery.' },
    { title: 'Weaker recovery & immunity', text: 'Sustained stress suppresses immune function and slows how quickly you bounce back between sessions.' },
  ],
  evidence: [
    { claim: 'A 2017 meta-analysis of mindfulness trials found reductions in cortisol, blood pressure and resting heart rate compared with controls.', cite: 'Pascoe et al., Journal of Psychiatric Research, 2017' },
    { claim: 'A 2021 meta-analysis found meditation interventions reduced cortisol, especially in people already under high stress.', cite: 'Koncz et al., Health Psychology Review, 2021' },
    { claim: 'Five minutes a day of cyclic sighing (the physiological sigh) improved mood and lowered breathing rate more than mindfulness meditation over one month.', cite: 'Balban et al., Cell Reports Medicine, 2023' },
    { claim: 'An 8-week mindfulness program was associated with measurable changes in grey-matter density in brain regions tied to learning and emotion regulation.', cite: 'Hölzel et al., Psychiatry Research: Neuroimaging, 2011' },
    { claim: 'A large review found moderate evidence that meditation programs improve anxiety, depression and pain.', cite: 'Goyal et al., JAMA Internal Medicine, 2014' },
  ],
  timeline: [
    { when: 'First 2 minutes', what: 'A long exhale activates the vagus nerve; heart rate and breathing slow down.' },
    { when: 'After 1 week', what: 'Most people report falling asleep faster and feeling less reactive to stress.' },
    { when: 'After 4 weeks', what: 'Daily practice is linked with better mood and lower perceived stress in trials.' },
    { when: 'After 8 weeks', what: 'Studies of 8-week programs show lower stress markers and changes in attention and emotion regulation.' },
  ],
  forGoals: [
    { goal: 'lose', text: 'Lower stress means fewer stress-driven cravings and better sleep — two of the biggest levers for steady fat loss.' },
    { goal: 'muscle', text: 'Muscle is built during recovery. Calmer nights and deeper sleep give your training somewhere to land.' },
    { goal: 'strength', text: 'Box breathing before a heavy set steadies your nerves and helps you brace harder.' },
    { goal: 'fit', text: 'A calm nervous system makes training feel easier and keeps motivation steady week to week.' },
  ],
  disclaimer: 'Educational only, not medical advice. If you feel dizzy during breathwork, return to normal breathing. Never practise breath-holds in water or while driving.',
};
