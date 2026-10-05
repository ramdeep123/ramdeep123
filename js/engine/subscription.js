// KAYA Pass: 7-day free trial, then ₹29 for the first 3 months, ₹49 every 3 months after.

import { DAY, addMonths } from './util.js';

export const PRICING = {
  trialDays: 7,
  intro: { amount: 29, months: 3 },
  regular: { amount: 49, months: 3 },
  symbol: '₹',
};

export function newSub(now = Date.now()) {
  return { trialStart: now, paidUntil: 0, payments: [], cancelled: false };
}

export function trialEnds(sub) {
  return sub.trialStart + PRICING.trialDays * DAY;
}

/** Price of the next 3-month period. */
export function nextPrice(sub) {
  return sub.payments.length === 0 ? PRICING.intro.amount : PRICING.regular.amount;
}

export function status(sub, now = Date.now()) {
  if (!sub) return { state: 'none', pro: false };
  const tEnd = trialEnds(sub);
  if (sub.paidUntil > now) {
    const daysLeft = Math.ceil((sub.paidUntil - now) / DAY);
    return {
      state: now < tEnd ? 'trial-paid' : 'active', pro: true, daysLeft,
      renewsAt: sub.paidUntil, renewPrice: PRICING.regular.amount, cancelled: sub.cancelled,
    };
  }
  if (now < tEnd) {
    return { state: 'trial', pro: true, daysLeft: Math.ceil((tEnd - now) / DAY), trialEndsAt: tEnd, firstPrice: nextPrice(sub) };
  }
  return { state: 'expired', pro: false, price: nextPrice(sub) };
}

/**
 * Record a successful payment. During the trial the paid period starts when
 * the trial ends, so nobody loses free days by subscribing early.
 */
export function applyPayment(sub, ref, now = Date.now()) {
  const amount = nextPrice(sub);
  const start = Math.max(now, trialEnds(sub), sub.paidUntil || 0);
  return {
    ...sub,
    cancelled: false,
    paidUntil: addMonths(start, 3),
    payments: [...sub.payments, { at: now, amount, ref, periodStart: start }],
  };
}

export const FEATURES = [
  { title: 'AI form coach', text: 'Your camera checks every rep and speaks up only when something is really off.' },
  { title: 'Animated trainer', text: '23 moves demonstrated by a 3D-style coach with tempo, bar path and joint angles.' },
  { title: 'Adaptive program', text: 'A weekly plan for gym or home that adds weight when you earn it.' },
  { title: 'BMR-regulated diet', text: 'Indian meal plans that re-tune every week and never drop below your BMR.' },
  { title: 'Mind lab', text: 'Breathwork and NSDR sessions to bring cortisol down and recovery up.' },
];
