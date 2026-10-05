// KAYA Pass: pricing, trial timeline, checkout (demo or Razorpay).

import { state, update } from '../store.js';
import { refresh } from '../core.js';
import { PRICING, FEATURES, status, applyPayment, trialEnds, nextPrice } from '../engine/subscription.js';
import { fmtDate, esc } from '../engine/util.js';
import { icon, openStage, openSheet, toast, closeLayer } from '../ui.js';
import { checkout } from '../payments.js';
import { CONFIG } from '../config.js';

const REASONS = {
  coach: 'The AI form coach is part of KAYA Pass.',
  plan: 'Your personal program is part of KAYA Pass.',
  diet: 'Your BMR-regulated meal plan is part of KAYA Pass.',
  mind: 'This Mind lab session is part of KAYA Pass.',
};

export function openPass(reason) {
  const s = status(state.sub);
  const price = nextPrice(state.sub);
  const name = state.profile?.name || 'Member';
  const tEnd = trialEnds(state.sub);
  const perDay = (price / 91).toFixed(2);

  let cta = '';
  let headline = '';
  if (s.state === 'trial') {
    headline = `Free until ${fmtDate(tEnd)}`;
    cta = `<button class="btn block" data-act="buy">Continue after trial · ${PRICING.symbol}${price}</button>
      <p class="faint small" style="text-align:center">Subscribe now and your 3 paid months start on ${fmtDate(tEnd)} — you keep every free day.</p>`;
  } else if (s.state === 'active' || s.state === 'trial-paid') {
    headline = `Active until ${fmtDate(state.sub.paidUntil)}`;
    cta = `<div class="banner">${icon('check')}<span class="grow">Renews at ${PRICING.symbol}${PRICING.regular.amount} for 3 months on ${fmtDate(state.sub.paidUntil)}${state.sub.cancelled ? ' — auto-renew is off' : ''}.</span></div>
      ${state.sub.cancelled ? '' : '<button class="btn line block" data-act="cancelSub">Turn off auto-renew</button>'}`;
  } else {
    headline = 'Trial ended';
    cta = `<button class="btn block" data-act="buy">Unlock everything · ${PRICING.symbol}${price}</button>`;
  }

  openStage({
    temp: 'you',
    html: `<div class="stage-bar"><button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button><span class="eyebrow">KAYA Pass</span><span style="width:42px"></span></div>
      ${reason && REASONS[reason] && !s.pro ? `<div class="banner">${icon('lock')}<span class="grow">${REASONS[reason]}</span></div>` : ''}
      <div class="passcard">
        <div class="row between"><span class="brand">KAYA<br>PASS</span><span class="tag hot">${esc(headline)}</span></div>
        <div>
          <div class="price">${PRICING.symbol}${price}<small>for 3 months</small></div>
          <span class="muted small">${price === PRICING.intro.amount ? `Then ${PRICING.symbol}${PRICING.regular.amount} every 3 months · ` : ''}about ${PRICING.symbol}${perDay} a day</span>
        </div>
        <div class="row between"><span class="mono small">${esc(name.toUpperCase())}</span><span class="mono small faint">${PRICING.trialDays}-DAY FREE TRIAL</span></div>
      </div>
      ${cta}
      <section class="card">
        <span class="eyebrow">How billing works</span>
        <div class="plan-steps">
          <div class="plan-step"><span class="when">Day 1–7</span><span>Free trial with everything unlocked. No charge.</span></div>
          <div class="plan-step"><span class="when">Day 8</span><span>${PRICING.symbol}${PRICING.intro.amount} covers your first 3 months.</span></div>
          <div class="plan-step"><span class="when">Every 3 mo</span><span>${PRICING.symbol}${PRICING.regular.amount} after that. Cancel anytime before renewal.</span></div>
        </div>
      </section>
      <section class="card">
        <span class="eyebrow">Everything in the pass</span>
        <div class="list">${FEATURES.map((f) => `<div class="li"><span class="check" style="background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)">${icon('check')}</span><span class="grow"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></span></div>`).join('')}</div>
      </section>
      <p class="faint small" style="text-align:center">A personal trainer often costs thousands of rupees a month. KAYA Pass costs less than a cup of chai a week.</p>
      ${state.sub.payments.length ? `<section class="card"><span class="eyebrow">Payments</span><div class="list">${state.sub.payments.map((p) => `<div class="li"><span class="grow"><b>${PRICING.symbol}${p.amount}</b><span>${fmtDate(p.at, true)} · ref ${esc(String(p.ref).slice(0, 18))}</span></span></div>`).join('')}</div></section>` : ''}`,
    actions: {
      async buy() {
        if (CONFIG.payments.mode !== 'razorpay') {
          openSheet({
            temp: 'you',
            html: `<span class="eyebrow">Demo checkout</span><h2 class="h2">Confirm ${PRICING.symbol}${price}</h2>
              <p class="muted">Payments are in demo mode in this build, so no money moves. Connect Razorpay (see README) to take real UPI and card payments.</p>
              <button class="btn block" data-act="confirmDemo">Pay ${PRICING.symbol}${price} (demo)</button>
              <button class="btn line block" data-act="close">Cancel</button>`,
            actions: {
              confirmDemo() {
                update((st) => { st.sub = applyPayment(st.sub, `demo_${Date.now().toString(36)}`); });
                closeLayer();
                closeLayer();
                toast('KAYA Pass active');
                refresh();
              },
            },
          });
          return;
        }
        try {
          const res = await checkout({ name, amount: price });
          update((st) => { st.sub = applyPayment(st.sub, res.ref); });
          closeLayer();
          toast('Payment successful — KAYA Pass active');
          refresh();
        } catch (e) {
          if (e?.message !== 'dismissed') toast('Payment didn’t go through. You have not been charged.');
        }
      },
      cancelSub() {
        update((st) => { st.sub = { ...st.sub, cancelled: true }; });
        closeLayer();
        toast('Auto-renew is off. You keep access until the end of the period.');
        refresh();
      },
    },
  });
}
