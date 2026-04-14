/**
 * Arabic Algebra Engine — Translation Layer
 *
 * The ONLY place in the system that calls an LLM.
 * Sits at the edges of the pipeline.
 *
 *   encode : natural language  → AlgebraToken
 *   decode : ReasoningResult   → natural language
 *
 * Uses claude-haiku (smallest/fastest) — this should be a thin layer.
 */

import type { AlgebraToken, ReasoningResult, ArabicRoot, IntentOperator, PatternOperator } from './types.js'
import { ROOT_LATIN_MAP, ALL_ROOTS, ALL_PATTERNS, ALL_INTENTS } from './dictionary.js'

// ─── Config ────────────────────────────────────────────────────────────────

const API_URL   = 'https://api.anthropic.com/v1/messages'
const API_MODEL = 'claude-haiku-4-5-20251001'
const API_KEY   = process.env.ANTHROPIC_API_KEY ?? ''

// ─── Raw API call ──────────────────────────────────────────────────────────

async function callClaude(system: string, user: string, maxTokens = 400): Promise<string> {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set in environment')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: API_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
}

// ─── Encode ────────────────────────────────────────────────────────────────

const ENCODE_SYSTEM = `You are the encoding layer of an Arabic root-pattern algebra reasoning engine.
Convert any natural language input into a structured algebra token.
Return ONLY valid JSON. No markdown. No explanation. No preamble.`

/**
 * encode — natural language → AlgebraToken
 * One small LLM call. Returns a fully typed token.
 */
export async function encode(sentence: string): Promise<AlgebraToken> {
  const prompt = `Convert this input to algebra:
"${sentence}"

Available roots (arabic): ${ALL_ROOTS}
Available intents: ${ALL_INTENTS}
Available patterns: ${ALL_PATTERNS}

Return exactly this JSON structure:
{
  "intent": "<intent>",
  "root": "<arabic root>",
  "pattern": "<pattern>",
  "modifiers": ["key:value", ...]
}`

  const raw  = await callClaude(ENCODE_SYSTEM, prompt, 300)
  const clean = raw.replace(/```json|```/g, '').trim()
  const data  = JSON.parse(clean) as {
    intent:    IntentOperator
    root:      ArabicRoot
    pattern:   PatternOperator
    modifiers: string[]
  }

  return {
    intent:    data.intent,
    root:      data.root,
    rootLatin: ROOT_LATIN_MAP.get(data.root) ?? '?',
    pattern:   data.pattern,
    modifiers: data.modifiers ?? [],
  }
}

// ─── Decode ────────────────────────────────────────────────────────────────

const DECODE_SYSTEM = `You are the decoding layer of an Arabic root-pattern algebra reasoning engine.
You receive a resolved reasoning result and produce a natural, helpful response.
Be concise and direct. No system jargon. Sound like a capable assistant.`

/**
 * decode — ReasoningResult → natural language
 * Turns the engine's structured output back into human-readable response.
 */
export async function decode(result: ReasoningResult, originalInput: string): Promise<string> {
  const prompt = `Original user input: "${originalInput}"

The reasoning engine resolved this to:
  Action    : ${result.actionType}
  Resource  : ${result.resource}
  Constraints: ${result.constraints.join(', ') || 'none'}
  Intent    : ${result.resolvedIntent}

Write a concise, helpful response confirming what will be done.
If any critical information is missing to complete the action, ask for it.`

  return callClaude(DECODE_SYSTEM, prompt, 200)
}
