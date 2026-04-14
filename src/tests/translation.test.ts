/**
 * Translation Layer Tests — requires ANTHROPIC_API_KEY
 * Run with: npm run test:translation
 *
 * Tests the full pipeline: natural language → algebra → reason → response
 */

import { encode, decode } from '../core/translation.js'
import { engine }         from '../core/engine.js'
import { compactToken }   from '../core/types.js'
import { run }            from '../pipeline.js'

const VALID_INTENTS  = new Set(['seek','do','send','gather','record','learn','decide','enable','judge','ask'])
const VALID_PATTERNS = new Set(['agent','patient','place','instance','plural','seek','mutual','process','intensifier','causer'])
const VALID_ROOTS    = new Set(['كتب','علم','عمل','رسل','جمع','درس','فكر','وقت','مكن','حكم','سأل','قرر'])

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail?: string) {
  const icon = condition ? '✓' : '✗'
  console.log(`  ${icon}  ${label}`)
  if (!condition && detail) console.log(`       ${detail}`)
  condition ? passed++ : failed++
}

console.log('\nArabic Algebra Engine — Translation Tests\n')

// ─── Encode tests ──────────────────────────────────────────────────────────
console.log('Encode: natural language → AlgebraToken')

const sentences = [
  "Schedule a meeting with the team tomorrow afternoon",
  "Send the weekly report to my manager",
  "I need to learn more about this topic",
  "Book a conference room for Friday",
  "أريد عقد اجتماع مع الفريق",  // Arabic input
]

for (const sentence of sentences) {
  try {
    const token = await encode(sentence)
    check(
      `encode("${sentence.slice(0, 40)}...")`,
      VALID_INTENTS.has(token.intent) &&
      VALID_PATTERNS.has(token.pattern) &&
      VALID_ROOTS.has(token.root),
      `got intent=${token.intent} root=${token.root} pattern=${token.pattern}`
    )
  } catch (e) {
    check(`encode("${sentence.slice(0, 40)}...")`, false, String(e))
  }
}

// ─── Full pipeline tests ───────────────────────────────────────────────────
console.log('\nFull pipeline: encode → reason → decode')

const pipelineTests = [
  "Schedule a team standup for tomorrow morning",
  "Send a summary of today's work to the team",
  "I need to study the project requirements",
]

for (const input of pipelineTests) {
  try {
    const result = await run(input)
    const hasResponse = result.response.length > 10
    const hasAlgebra  = result.algebraCompact.length > 0
    check(
      `pipeline("${input.slice(0, 45)}...")`,
      hasResponse && hasAlgebra,
      `algebra=${result.algebraCompact} | response=${result.response.slice(0, 60)}`
    )
    console.log(`       → ${result.algebraCompact}`)
    console.log(`       → ${result.response.slice(0, 80)}`)
  } catch (e) {
    check(`pipeline("${input.slice(0, 45)}...")`, false, String(e))
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────
const total = passed + failed
console.log(`\n${'─'.repeat(40)}`)
console.log(`${passed}/${total} tests passed${failed > 0 ? ` — ${failed} failed` : ' ✓'}`)
console.log()

if (failed > 0) process.exit(1)
