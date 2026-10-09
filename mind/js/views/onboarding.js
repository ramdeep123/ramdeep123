// Onboarding (handoff §6 MVP): what it is, 18+ age gate, "not therapy"
// notice and consent, the AI choice, optional app lock, then the interview.

import { state, update, setPin, flush, isPersistent } from '../store.js';
import { icon, toast } from '../ui.js';
import { helpButton, mapSeed } from '../core.js';
import { contour } from '../art.js';
import { aiConfigured } from '../ai.js';
import { STAGES } from '../engine/content.js';
import { pinPad, wirePad } from './lock.js';
import { REGIONS } from '../engine/crisis-lines.js';
import { config } from '../config.js';

let step = 0;
let firstPin = '';

export function onboardingBack() {
  if (step === 'pin') { step = 4; firstPin = ''; return true; }
  if (step > 0 && step !== 'under18') { step = Math.max(0, step - 1); return true; }
  if (step === 'under18') { step = 1; return true; }
  return false;
}

export function showOnboarding(app, done) {
  const render = () => {
    app.innerHTML = `<main class="onb" data-step="${step}">${screen()}</main>`;
    const pad = app.querySelector('.lock');
    if (pad) {
      pad.tabIndex = -1;
      pad.focus();
      wirePad(pad, async (pin, fail) => {
        if (!firstPin) { firstPin = pin; render(); return; }
        if (pin !== firstPin) { firstPin = ''; fail('The PINs didn’t match. Try again.'); setTimeout(render, 900); return; }
        await setPin(pin);
        firstPin = '';
        toast('App lock is on.');
        step = 5;
        render();
      });
    }
  };

  const actions = {
    next: () => { step += 1; if (step === 3 && !aiConfigured()) step = 4; render(); },
    back: () => { onboardingBack(); render(); },
    adult: () => { update((s) => { s.user.ageConfirmed18 = true; }); step = 2; render(); },
    under18: () => { step = 'under18'; render(); },
    consent: () => {
      const a = app.querySelector('#c1')?.checked;
      const b = app.querySelector('#c2')?.checked;
      if (!a || !b) { toast('Please tick both boxes to continue.'); return; }
      update((s) => { s.user.notTherapyAck = true; s.user.consentAt = Date.now(); });
      step = aiConfigured() ? 3 : 4;
      render();
    },
    ai: (el) => { update((s) => { s.settings.ai = el.dataset.on === '1'; }); step = 4; render(); },
    pin: () => { step = 'pin'; firstPin = ''; render(); },
    nopin: () => { step = 5; render(); },
    start: async () => {
      update((s) => { s.user.onboarded = true; });
      await flush();
      step = 0;
      done(true);
    },
  };

  app.onclick = (ev) => {
    const el = ev.target.closest('[data-onb]');
    if (el) { ev.preventDefault(); actions[el.dataset.onb]?.(el); }
  };
  render();
}

function dots() {
  const n = typeof step === 'number' ? step : 4;
  return `<div class="onb-dots">${[0, 1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
}

function top(back = true) {
  return `<div class="onb-top">${back ? `<button class="icon-btn" data-onb="back" aria-label="Back">${icon('back')}</button>` : '<span></span>'}${dots()}${helpButton()}</div>`;
}

function screen() {
  if (step === 0) {
    return `
    <div class="onb-hero">${contour(mapSeed() + 'welcome', { w: 400, h: 400, rings: 16, cls: 'contour hero-contour' })}</div>
    ${top(false)}
    <section class="onb-body">
      <span class="eyebrow">${config.appName}</span>
      <h1 class="display xl">See how your mind works.<br><em>Then change one small thing.</em></h1>
      <p class="lead">Answer simple questions about real moments in your life. Get back a clear map of your thoughts, your stress response, what you value, and the loop that keeps a habit going — plus a small plan to practise every day.</p>
      <ul class="facts">
        <li>${icon('chat')}<span><b>About 20 minutes.</b> Tap answers or type messy. Stop and resume any time.</span></li>
        <li>${icon('shield')}<span><b>Private.</b> Your answers stay on this phone, encrypted.</span></li>
        <li>${icon('seed')}<span><b>Not therapy.</b> A guided self-reflection, built on CBT ideas.</span></li>
      </ul>
    </section>
    <footer class="onb-foot"><button class="btn wide" data-onb="next">Begin ${icon('arrow')}</button></footer>`;
  }
  if (step === 1) {
    return `${top()}
    <section class="onb-body center">
      <span class="eyebrow">Before we start</span>
      <h1 class="display">Are you 18 or older?</h1>
      <p class="lead">This app talks about adult topics, including sexual habits, in plain clinical words. It is for adults only.</p>
    </section>
    <footer class="onb-foot two">
      <button class="btn ghost" data-onb="under18">No, I’m under 18</button>
      <button class="btn" data-onb="adult">Yes, I’m 18+</button>
    </footer>`;
  }
  if (step === 'under18') {
    const r = REGIONS[state.settings.region] || REGIONS.IN;
    const line = r.lines[0];
    return `${top()}
    <section class="onb-body center">
      <span class="eyebrow">Thanks for being honest</span>
      <h1 class="display">This app is for adults.</h1>
      <p class="lead">If something is on your mind, please talk to a parent, a teacher you trust, or a school counsellor.${line ? ` You can also call <b>${line.name}</b> on <a href="tel:${line.call.replace(/\s/g, '')}">${line.call}</a> — it’s free.` : ''}</p>
    </section>`;
  }
  if (step === 2) {
    return `${top()}
    <section class="onb-body">
      <span class="eyebrow">Please read</span>
      <h1 class="display">This is not therapy.</h1>
      <div class="card soft">
        <p>${config.appName} helps you <b>reflect</b>. It does not diagnose, treat or give medical advice. Its map is a set of <b>guesses from your own answers</b>.</p>
        <p>If a problem is severe, lasts a long time, or you feel unsafe, please see a doctor, counsellor or psychologist. The <b>Help</b> button is on every screen.</p>
      </div>
      <label class="tick"><input type="checkbox" id="c1"><span>I understand this app is not therapy or medical advice.</span></label>
      <label class="tick"><input type="checkbox" id="c2"><span>I agree that my answers are stored on this phone, encrypted${isPersistent() ? '' : ' (this browser can’t save, so nothing will be kept)'}.</span></label>
    </section>
    <footer class="onb-foot"><button class="btn wide" data-onb="consent">I agree</button></footer>`;
  }
  if (step === 3) {
    return `${top()}
    <section class="onb-body">
      <span class="eyebrow">Your choice</span>
      <h1 class="display">Who writes your reflections?</h1>
      <button class="choice" data-onb="ai" data-on="0">
        <b>${icon('shield')} Private mode</b>
        <span>The app’s own guide reflects on your answers. Nothing leaves your phone. Works offline.</span>
      </button>
      <button class="choice" data-onb="ai" data-on="1">
        <b>${icon('spark')} AI guide</b>
        <span>Richer, more personal reflections. Your answers (never your name) are sent through our server to an AI model, used once, and not stored. Needs internet.</span>
      </button>
      <p class="fine">You can change this any time in You → AI guide.</p>
    </section>`;
  }
  if (step === 4) {
    return `${top()}
    <section class="onb-body">
      <span class="eyebrow">Privacy</span>
      <h1 class="display">Lock it with a PIN?</h1>
      <p class="lead">If someone else picks up your phone, they won’t be able to open your map. Your PIN also encrypts your data.</p>
      <div class="card soft"><p><b>Important:</b> there is no “forgot PIN”. Without it, the data can’t be opened — only deleted.</p></div>
    </section>
    <footer class="onb-foot two">
      <button class="btn ghost" data-onb="nopin">Not now</button>
      <button class="btn" data-onb="pin">${icon('lock')} Set a PIN</button>
    </footer>`;
  }
  if (step === 'pin') {
    return pinPad(firstPin ? 'Repeat your PIN' : 'Choose a PIN', firstPin ? 'Type it once more.' : '4 to 6 digits.');
  }
  return `${top()}
    <section class="onb-body">
      <span class="eyebrow">How it works</span>
      <h1 class="display">Eight short stages.</h1>
      <ol class="stages-list">
        ${STAGES.map((s) => `<li><i>${s.n}</i><span><b>${s.title}</b>${s.n === 7 ? ' — your map appears' : s.n === 8 ? ' — pick what to work on first' : ''}</span></li>`).join('')}
      </ol>
      <p class="fine">One question at a time. After each answer you’ll see what the guide notices — guesses you can correct.</p>
    </section>
    <footer class="onb-foot"><button class="btn wide" data-onb="start">Start the interview ${icon('arrow')}</button></footer>`;
}
