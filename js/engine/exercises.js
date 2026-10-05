// Exercise library: animation keyframes, coaching text, and camera form rules.
//
// Pose authoring (see figure.js): torso 0 = upright, +90 = leaning toward +x.
// Limb angles: 0 = hanging down, +90 = pointing toward +x, 180 = overhead.
// { ik: [x, y] } places a wrist/ankle and lets 2-bone IK find the elbow/knee.

const legsIK = (l = [-1, -5], r = [1, -5], hint) => ({
  legL: { ik: l, ...(hint ? { hint } : {}) },
  legR: { ik: r, ...(hint ? { hint } : {}) },
});
const arms = (up, lo) => ({ armL: { up, lo }, armR: { up, lo } });
const both = (spec) => ({ armL: spec, armR: spec });
const straightLegs = (a = 0) => ({ legL: { up: a, lo: a }, legR: { up: a, lo: a } });

// ---------- shared poses ----------
const STAND = { pelvis: [-2, -87.5], torso: 3, ...arms(4, 8), ...legsIK() };
const SQUAT_LOW = { pelvis: [-22, -48], torso: 40, ...arms(82, 86), ...legsIK() };

const PUSH_TOP = {
  pelvis: [-0.7, -42.6], torso: 68.7,
  ...both({ ik: [44, -6], hint: [-1, -1] }),
  legL: { up: -68.7, lo: -68.7 }, legR: { up: -68.7, lo: -68.7 }, footL: -30, footR: -30,
};
const PUSH_LOW = {
  pelvis: [4.5, -21.9], torso: 83.5, head: -6,
  ...both({ ik: [44, -6], hint: [-1, -1] }),
  legL: { up: -83.5, lo: -83.5 }, legR: { up: -83.5, lo: -83.5 }, footL: -30, footR: -30,
};

const LIE = { pelvis: [0, -10], torso: -90, ...arms(85, 85), ...legsIK([34, -5], [36, -5], [0, -1]) };

// ---------- common camera rules ----------
const sagRules = [
  { id: 'sag', live: (m) => m.bodyLine < 158 && m.sag > 0.06, msg: 'Hips are sagging — squeeze glutes and brace your abs', joints: ['hip'] },
  { id: 'pike', live: (m) => m.bodyLine < 158 && m.sag < -0.06, msg: 'Hips too high — lower them into one straight line', joints: ['hip'] },
];
const chestUp = (limit) => ({
  id: 'chest', live: (m) => m.knee < 140 && m.torsoLean > limit,
  msg: 'Chest up — keep your torso tall', joints: ['shoulder', 'hip'],
});
const squatTrack = (lean) => ({
  view: 'side', metric: 'knee', dir: 'down', rest: 155, active: 105, partial: 140,
  need: ['sh', 'hip', 'kn', 'an'],
  partialMsg: 'Go deeper — aim for thighs parallel to the floor',
  rules: [chestUp(lean)],
});

export const EXERCISES = [
  {
    id: 'squat', name: 'Bodyweight Squat', alias: 'Baithak',
    pattern: 'squat', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'reps', upper: false,
    muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
    steps: [
      'Stand with feet shoulder-width apart, toes turned out slightly.',
      'Brace your core and send your hips back and down, like sitting into a chair.',
      'Lower until your thighs are parallel to the floor, knees tracking over your toes.',
      'Push through your whole foot to stand tall, squeezing your glutes at the top.',
    ],
    cues: ['Knees follow toes', 'Weight on mid-foot', 'Chest proud'],
    mistakes: ['Heels lifting off the floor', 'Knees caving inward', 'Cutting the depth short', 'Folding forward at the chest'],
    anim: {
      view: 'side', path: 'pelvis', measure: { joints: ['hipR', 'kneeR', 'ankleR'] },
      frames: [
        { pose: STAND, hold: 0.4, holdLabel: 'Brace', dur: 1.8, label: 'Sit back & down' },
        { pose: SQUAT_LOW, hold: 0.35, holdLabel: 'Parallel', dur: 1.1, label: 'Drive up' },
      ],
    },
    track: squatTrack(55),
  },
  {
    id: 'goblet-squat', name: 'Goblet Squat', alias: 'Dumbbell squat',
    pattern: 'squat', places: ['home-db', 'gym'], equip: 'dumbbell', unit: 'reps', upper: false, loadRatio: 0.16,
    muscles: { primary: ['quads', 'glutes'], secondary: ['core', 'hamstrings'] },
    steps: [
      'Hold one dumbbell vertically against your chest, elbows pointing down.',
      'Feet slightly wider than shoulders. Brace your core.',
      'Squat down between your heels, keeping the weight close to your chest.',
      'Drive up through mid-foot and finish tall.',
    ],
    cues: ['Elbows inside knees', 'Stay upright', 'Slow on the way down'],
    mistakes: ['Dumbbell drifting away from the chest', 'Knees caving', 'Rounding the upper back'],
    anim: {
      view: 'side', path: 'pelvis', props: [{ type: 'dumbbell', axis: 'end' }], measure: { joints: ['hipR', 'kneeR', 'ankleR'] },
      frames: [
        { pose: { ...STAND, ...both({ ik: { rel: 'neck', fwd: 11, up: -15 }, hint: [0, 1] }) }, hold: 0.4, holdLabel: 'Brace', dur: 1.8, label: 'Sit between heels' },
        { pose: { ...SQUAT_LOW, torso: 30, pelvis: [-18, -47], ...both({ ik: { rel: 'neck', fwd: 11, up: -15 }, hint: [0, 1] }) }, hold: 0.35, holdLabel: 'Parallel', dur: 1.1, label: 'Drive up' },
      ],
    },
    track: squatTrack(50),
  },
  {
    id: 'back-squat', name: 'Barbell Back Squat',
    pattern: 'squat', places: ['gym'], equip: 'barbell', unit: 'reps', upper: false, loadRatio: 0.5,
    muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core', 'back'] },
    steps: [
      'Set the bar on your upper traps, hands just outside shoulders, and unrack it.',
      'Step back, feet shoulder-width, take a big breath and brace.',
      'Sit hips back and down until thighs reach parallel, keeping the bar over mid-foot.',
      'Drive up hard, chest and hips rising together. Exhale at the top.',
    ],
    cues: ['Big breath, hard brace', 'Bar over mid-foot', 'Spread the floor'],
    mistakes: ['Hips shooting up first', 'Knees caving inward', 'Losing the brace at the bottom', 'Bar rolling forward'],
    anim: {
      view: 'side', path: 'bar', props: ['barbell'], measure: { joints: ['hipR', 'kneeR', 'ankleR'] },
      frames: [
        { pose: { ...STAND, ...both({ ik: { rel: 'neck', fwd: -6, up: -2 }, hint: [-0.3, 1] }) }, hold: 0.5, holdLabel: 'Breathe & brace', dur: 2, label: 'Hips back & down' },
        { pose: { ...SQUAT_LOW, torso: 45, pelvis: [-24, -49], ...both({ ik: { rel: 'neck', fwd: -6, up: -2 }, hint: [-0.3, 1] }) }, hold: 0.3, holdLabel: 'Parallel', dur: 1.2, label: 'Drive up' },
      ],
    },
    track: squatTrack(60),
  },
  {
    id: 'lunge', name: 'Reverse Lunge',
    pattern: 'lunge', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'reps', upper: false,
    muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors', 'core'] },
    steps: [
      'Stand tall with hands on hips.',
      'Take a long step back and lower your back knee toward the floor.',
      'Stop just above the floor with both knees near 90°.',
      'Push through the front heel to return. Alternate legs.',
    ],
    cues: ['Torso tall', 'Front knee over ankle', 'Control the drop'],
    mistakes: ['Leaning the torso forward', 'Front knee caving in', 'Short, choppy steps'],
    anim: {
      view: 'side', path: 'pelvis',
      frames: (() => {
        const hands = both({ ik: { rel: 'pelvis', fwd: 3, up: 6 }, hint: [-1, 0] });
        const st = { ...STAND, ...hands };
        const stepR = { ...st, pelvis: [-8, -84], legR: { ik: [-34, -22], hint: [0, 1] }, footR: 70 };
        const lowR = { pelvis: [-22, -50], torso: 4, ...hands, legL: { ik: [10, -5] }, legR: { ik: [-66, -13], hint: [0, 1] }, footR: 36 };
        const stepL = { ...st, pelvis: [-8, -84], legL: { ik: [-34, -22], hint: [0, 1] }, footL: 70 };
        const lowL = { pelvis: [-22, -50], torso: 4, ...hands, legR: { ik: [10, -5] }, legL: { ik: [-66, -13], hint: [0, 1] }, footL: 36 };
        return [
          { pose: st, hold: 0.3, dur: 0.45, label: 'Step back' },
          { pose: stepR, dur: 0.8, label: 'Drop the back knee' },
          { pose: lowR, hold: 0.3, holdLabel: 'Both knees 90°', dur: 0.75, label: 'Push through front heel' },
          { pose: stepR, dur: 0.4, label: 'Stand tall' },
          { pose: st, hold: 0.3, dur: 0.45, label: 'Switch legs' },
          { pose: stepL, dur: 0.8, label: 'Drop the back knee' },
          { pose: lowL, hold: 0.3, holdLabel: 'Both knees 90°', dur: 0.75, label: 'Push through front heel' },
          { pose: stepL, dur: 0.4, label: 'Stand tall' },
        ];
      })(),
    },
    track: {
      view: 'side', metric: 'kneeMin', dir: 'down', rest: 155, active: 110, partial: 138,
      need: ['sh', 'hip', 'kn', 'an'], partialMsg: 'Drop your back knee lower',
      rules: [{ id: 'lean', live: (m) => m.kneeMin < 140 && m.torsoLean > 28, msg: "Stay tall — don't lean forward", joints: ['shoulder', 'hip'] }],
    },
  },
  {
    id: 'rdl', name: 'Romanian Deadlift', alias: 'RDL',
    pattern: 'hinge', places: ['home-db', 'gym'], equip: 'barbell', unit: 'reps', upper: false, loadRatio: 0.45,
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['back', 'forearms'] },
    steps: [
      'Stand tall holding the bar (or dumbbells) at your hips, knees soft.',
      'Push your hips straight back, sliding the bar down your thighs.',
      'Keep your back flat; stop when you feel a strong hamstring stretch, around mid-shin.',
      'Drive hips forward to stand, squeezing your glutes.',
    ],
    cues: ['Hips back, not down', 'Bar stays close', 'Long, flat back'],
    mistakes: ['Bending the knees into a squat', 'Rounding the lower back', 'Letting the bar drift forward'],
    anim: {
      view: 'side', path: 'bar', props: ['barbell'], measure: { joints: ['shoulderR', 'hipR', 'kneeR'] },
      frames: [
        { pose: { pelvis: [-2, -86], torso: 2, ...arms(-2, -2), ...legsIK() }, hold: 0.4, holdLabel: 'Tall & braced', dur: 2.2, label: 'Hips back, bar close' },
        { pose: { pelvis: [-33, -79], torso: 76, head: -10, ...arms(-4, -4), ...legsIK() }, hold: 0.3, holdLabel: 'Hamstring stretch', dur: 1.4, label: 'Squeeze glutes, stand' },
      ],
    },
    track: {
      view: 'side', metric: 'hip', dir: 'down', rest: 160, active: 115, partial: 140,
      need: ['sh', 'hip', 'kn', 'an'], partialMsg: 'Hinge deeper — push your hips further back',
      rules: [{ id: 'squatty', live: (m) => m.hip < 140 && m.knee < 125, msg: 'Too much knee bend — push your hips back instead', joints: ['knee'] }],
    },
  },
  {
    id: 'deadlift', name: 'Deadlift',
    pattern: 'hinge', places: ['gym'], equip: 'barbell', unit: 'reps', upper: false, loadRatio: 0.7,
    muscles: { primary: ['glutes', 'hamstrings', 'back'], secondary: ['quads', 'forearms', 'traps'] },
    steps: [
      'Bar over mid-foot. Hinge down and grip just outside your shins.',
      'Drop hips until shins touch the bar, chest up, back flat. Pull the slack out.',
      'Push the floor away — chest and hips rise together, bar dragging up your legs.',
      'Lock out tall with glutes, then hinge back down under control.',
    ],
    cues: ['Push the floor away', 'Bar against the legs', 'Chest and hips together'],
    mistakes: ['Hips shooting up first', 'Bar drifting forward', 'Rounded back', 'Leaning back at lockout'],
    anim: {
      view: 'side', path: 'bar', props: ['barbell'], measure: { joints: ['shoulderR', 'hipR', 'kneeR'] },
      frames: [
        { pose: { pelvis: [-30, -55], torso: 62, head: -15, ...both({ ik: [6, -26], hint: [-1, 0] }), ...legsIK() }, hold: 0.5, holdLabel: 'Set & brace', dur: 0.8, label: 'Push the floor away' },
        { pose: { pelvis: [-18, -72], torso: 35, ...both({ ik: [3, -52], hint: [-1, 0] }), ...legsIK() }, dur: 0.7, label: 'Hips through' },
        { pose: { pelvis: [-2, -86], torso: 0, ...both({ ik: [-1, -78], hint: [-1, 0] }), ...legsIK() }, hold: 0.4, holdLabel: 'Lock out', dur: 1.8, label: 'Hinge back down' },
      ],
    },
    track: {
      view: 'side', metric: 'hip', dir: 'up', rest: 125, active: 165, partial: 150,
      need: ['sh', 'hip', 'kn', 'an'], partialMsg: 'Finish tall — squeeze your glutes at the top',
      rules: [{ id: 'hipsfirst', live: (m) => m.knee > 155 && m.hip < 120, msg: 'Hips rising too fast — lift chest and hips together', joints: ['hip', 'knee'] }],
    },
  },
  {
    id: 'glute-bridge', name: 'Glute Bridge',
    pattern: 'hinge', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'reps', upper: false,
    muscles: { primary: ['glutes'], secondary: ['hamstrings', 'core'] },
    steps: [
      'Lie on your back, knees bent, feet flat and hip-width apart.',
      'Brace your abs and press through your heels.',
      'Lift your hips until shoulders, hips and knees form a straight line.',
      'Squeeze your glutes for a second, then lower slowly.',
    ],
    cues: ['Drive through heels', 'Ribs down', 'Squeeze at the top'],
    mistakes: ['Arching the lower back instead of using glutes', 'Pushing through the toes', 'Rushing the reps'],
    anim: {
      view: 'side', ground: false, path: 'pelvis', props: [{ type: 'mat', x0: -85, x1: 60 }], measure: { joints: ['shoulderR', 'hipR', 'kneeR'] },
      frames: [
        { pose: { ...LIE, pelvis: [-4, -10] }, hold: 0.3, dur: 1.1, label: 'Drive through heels' },
        { pose: { pelvis: [2, -36], torso: -118, head: 30, ...arms(80, 80), ...legsIK([34, -5], [36, -5], [0, -1]) }, hold: 0.8, holdLabel: 'Squeeze glutes', dur: 1.5, label: 'Lower slowly' },
      ],
    },
    track: {
      view: 'side', metric: 'hip', dir: 'up', rest: 145, active: 165, partial: 155,
      need: ['sh', 'hip', 'kn'], partialMsg: 'Push your hips higher — squeeze your glutes',
      rules: [],
    },
  },
  {
    id: 'calf-raise', name: 'Standing Calf Raise',
    pattern: 'calves', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'reps', upper: false,
    muscles: { primary: ['calves'], secondary: [] },
    steps: [
      'Stand tall, feet hip-width, holding a wall for balance if needed.',
      'Rise onto the balls of your feet as high as you can.',
      'Pause for a second at the top.',
      'Lower your heels slowly all the way down.',
    ],
    cues: ['Big toe pressure', 'Pause at the top', 'Full stretch at the bottom'],
    mistakes: ['Bouncing', 'Rolling onto the outer edge of the foot', 'Half reps'],
    anim: {
      view: 'side',
      frames: [
        { pose: { torso: 0, ...arms(3, 6), ...straightLegs(0), footL: 90, footR: 90 }, hold: 0.3, dur: 0.9, label: 'Rise up' },
        { pose: { torso: 0, ...arms(3, 6), ...straightLegs(0), footL: 50, footR: 50 }, hold: 0.8, holdLabel: 'Pause', dur: 1.4, label: 'Lower slowly' },
      ],
    },
    track: {
      view: 'side', metric: 'footPitch', dir: 'up', rest: 12, active: 24, partial: 18,
      need: ['an', 'heel', 'toe'], partialMsg: 'Rise higher onto the balls of your feet', rules: [],
    },
  },
  {
    id: 'wall-sit', name: 'Wall Sit',
    pattern: 'squat-iso', places: ['home', 'home-db'], equip: 'none', unit: 'sec', upper: false,
    muscles: { primary: ['quads'], secondary: ['glutes'] },
    steps: [
      'Stand with your back against a wall, feet about two feet in front of you.',
      'Slide down until your thighs are parallel to the floor.',
      'Keep knees over ankles and your back flat on the wall.',
      'Hold and breathe steadily.',
    ],
    cues: ['Thighs parallel', 'Back on the wall', 'Breathe'],
    mistakes: ['Sitting too high', 'Knees past the toes', 'Holding your breath'],
    anim: {
      view: 'side', ground: false, props: [{ type: 'wall', x: -34 }],
      frames: [
        { pose: { pelvis: [-24, -46], torso: 0, ...arms(14, 40), ...legsIK([19, -5], [21, -5]) }, dur: 2, label: 'Hold · breathe in' },
        { pose: { pelvis: [-24, -45.2], torso: 0.5, ...arms(14, 40), ...legsIK([19, -5], [21, -5]) }, dur: 2, label: 'Hold · breathe out' },
      ],
    },
    track: {
      view: 'side', mode: 'hold', need: ['sh', 'hip', 'kn', 'an'],
      ok: (m) => m.knee < 118 && m.knee > 65,
      rules: [{ id: 'high', live: (m) => m.knee >= 118, msg: 'Slide lower — thighs parallel to the floor', joints: ['knee'] }],
    },
  },
  {
    id: 'pushup', name: 'Push-up', alias: 'Dand',
    pattern: 'pushH', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'reps', upper: true,
    muscles: { primary: ['chest', 'triceps'], secondary: ['delts', 'core'] },
    steps: [
      'Hands under shoulders, body in one straight line from head to heels.',
      'Brace your abs and squeeze your glutes.',
      'Lower your chest toward the floor, elbows at about 45° to your body.',
      'Press the floor away until your arms are straight.',
    ],
    cues: ['One straight line', 'Elbows at 45°', 'Chest to the floor'],
    mistakes: ['Hips sagging', 'Hips piking up', 'Half reps', 'Elbows flaring straight out'],
    anim: {
      view: 'side', ground: false, path: 'neck', measure: { joints: ['shoulderR', 'elbowR', 'wristR'] },
      frames: [
        { pose: PUSH_TOP, hold: 0.3, dur: 1.6, label: 'Lower as one unit' },
        { pose: PUSH_LOW, hold: 0.2, holdLabel: 'Chest near floor', dur: 1.0, label: 'Press the floor away' },
      ],
    },
    track: {
      view: 'side', metric: 'elbow', dir: 'down', rest: 150, active: 100, partial: 125,
      need: ['sh', 'el', 'wr', 'hip', 'an'], partialMsg: 'Go lower — chest toward the floor',
      rules: sagRules,
    },
  },
  {
    id: 'bench-press', name: 'Bench Press',
    pattern: 'pushH', places: ['gym'], equip: 'barbell', unit: 'reps', upper: true, loadRatio: 0.45,
    muscles: { primary: ['chest', 'triceps'], secondary: ['delts'] },
    steps: [
      'Lie on the bench, eyes under the bar, feet planted, shoulder blades pinched together.',
      'Grip slightly wider than shoulders and unrack with straight arms.',
      'Lower the bar to your lower chest, elbows tucked about 45–70°.',
      'Press up and slightly back to lockout over your shoulders.',
    ],
    cues: ['Shoulder blades back', 'Touch, don\'t bounce', 'Feet drive the floor'],
    mistakes: ['Bouncing off the chest', 'Elbows flared at 90°', 'Hips lifting off the bench', 'Uneven press'],
    anim: {
      view: 'side', ground: false, path: 'bar', props: ['barbell', { type: 'bench', rect: [-95, -44, 10, 0] }], measure: { joints: ['shoulderR', 'elbowR', 'wristR'] },
      frames: [
        { pose: { pelvis: [0, -53], torso: -90, ...both({ ik: [-44, -104], hint: [1, 1] }), ...legsIK([34, -5], [36, -5], [0.5, -1]) }, hold: 0.3, dur: 1.8, label: 'Lower to chest' },
        { pose: { pelvis: [0, -53], torso: -90, ...both({ ik: [-36, -71], hint: [1, 1] }), ...legsIK([34, -5], [36, -5], [0.5, -1]) }, hold: 0.25, holdLabel: 'Touch', dur: 1.0, label: 'Press to lockout' },
      ],
    },
    track: {
      view: 'side', metric: 'elbow', dir: 'down', rest: 150, active: 95, partial: 120,
      need: ['sh', 'el', 'wr'], partialMsg: 'Lower the bar all the way to your chest', rules: [],
    },
  },
  {
    id: 'shoulder-press', name: 'Dumbbell Shoulder Press',
    pattern: 'pushV', places: ['home-db', 'gym'], equip: 'dumbbell', unit: 'reps', upper: true, loadRatio: 0.09,
    muscles: { primary: ['delts', 'triceps'], secondary: ['core', 'traps'] },
    steps: [
      'Stand or sit tall, dumbbells at shoulder height, palms forward.',
      'Brace your core and squeeze your glutes so you don\'t lean back.',
      'Press both dumbbells overhead until arms are straight.',
      'Lower with control back to shoulder height.',
    ],
    cues: ['Ribs down', 'Biceps by ears at the top', 'Press evenly'],
    mistakes: ['Leaning back', 'One arm pressing faster', 'Stopping short of lockout'],
    anim: {
      view: 'front', props: ['dumbbell'], measure: { joints: ['shoulderR', 'elbowR', 'wristR'] },
      frames: [
        { pose: { torso: 0, ...arms(92, 178), ...straightLegs(6) }, hold: 0.3, dur: 1.2, label: 'Press overhead' },
        { pose: { torso: 0, ...arms(168, 174), ...straightLegs(6) }, hold: 0.3, holdLabel: 'Lock out', dur: 1.8, label: 'Lower with control' },
      ],
    },
    track: {
      view: 'front', metric: 'elbowAvg', dir: 'up', rest: 110, active: 155, partial: 140,
      need: ['sh', 'el', 'wr'], partialMsg: 'Press all the way to lockout',
      rules: [{ id: 'uneven', live: (m) => m.asym > 35, msg: 'Press both arms evenly', joints: ['elbow', 'wrist'] }],
    },
  },
  {
    id: 'lateral-raise', name: 'Lateral Raise',
    pattern: 'delts', places: ['home-db', 'gym'], equip: 'dumbbell', unit: 'reps', upper: true, loadRatio: 0.04,
    muscles: { primary: ['delts'], secondary: ['traps'] },
    steps: [
      'Stand tall with light dumbbells at your sides, slight bend in the elbows.',
      'Raise your arms out to the sides, leading with your elbows.',
      'Stop at shoulder height, pinkies level with thumbs.',
      'Lower slowly over two to three seconds.',
    ],
    cues: ['Lead with elbows', 'Stop at shoulder height', 'Go light'],
    mistakes: ['Swinging the body', 'Shrugging the shoulders', 'Lifting above shoulder height'],
    anim: {
      view: 'front', props: [{ type: 'dumbbell', axis: 'end' }], measure: { joints: ['hipR', 'shoulderR', 'elbowR'] },
      frames: [
        { pose: { torso: 0, ...arms(10, 14), ...straightLegs(5) }, hold: 0.2, dur: 1.1, label: 'Raise to shoulder height' },
        { pose: { torso: 0, ...arms(86, 92), ...straightLegs(5) }, hold: 0.4, holdLabel: 'Pause', dur: 2, label: 'Lower slowly' },
      ],
    },
    track: {
      view: 'front', metric: 'armAbd', dir: 'up', rest: 30, active: 70, partial: 55,
      need: ['sh', 'el', 'hip'], partialMsg: 'Raise your arms to shoulder height',
      rules: [
        { id: 'high', live: (m) => m.armAbd > 112, msg: 'Stop at shoulder height', joints: ['elbow'] },
        { id: 'swing', rep: (r) => r.range.torsoLean > 12, msg: "Don't swing — use a lighter weight", joints: ['hip'] },
      ],
    },
  },
  {
    id: 'dips', name: 'Bench Dips',
    pattern: 'pushV', places: ['home', 'home-db', 'gym'], equip: 'bench', unit: 'reps', upper: true,
    muscles: { primary: ['triceps'], secondary: ['chest', 'delts'] },
    steps: [
      'Sit on the edge of a sturdy bench or chair, hands next to your hips.',
      'Slide your hips off, legs out in front of you.',
      'Bend your elbows straight back until they reach about 90°.',
      'Press back up until your arms are straight.',
    ],
    cues: ['Elbows point back', 'Hips close to the bench', 'Shoulders down'],
    mistakes: ['Elbows flaring out', 'Dropping too deep and straining the shoulders', 'Hips drifting away from the bench'],
    anim: {
      view: 'side', ground: false, props: [{ type: 'box', rect: [-80, -45, -20, 0] }], measure: { joints: ['shoulderR', 'elbowR', 'wristR'] },
      frames: [
        { pose: { pelvis: [-22, -58], torso: 4, ...both({ ik: [-26, -50], hint: [-1, 0] }), ...legsIK([38, -5], [40, -5], [0.3, -1]) }, hold: 0.3, dur: 1.4, label: 'Bend elbows back' },
        { pose: { pelvis: [-20, -32], torso: 8, ...both({ ik: [-26, -50], hint: [-1, 0] }), ...legsIK([38, -5], [40, -5], [0.3, -1]) }, hold: 0.2, holdLabel: 'Elbows 90°', dur: 1, label: 'Press up' },
      ],
    },
    track: {
      view: 'side', metric: 'elbow', dir: 'down', rest: 150, active: 100, partial: 122,
      need: ['sh', 'el', 'wr'], partialMsg: 'Lower until your elbows reach 90°', rules: [],
    },
  },
  {
    id: 'bent-row', name: 'Bent-over Row',
    pattern: 'pullH', places: ['home-db', 'gym'], equip: 'barbell', unit: 'reps', upper: true, loadRatio: 0.38,
    muscles: { primary: ['back', 'lats'], secondary: ['biceps', 'delts', 'hamstrings'] },
    steps: [
      'Hold the bar (or dumbbells), hinge forward to about 45°, knees soft.',
      'Let your arms hang straight, back flat.',
      'Pull the weight to your lower ribs, driving elbows back.',
      'Squeeze your shoulder blades, then lower with control.',
    ],
    cues: ['Elbows to back pockets', 'Flat back', 'Torso stays still'],
    mistakes: ['Standing up too tall', 'Jerking the weight with the hips', 'Rounding the back'],
    anim: {
      view: 'side', path: 'bar', props: ['barbell'], measure: { joints: ['shoulderR', 'elbowR', 'wristR'] },
      frames: [
        { pose: { pelvis: [-24, -80], torso: 55, head: -12, ...both({ ik: { rel: 'shoulder', x: 2, y: 52 }, hint: [-1, 0] }), ...legsIK() }, hold: 0.3, dur: 1, label: 'Pull to lower ribs' },
        { pose: { pelvis: [-24, -80], torso: 55, head: -12, ...both({ ik: { rel: 'pelvis', fwd: 14, up: 16 }, hint: [-1, -0.4] }), ...legsIK() }, hold: 0.4, holdLabel: 'Squeeze blades', dur: 1.6, label: 'Lower with control' },
      ],
    },
    track: {
      view: 'side', metric: 'elbow', dir: 'down', rest: 150, active: 100, partial: 125,
      need: ['sh', 'el', 'wr', 'hip'], partialMsg: 'Pull the weight all the way to your ribs',
      rules: [{ id: 'upright', live: (m) => m.elbow < 140 && m.torsoLean < 25, msg: 'Hinge forward more — chest toward the floor', joints: ['shoulder', 'hip'] }],
    },
  },
  {
    id: 'pullup', name: 'Pull-up',
    pattern: 'pullV', places: ['gym'], equip: 'bar', unit: 'reps', upper: true,
    muscles: { primary: ['lats', 'back'], secondary: ['biceps', 'forearms', 'core'] },
    steps: [
      'Hang from the bar, hands just wider than shoulders. Use a band or assisted machine if needed.',
      'Pull your shoulder blades down first.',
      'Drive elbows down to your sides until your chin clears the bar.',
      'Lower all the way to straight arms with control.',
    ],
    cues: ['Elbows to ribs', 'Chest to bar', 'Full hang each rep'],
    mistakes: ['Kipping or swinging', 'Half reps', 'Shrugging at the top'],
    anim: {
      view: 'front', ground: false, props: [{ type: 'bar', x0: -46, x1: 46, y: -206 }],
      frames: [
        { pose: { pelvis: [0, -106], torso: 0, armL: { ik: [-25, -202], hint: [1, 0] }, armR: { ik: [25, -202], hint: [1, 0] }, ...straightLegs(3) }, hold: 0.3, holdLabel: 'Dead hang', dur: 1.2, label: 'Pull elbows down' },
        { pose: { pelvis: [0, -150], torso: 0, armL: { ik: [-25, -202], hint: [1, 0] }, armR: { ik: [25, -202], hint: [1, 0] }, ...straightLegs(3) }, hold: 0.3, holdLabel: 'Chin over bar', dur: 1.6, label: 'Lower with control' },
      ],
    },
    track: {
      view: 'front', metric: 'elbowAvg', dir: 'down', rest: 150, active: 75, partial: 110,
      need: ['sh', 'el', 'wr'], partialMsg: 'Pull until your chin clears the bar', rules: [],
    },
  },
  {
    id: 'superman', name: 'Superman Hold',
    pattern: 'pullH', places: ['home', 'home-db'], equip: 'none', unit: 'reps', upper: true,
    muscles: { primary: ['back', 'glutes'], secondary: ['hamstrings', 'delts'] },
    steps: [
      'Lie face down, arms stretched overhead, legs long.',
      'Squeeze your glutes and lift your arms, chest and legs a few centimetres.',
      'Hold for two seconds, looking at the floor.',
      'Lower slowly and repeat.',
    ],
    cues: ['Long, not high', 'Neck neutral', 'Squeeze glutes'],
    mistakes: ['Cranking the neck up', 'Lifting too high and pinching the lower back'],
    anim: {
      view: 'side', ground: false, props: [{ type: 'mat', x0: -100, x1: 110 }],
      frames: [
        { pose: { pelvis: [0, -9], torso: 90, head: -4, ...arms(86, 86), legL: { up: -88, lo: -88 }, legR: { up: -88, lo: -88 }, footL: -80, footR: -80 }, hold: 0.4, dur: 1, label: 'Lift long' },
        { pose: { pelvis: [0, -10], torso: 78, head: -8, ...arms(108, 108), legL: { up: -104, lo: -104 }, legR: { up: -104, lo: -104 }, footL: -96, footR: -96 }, hold: 1.6, holdLabel: 'Hold', dur: 1.2, label: 'Lower slowly' },
      ],
    },
    track: null,
  },
  {
    id: 'bicep-curl', name: 'Dumbbell Curl',
    pattern: 'arms', places: ['home-db', 'gym'], equip: 'dumbbell', unit: 'reps', upper: true, loadRatio: 0.07,
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    steps: [
      'Stand tall, dumbbells at your sides, palms facing forward.',
      'Pin your elbows to your ribs.',
      'Curl the weights up until your forearms are vertical.',
      'Squeeze, then lower slowly to full extension.',
    ],
    cues: ['Elbows pinned', 'No swinging', 'Slow on the way down'],
    mistakes: ['Swinging the torso', 'Elbows drifting forward', 'Cutting the bottom half short'],
    anim: {
      view: 'side', path: 'handR', props: [{ type: 'dumbbell', axis: 'end' }], measure: { joints: ['shoulderR', 'elbowR', 'wristR'] },
      frames: [
        { pose: { torso: 0, ...arms(4, 6), ...straightLegs(0) }, hold: 0.2, dur: 1.1, label: 'Curl up, elbows pinned' },
        { pose: { torso: 0, ...arms(8, 150), ...straightLegs(0) }, hold: 0.4, holdLabel: 'Squeeze', dur: 2, label: 'Lower slowly' },
      ],
    },
    track: {
      view: 'side', metric: 'elbow', dir: 'down', rest: 145, active: 65, partial: 95,
      need: ['sh', 'el', 'wr', 'hip'], partialMsg: 'Curl all the way up',
      rules: [
        { id: 'elbows', live: (m) => m.upperArm > 35, msg: 'Pin your elbows to your sides', joints: ['elbow'] },
        { id: 'swing', rep: (r) => r.range.torsoLean > 15, msg: "Don't swing — keep your torso still", joints: ['hip'] },
      ],
    },
  },
  {
    id: 'plank', name: 'Forearm Plank',
    pattern: 'core', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'sec', upper: false,
    muscles: { primary: ['core', 'abs'], secondary: ['delts', 'glutes'] },
    steps: [
      'Forearms on the floor, elbows under shoulders.',
      'Step your feet back so your body is one straight line.',
      'Squeeze glutes, pull ribs down, push the floor away.',
      'Breathe slowly and hold.',
    ],
    cues: ['Straight line', 'Glutes on', 'Breathe'],
    mistakes: ['Hips sagging', 'Hips piking up', 'Holding the breath'],
    anim: {
      view: 'side', ground: false,
      frames: [
        { pose: { pelvis: [3.9, -25.8], torso: 80.8, ...arms(0, 90), legL: { up: -80.8, lo: -80.8 }, legR: { up: -80.8, lo: -80.8 }, footL: -30, footR: -30 }, dur: 2, label: 'Hold · breathe in' },
        { pose: { pelvis: [3.9, -26.6], torso: 80.4, ...arms(0, 90), legL: { up: -80.4, lo: -80.4 }, legR: { up: -80.4, lo: -80.4 }, footL: -30, footR: -30 }, dur: 2, label: 'Hold · breathe out' },
      ],
    },
    track: {
      view: 'side', mode: 'hold', need: ['sh', 'hip', 'an'],
      ok: (m) => m.bodyLine >= 158 && m.torsoLean > 55,
      rules: sagRules,
    },
  },
  {
    id: 'crunch', name: 'Crunch',
    pattern: 'core', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'reps', upper: false,
    muscles: { primary: ['abs'], secondary: [] },
    steps: [
      'Lie on your back, knees bent, arms crossed on your chest.',
      'Exhale and curl your shoulder blades off the floor.',
      'Pause and squeeze your abs.',
      'Lower slowly without relaxing completely.',
    ],
    cues: ['Exhale up', 'Ribs to hips', 'Chin tucked'],
    mistakes: ['Pulling on the neck', 'Using momentum', 'Sitting all the way up'],
    anim: {
      view: 'side', ground: false, props: [{ type: 'mat', x0: -85, x1: 60 }],
      frames: [
        { pose: { ...LIE, head: 8, ...both({ ik: { rel: 'neck', fwd: 9, up: -12 }, hint: [0, -1] }) }, hold: 0.2, dur: 0.9, label: 'Exhale, curl up' },
        { pose: { ...LIE, torso: -68, head: 22, ...both({ ik: { rel: 'neck', fwd: 9, up: -12 }, hint: [0, -1] }) }, hold: 0.5, holdLabel: 'Squeeze', dur: 1.3, label: 'Lower slowly' },
      ],
    },
    track: {
      view: 'side', metric: 'torsoLean', dir: 'down', rest: 80, active: 70, partial: 75,
      need: ['sh', 'hip', 'kn'], partialMsg: 'Curl your shoulder blades off the floor', rules: [],
    },
  },
  {
    id: 'mountain-climber', name: 'Mountain Climbers',
    pattern: 'cond', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'sec', upper: false,
    muscles: { primary: ['core', 'quads'], secondary: ['delts', 'chest'] },
    steps: [
      'Start in a high plank, hands under shoulders.',
      'Drive one knee toward your chest.',
      'Switch legs quickly, like running in place.',
      'Keep your hips level and back flat.',
    ],
    cues: ['Hips low', 'Quick feet', 'Shoulders over hands'],
    mistakes: ['Hips bouncing up', 'Shoulders drifting behind hands'],
    anim: {
      view: 'side', ground: false,
      frames: [
        { pose: { ...PUSH_TOP, legR: { up: 60, lo: -80 }, footR: -30 }, dur: 0.32, label: 'Switch' },
        { pose: { ...PUSH_TOP, legL: { up: 60, lo: -80 }, footL: -30 }, dur: 0.32, label: 'Switch' },
      ],
    },
    track: {
      view: 'side', metric: 'hipMin', dir: 'down', rest: 145, active: 110, partial: 130, fast: true,
      need: ['sh', 'hip', 'kn'], partialMsg: 'Drive your knees closer to your chest',
      rules: [sagRules[0]],
    },
  },
  {
    id: 'jumping-jack', name: 'Jumping Jacks',
    pattern: 'cond', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'sec', upper: false,
    muscles: { primary: ['calves', 'delts'], secondary: ['quads', 'glutes'] },
    steps: [
      'Stand tall, feet together, arms by your sides.',
      'Jump your feet out while sweeping your arms overhead.',
      'Jump back to the start.',
      'Land softly on the balls of your feet.',
    ],
    cues: ['Soft landings', 'Arms fully overhead', 'Steady rhythm'],
    mistakes: ['Landing heavy on the heels', 'Half arm swings'],
    anim: {
      view: 'front',
      frames: [
        { pose: { torso: 0, ...arms(8, 10), ...straightLegs(3) }, dur: 0.16, label: 'Out' },
        { pose: { torso: 0, ...arms(90, 100), ...straightLegs(9), lift: 9 }, dur: 0.16, label: 'Out' },
        { pose: { torso: 0, ...arms(165, 172), ...straightLegs(15) }, dur: 0.16, label: 'In' },
        { pose: { torso: 0, ...arms(90, 100), ...straightLegs(9), lift: 9 }, dur: 0.16, label: 'In' },
      ],
    },
    track: {
      view: 'front', metric: 'armAbd', dir: 'up', rest: 45, active: 135, partial: 100, fast: true,
      need: ['sh', 'el', 'hip', 'an'], partialMsg: 'Swing your arms all the way overhead',
      rules: [{ id: 'feet', rep: (r) => r.max.ankleSpread < 1.15, msg: 'Jump your feet wider', joints: ['ankle'] }],
    },
  },
  {
    id: 'high-knees', name: 'High Knees',
    pattern: 'cond', places: ['home', 'home-db', 'gym'], equip: 'none', unit: 'sec', upper: false,
    muscles: { primary: ['quads', 'core'], secondary: ['calves', 'glutes'] },
    steps: [
      'Stand tall and start jogging in place.',
      'Drive each knee up to hip height.',
      'Pump your arms in rhythm.',
      'Stay light on the balls of your feet.',
    ],
    cues: ['Knees to hip height', 'Tall torso', 'Quick arms'],
    mistakes: ['Leaning back', 'Knees staying low'],
    anim: {
      view: 'side',
      frames: [
        { pose: { torso: 4, legR: { up: 85, lo: 0 }, legL: { up: -4, lo: -2 }, footR: 70, armL: { up: 40, lo: 110 }, armR: { up: -35, lo: 40 }, lift: 3 }, dur: 0.28, label: 'Drive' },
        { pose: { torso: 4, legL: { up: 85, lo: 0 }, legR: { up: -4, lo: -2 }, footL: 70, armR: { up: 40, lo: 110 }, armL: { up: -35, lo: 40 }, lift: 3 }, dur: 0.28, label: 'Drive' },
      ],
    },
    track: {
      view: 'side', metric: 'hipMin', dir: 'down', rest: 150, active: 115, partial: 135, fast: true,
      need: ['sh', 'hip', 'kn'], partialMsg: 'Drive your knees up to hip height', rules: [],
    },
  },
];

export const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const exercise = (id) => BY_ID[id];

export const MUSCLE_LABEL = {
  chest: 'Chest', back: 'Upper back', lats: 'Lats', traps: 'Traps', delts: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', forearms: 'Forearms', core: 'Core', abs: 'Abs', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves', adductors: 'Adductors',
};

export const EQUIP_LABEL = { none: 'Bodyweight', dumbbell: 'Dumbbells', barbell: 'Barbell', bar: 'Pull-up bar', bench: 'Bench or chair' };
