/**
 * CLI helper: reads lines from stdin, encodes each through the algebra engine,
 * serializes to token IDs, and outputs JSON per line.
 *
 * Used by training/interactive_test.py for arbitrary input testing.
 *
 * Usage: echo "أرسل الرسالة" | npx tsx src/_encode_stdin.ts
 */

import { encodeLocal } from "./engine/core/encoder.js";
import { serializeInput } from "./training/serializer.js";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line: string) => {
  const text = line.trim();
  if (!text) return;

  try {
    const token = encodeLocal(text);
    const serialized = serializeInput(token);

    const result = {
      input_text: text,
      root: token.root,
      rootLatin: token.rootLatin,
      intent: token.intent,
      pattern: token.pattern,
      verbForm: token.verbForm ?? null,
      tense: token.tense?.tense ?? null,
      input_tokens: serialized.tokens,
      input_ids: serialized.ids,
    };

    console.log(JSON.stringify(result));
  } catch (err) {
    console.log(
      JSON.stringify({ error: (err as Error).message, input_text: text }),
    );
  }
});
