// A fictional test user. Same patterns as the handoff's §13 test profile,
// with invented details, so no real person's story is in this repository.
// Typed the way real users type: fast, lowercase, typos.
//
// Expected map highlights (handoff §13): core belief "I am small unless I am
// impressive", escape response, trigger = blocked / waiting, weak time = late
// night, values = creating and growth, actions = urge plan, drop the "life
// starts after I quit" rule, attention-outward practice, thought record for
// "I look ugly", slip review.

import { stepById } from '../../js/engine/content.js';

export function turn(stage, stepId, ids, freeText = '', before = []) {
  const step = stepById(stage, stepId, before);
  const chosen = step.options.filter((o) => ids.includes(o.id));
  return {
    stage, stepId,
    question: step.q,
    options: step.options.map((o) => o.label),
    selected: chosen.map((o) => o.label),
    selectedIds: chosen.map((o) => o.id),
    freeText,
    at: 0,
  };
}

export function testTurns() {
  const turns = [];
  const add = (stage, stepId, ids, text = '') => turns.push(turn(stage, stepId, ids, text, turns));
  add(1, 'mind-goes', ['replay', 'judged', 'critic']);
  add(1, 'body-stress', ['escape', 'unclear']);
  add(1, 'when-hard', ['avoid', 'overthink', 'believe'], 'when i care about somthing i start the same day - running, guitar, coding side projects');
  add(2, 'group-disagree', ['quiet', 'depends', 'watch'], 'in design meetings i speak up, about personal stuff i go quiet');
  add(2, 'group-later', ['replay']);
  add(2, 'joke', ['hide']);
  add(3, 'habit', ['porn'], 'it has gone down a lot since last year');
  add(3, 'before', ['blocked', 'waiting'], 'was clean for 9 days. stuck on a bug and waiting for a review');
  add(3, 'first-step', ['app'], 'kept opening reddit for a quick look, closed it each time, skipped my run');
  add(3, 'body-signal', ['stomach', 'chest'], 'noticed it while making tea');
  add(3, 'when-where', ['late', 'bed'], 'around 1 am in bed with the phone');
  add(3, 'during', ['nojoy'], 'wasnt even enjoying it');
  add(4, 'self-talk', ['nothing', 'looks'], 'not harsh on myself. but i feel this habbit is ruining my skin, i will not join the evening class until i quit');
  add(4, 'next-did', ['restart', 'routine'], 'back to running, reset the counter');
  add(5, 'future-day', ['creating', 'smartPeople', 'admired', 'love'], 'my own studio, clever people around, people look up to me, a partner');
  add(5, 'no-audience', ['creating', 'smartPeople', 'love']);
  add(6, 'memory', ['compared', 'grades', 'money', 'shy'], 'always compared with my cousins, low marks, felt small about money');
  add(6, 'coping', ['story', 'cry'], 'made up stories about trips we never took. cried when told off');
  return turns;
}
