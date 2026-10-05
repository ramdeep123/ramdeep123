// Fuel: BMR-regulated energy budget, macros, Indian meal plan, water, regulator.

import { state, update, today as dayState } from '../store.js';
import { header, profileNow, energyToday, refresh, gate, isPro } from '../core.js';
import { bmr, macros, mealPlan, waterLitres, regulate, proteinTopUp, GOALS } from '../engine/nutrition.js';
import { DIETS } from '../engine/foods.js';
import { dayKey, keyToTs, weekday, esc, fmtNum } from '../engine/util.js';
import { icon, ring, toast, openSheet, stepper, nudge } from '../ui.js';

let modeOverride = null; // null = follow the program, true = training, false = rest

function isTrainingDay(key) {
  const wd = weekday(keyToTs(key));
  const d = state.program?.week?.[wd];
  return !!d && !d.rest;
}

export function planFor(key = dayKey(), training = null) {
  const p = profileNow();
  const tr = training ?? (key === dayKey() && modeOverride != null ? modeOverride : isTrainingDay(key));
  const e = energyToday(tr);
  const swaps = state.days[key]?.swaps || {};
  return { ...mealPlan(p, key, e.kcal, swaps, tr), energy: e, training: tr };
}

function macroTile(label, eaten, target, color) {
  const pct = Math.min(1, target ? eaten / target : 0);
  return `<div class="m"><span class="eyebrow">${label}</span><span class="num">${eaten}<span class="faint" style="font-size:15px"> / ${target} g</span></span>
    <div class="meter"><i style="width:${pct * 100}%;background:${color}"></i></div></div>`;
}

export function html() {
  const key = dayKey();
  const plan = planFor(key);
  const e = plan.energy;
  const p = e.profile;
  const b = bmr(p);
  const m = macros(e.kcal, p);
  const d = state.days[key] || { eaten: {}, water: 0 };
  const eaten = plan.meals.filter((x) => d.eaten?.[x.slot]);
  const eat = eaten.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const water = waterLitres(p, plan.training);
  const glasses = Math.ceil(water / 0.25);
  const goal = GOALS.find((g) => g.id === p.goal);
  const reg = regulate(state.weights, p, state.nutrition, Date.now());
  const lastLog = (state.nutrition.log || []).slice(-1)[0];
  const maint = e.maintenance;
  const pc = (v) => `${(v / maint) * 100}%`;
  const pro = isPro();

  const deltaText = e.goalDelta === 0 ? 'maintenance' : `${e.goalDelta > 0 ? '+' : '−'}${fmtNum(Math.abs(e.goalDelta))} kcal for ${goal.short.toLowerCase()}`;

  return `${header(`BMR-regulated · ${plan.training ? 'Training day' : 'Rest day'}`, 'Fuel')}
    <section class="card">
      <div class="card-head"><span class="eyebrow">Your engine · kcal per day</span><button class="link small" data-act="bmrInfo">How it works</button></div>
      <div class="energy-bar" role="img" aria-label="BMR ${e.bmr}, daily movement ${e.movement}, training ${e.training} kcal">
        <div style="width:${pc(e.bmr)};background:var(--gold)">BMR</div>
        <div style="width:${pc(e.movement)};background:#FF9A4A">MOVE</div>
        <div style="width:${pc(e.training)};background:var(--ember)">GYM</div>
      </div>
      <div class="legend">
        <span><i style="background:var(--gold)"></i>BMR <b class="tabnum">${fmtNum(e.bmr)}</b></span>
        <span><i style="background:#FF9A4A"></i>Daily movement <b class="tabnum">${fmtNum(e.movement)}</b></span>
        <span><i style="background:var(--ember)"></i>Training avg <b class="tabnum">${fmtNum(e.training)}</b></span>
      </div>
      <div class="divider"></div>
      <div class="row between wrap">
        <div class="stack" style="gap:2px"><span class="eyebrow">Maintenance</span><span class="num" style="font-size:30px">${fmtNum(maint)}</span></div>
        <div class="stack" style="gap:2px;text-align:right"><span class="eyebrow">Your target</span><span class="num accent" style="font-size:30px">${fmtNum(e.target)}</span></div>
      </div>
      <p class="muted small">${esc(deltaText)}${e.adjust ? ` · regulator ${e.adjust > 0 ? '+' : '−'}${Math.abs(e.adjust)}` : ''}. ${e.floorActive ? `<b>BMR floor active:</b> we won't plan below ${fmtNum(b.value)} kcal.` : `Never below your BMR of ${fmtNum(b.value)} kcal.`}</p>
    </section>

    <section class="card">
      <div class="seg" role="group" aria-label="Day type">
        <button data-act="mode" data-v="1" aria-pressed="${plan.training}">Training day</button>
        <button data-act="mode" data-v="0" aria-pressed="${!plan.training}">Rest day</button>
      </div>
      <div class="row" style="gap:16px">
        ${ring(eat.kcal / e.kcal, { size: 112, stroke: 9, inner: `<span class="num" style="font-size:30px">${fmtNum(eat.kcal)}</span><span class="faint" style="font-size:10.5px">of ${fmtNum(e.kcal)} kcal</span>` })}
        <div class="stack grow" style="gap:6px">
          <span class="h3">${fmtNum(Math.max(0, e.kcal - eat.kcal))} kcal left</span>
          <span class="muted small">${e.trainDay === e.restDay ? `Same target every day — your plan already sits at the BMR floor, so we don\u2019t cycle calories.` : plan.training ? `Training days get ${fmtNum(e.trainDay - e.target)} extra kcal as carbs around your session.` : 'Rest days run slightly lower so the weekly average stays on target.'}</span>
        </div>
      </div>
      <div class="macro">
        ${macroTile('Protein', eat.p, m.protein, 'var(--magma)')}
        ${macroTile('Carbs', eat.c, m.carbs, 'var(--gold)')}
        ${macroTile('Fat', eat.f, m.fat, 'var(--ember)')}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><span class="eyebrow">Today's meals · ${esc(DIETS.find((x) => x.id === (p.diet || 'veg'))?.label || '')}</span><span class="tag">${fmtNum(plan.totals.kcal)} kcal</span></div>
      ${pro ? `<div class="list">${plan.meals.map((x) => `<div class="meal ${d.eaten?.[x.slot] ? 'eaten' : ''}">
          <div class="stack" style="gap:3px;min-width:0">
            <span class="eyebrow">${esc(x.label)}</span>
            <span class="h3">${esc(x.dish.name)}</span>
            <span class="faint small">${x.mult !== 1 ? `${x.mult}× ` : ''}${esc(x.dish.serving)} · ${fmtNum(x.kcal)} kcal · ${x.p} g protein</span>
          </div>
          <div class="acts">
            <button class="icon-btn" data-act="swap" data-slot="${x.slot}" aria-label="Swap ${esc(x.label)}">${icon('swap')}</button>
            <button class="check" data-act="eat" data-slot="${x.slot}" aria-label="Mark ${esc(x.label)} eaten" style="${d.eaten?.[x.slot] ? 'background:var(--good);color:#062213' : ''}">${icon('check')}</button>
          </div>
        </div>`).join('')}</div>
        ${plan.totals.p < m.protein - 15 ? `<div class="banner">${icon('bolt')}<span class="grow"><b>Protein gap ${m.protein - plan.totals.p} g.</b> ${esc(proteinTopUp(p.diet))}</span></div>` : ''}
        <span class="faint small">Values are approximate for home-style cooking. Swap any meal you don't like.</span>`
      : `<div class="empty">${icon('lock')}<br>Your personal meal plan is part of KAYA Pass.<br><button class="btn small" style="margin-top:12px" data-act="unlock">Unlock KAYA Pass</button></div>`}
    </section>

    <section class="card">
      <div class="card-head"><span class="eyebrow">Water · ${water} L target</span><span class="faint small mono">${d.water || 0} / ${glasses} glasses</span></div>
      <div class="water">${Array.from({ length: glasses }, (_, i) => `<button data-act="water" data-n="${i + 1}" class="${i < (d.water || 0) ? 'on' : ''}" aria-label="${i + 1} glasses"></button>`).join('')}</div>
    </section>

    <section class="card">
      <div class="card-head"><span class="eyebrow">Metabolic regulator</span><span class="tag ${reg.ready ? 'good' : ''}">${reg.ready ? 'Active' : 'Learning'}</span></div>
      <p class="muted">${esc(reg.message)}</p>
      ${lastLog ? `<span class="faint small">Last change: ${esc(lastLog.message)}</span>` : ''}
      <div class="row">
        <div class="grow">${stepper('wIn', profileNow().weight.toFixed(1), { unit: 'kg today', step: 0.1, min: 30, max: 250 })}</div>
        <button class="btn" data-act="logWeight">Log</button>
      </div>
    </section>

    <section class="card">
      <span class="eyebrow">Food preference</span>
      <div class="chips">${DIETS.map((x) => `<button class="chip" data-act="diet" data-v="${x.id}" aria-pressed="${(p.diet || 'veg') === x.id}">${x.label}</button>`).join('')}</div>
    </section>`;
}

export function mount() {}

export const actions = {
  mode(el) { modeOverride = el.dataset.v === '1'; refresh(); },
  eat(el) {
    const key = dayKey();
    update(() => { const d = dayState(key); d.eaten[el.dataset.slot] = !d.eaten[el.dataset.slot]; });
    refresh();
  },
  swap(el) {
    const key = dayKey();
    update(() => { const d = dayState(key); d.swaps[el.dataset.slot] = (d.swaps[el.dataset.slot] || 0) + 1; d.eaten[el.dataset.slot] = false; });
    refresh();
  },
  water(el) {
    const n = Number(el.dataset.n);
    update(() => { const d = dayState(dayKey()); d.water = d.water === n ? n - 1 : n; });
    refresh();
  },
  step(el) { nudge(el); },
  logWeight() {
    const kg = parseFloat(document.getElementById('wIn').value);
    if (!(kg > 30 && kg < 250)) { toast('Enter a weight between 30 and 250 kg'); return; }
    const key = dayKey();
    update((s) => {
      s.weights = s.weights.filter((w) => w.date !== key);
      s.weights.push({ date: key, kg: Math.round(kg * 10) / 10 });
      const r = regulate(s.weights, { ...s.profile, weight: kg }, s.nutrition, Date.now());
      if (r.ready && r.due && r.step !== 0) {
        s.nutrition.adjust = r.adjust;
        s.nutrition.lastAdjustAt = Date.now();
        s.nutrition.log = [...(s.nutrition.log || []), { at: Date.now(), step: r.step, message: r.message }].slice(-20);
        setTimeout(() => toast(r.step < 0 ? `Calories trimmed by ${-r.step}` : `Calories raised by ${r.step}`), 300);
      } else if (r.ready && r.due) {
        s.nutrition.lastAdjustAt = Date.now();
      }
    });
    toast('Weight logged');
    refresh();
  },
  diet(el) {
    update((s) => { s.profile.diet = el.dataset.v; });
    refresh();
  },
  unlock() { gate('diet', () => {}); },
  bmrInfo() {
    const p = profileNow();
    const b = bmr(p);
    openSheet({
      temp: 'fuel',
      html: `<span class="eyebrow">How your calories are set</span>
        <h2 class="h2">BMR first, everything else on top</h2>
        <div class="stack">
          <p class="muted"><b>BMR</b> (basal metabolic rate) is the energy your body burns at complete rest — breathing, heartbeat, brain, keeping warm. It is usually the biggest slice of your day.</p>
          <div class="banner"><span class="grow mono small">${esc(b.formula)}: ${esc(b.explain)} = <b>${fmtNum(b.value)} kcal</b></span></div>
          <p class="muted">We add your <b>daily movement</b> (from your lifestyle) and the <b>average cost of your training</b> to get maintenance. Then we apply your goal.</p>
          <p class="muted">The rule that never bends: your plan never drops below your BMR. Eating under it for long stretches costs muscle, mood and sleep.</p>
          <p class="muted">Every week, the <b>metabolic regulator</b> compares your real weight trend with the plan and nudges calories by up to 150 kcal a day — so the plan fits your body, not a formula.</p>
        </div>
        <button class="btn block" data-act="close">Got it</button>`,
    });
  },
};
