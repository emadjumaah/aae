/**
 * Arabic Algebra Engine — Web Playground Server
 *
 * Zero dependencies: uses Node built-in http module.
 * Serves the playground UI and a JSON API for examples + engine.
 *
 * Usage: tsx src/playground/server.ts
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLES } from "../examples.js";
import { ROOTS, PATTERNS } from "../core/dictionary.js";
import { engine } from "../core/engine.js";
import { compactToken } from "../core/types.js";
import { encodeLocal } from "../core/encoder.js";
import { decodeLocal } from "../core/decoder.js";
import type {
  AlgebraToken,
  IntentOperator,
  PatternOperator,
  ArabicRoot,
} from "../core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ─── Build the action-rules matrix for visualization ───────────────────────

const INTENTS: IntentOperator[] = [
  "seek",
  "do",
  "send",
  "gather",
  "record",
  "learn",
  "decide",
  "enable",
  "judge",
  "ask",
];
const PATTERN_OPS: PatternOperator[] = [
  "agent",
  "patient",
  "place",
  "instance",
  "plural",
  "seek",
  "mutual",
  "process",
  "intensifier",
  "causer",
];

function buildRulesMatrix() {
  const matrix: Record<string, Record<string, string | null>> = {};
  for (const intent of INTENTS) {
    matrix[intent] = {};
    for (const pattern of PATTERN_OPS) {
      // Use engine to reason a dummy token — if confidence is 0.5, no rule matched
      const token: AlgebraToken = {
        intent,
        root: "عمل",
        rootLatin: "'m-l",
        pattern,
        modifiers: [],
      };
      const result = engine.reason(token);
      matrix[intent][pattern] =
        result.confidence > 0.5 ? result.actionType : null;
    }
  }
  return matrix;
}

// ─── API data ──────────────────────────────────────────────────────────────

const apiData = {
  examples: EXAMPLES.map((e) => ({
    id: e.id,
    inputEn: e.inputEn,
    inputAr: e.inputAr,
    token: e.token,
    algebraCompact: e.algebraCompact,
    reasoning: e.reasoning,
    explanation: e.explanation,
    response: e.response,
  })),
  roots: ROOTS,
  patterns: PATTERNS,
  intents: INTENTS,
  rulesMatrix: buildRulesMatrix(),
};

// ─── Reason endpoint (no LLM, just engine) ─────────────────────────────────

function handleReason(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      intent: IntentOperator;
      root: ArabicRoot;
      rootLatin: string;
      pattern: PatternOperator;
      modifiers: string[];
    };
    const token: AlgebraToken = {
      intent: parsed.intent,
      root: parsed.root,
      rootLatin: parsed.rootLatin,
      pattern: parsed.pattern,
      modifiers: parsed.modifiers ?? [],
    };
    const reasoning = engine.reason(token);
    return JSON.stringify({
      token,
      algebraCompact: compactToken(token),
      reasoning,
      explanation: engine.explain(token),
    });
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

// ─── Full standalone pipeline endpoint ─────────────────────────────────────

function handleRun(body: string): string {
  try {
    const { input } = JSON.parse(body) as { input: string };
    if (!input?.trim()) return JSON.stringify({ error: "Empty input" });

    const start = Date.now();
    const token = encodeLocal(input.trim());
    const reasoning = engine.reason(token);
    const response = decodeLocal(reasoning);

    return JSON.stringify({
      input: input.trim(),
      token,
      algebraCompact: compactToken(token),
      reasoning,
      explanation: engine.explain(token),
      response,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

// ─── Body size limit (16KB) ────────────────────────────────────────────────
const MAX_BODY_SIZE = 16 * 1024;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("Body too large"));
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ─── MIME types ────────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// ─── Server ────────────────────────────────────────────────────────────────

const server = http.createServer(
  async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API endpoints
    if (url.pathname === "/api/data") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(apiData));
      return;
    }

    if (url.pathname === "/api/reason" && req.method === "POST") {
      try {
        const body = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(handleReason(body));
      } catch {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
      }
      return;
    }

    if (url.pathname === "/api/run" && req.method === "POST") {
      try {
        const body = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(handleRun(body));
      } catch {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
      }
      return;
    }

    // Static files
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    // Sanitize path to prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(__dirname, "public", filePath);

    // Ensure resolved path is within public directory
    const publicDir = path.join(__dirname, "public");
    if (!path.resolve(fullPath).startsWith(path.resolve(publicDir))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(fullPath);

    fs.readFile(fullPath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
      });
      res.end(data);
    });
  },
);

server.listen(PORT, () => {
  console.log(`\n  Arabic Algebra Playground → http://localhost:${PORT}\n`);
});
