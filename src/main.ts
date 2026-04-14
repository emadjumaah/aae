/**
 * Arabic Algebra Engine — CLI
 *
 * Fully standalone — no API key needed.
 *
 * Usage:
 *   npm run dev "Schedule a meeting with the team"
 *   npm run dev -- --interactive
 */

import { runVerbose } from "./pipeline.js";
import * as readline from "readline";

const args = process.argv.slice(2);

if (args.includes("--interactive")) {
  // Interactive REPL mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n  Arabic Algebra Reasoning Engine (standalone)");
  console.log("  No API key. No network. Pure symbolic reasoning.");
  console.log("  Type in English or Arabic. Ctrl+C to exit.\n");

  const ask = () => {
    rl.question("You: ", (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return ask();
      if (["quit", "exit", "q"].includes(input.toLowerCase())) {
        rl.close();
        return;
      }
      try {
        const result = runVerbose(input);
        console.log(`\nAssistant: ${result.response}\n`);
      } catch (e) {
        console.error(`Error: ${e}`);
      }
      ask();
    });
  };

  ask();
} else if (args.length > 0) {
  // Single sentence mode
  const sentence = args.join(" ");
  const result = runVerbose(sentence);
  console.log(`\nFinal: ${result.response}`);
} else {
  console.log(`
arabic-algebra-engine (standalone — no API key needed)

Usage:
  npm run dev "<sentence>"          Run a single sentence through the engine
  npm run dev -- --interactive      Start interactive REPL
  npm run playground                Launch web playground at http://localhost:3000

  npm test                          Run all tests

Examples:
  npm run dev "Schedule a meeting with the team tomorrow"
  npm run dev "أريد إرسال تقرير إلى المدير"
  npm run dev -- --interactive
`);
}
