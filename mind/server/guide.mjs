// The AI guide: one Claude call per request, strict JSON out, then the same
// safety filters the app uses. Stateless — nothing is stored on the server.

import { TURN_SCHEMA, MAP_SCHEMA, sectionSchema, cleanTurn, cleanMapParts, MAP_SECTIONS } from '../js/engine/aishape.js';
import { crisisCheck, ageCheck } from '../js/engine/safety.js';
import { TURN_SYSTEM, MAP_SYSTEM, SECTION_SYSTEM, turnMessage, mapMessage, sectionMessage } from './prompt.mjs';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export class GuideError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/**
 * client: an Anthropic SDK client (or a test double with the same
 * `beta.messages.create` method).
 */
export function createGuide({ client, model = DEFAULT_MODEL, effortTurn = 'low', effortMap = 'medium' }) {
  async function ask({ system, user, schema, effort, maxTokens }) {
    const res = await client.beta.messages.create({
      model,
      max_tokens: maxTokens,
      // If a safety classifier declines, Anthropic re-runs the request on its
      // recommended fallback model instead of returning a refusal.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new GuideError('refusal');
    if (res.stop_reason === 'max_tokens') throw new GuideError('truncated');
    const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new GuideError('bad-json');
    }
  }

  return {
    model,

    /** Reflection for the newest answer (+ at most one follow-up question). */
    async turn({ stage, stageGoal, draftMap, turns }) {
      const newest = turns[turns.length - 1];
      const text = newest ? `${(newest.selected || []).join('. ')} ${newest.freeText || ''}` : '';
      // Same rule as the phone: safety first, and no AI call for a crisis.
      if (crisisCheck(text)) {
        return { ...cleanTurn({}), safetyFlag: true, reflection: ['Thank you for telling me. That sounds really hard. Let’s pause the questions — your safety comes first.'] };
      }
      if (ageCheck(text)) return { ...cleanTurn({}), ageFlag: true };
      const raw = await ask({
        system: TURN_SYSTEM,
        user: turnMessage({ stage, stageGoal, draftMap, turns: turns.slice(0, -1), newest }),
        schema: TURN_SCHEMA,
        effort: effortTurn,
        maxTokens: 8000,
      });
      const out = cleanTurn(raw);
      if (out.safetyFlag) return { ...cleanTurn({}), safetyFlag: true, reflection: out.reflection.slice(0, 1) };
      return out;
    },

    /** The full seven-section map. */
    async map({ turns, draftMap }) {
      const raw = await ask({ system: MAP_SYSTEM, user: mapMessage({ turns, draftMap }), schema: MAP_SCHEMA, effort: effortMap, maxTokens: 16000 });
      return cleanMapParts(raw);
    },

    /** Regenerate one section. */
    async section({ section, turns, map }) {
      if (!MAP_SECTIONS.includes(section)) throw new GuideError('bad-section', 400);
      const raw = await ask({ system: SECTION_SYSTEM, user: sectionMessage({ section, turns, map }), schema: sectionSchema(section), effort: effortMap, maxTokens: 8000 });
      return cleanMapParts(raw);
    },
  };
}

/** The real Claude client, loaded only when a key is configured. */
export async function claudeClient() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Reads ANTHROPIC_API_KEY from the environment. Short timeout: a person is waiting.
  return new Anthropic({ timeout: 60000, maxRetries: 1 });
}
