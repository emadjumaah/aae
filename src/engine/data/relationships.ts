/**
 * Arabic Algebra — Root Relationship Graph (METADATA ONLY)
 *
 * Maps semantic relationships between roots.
 * These are NOT enforced at runtime — they exist as:
 *   1. Training data annotations (the model learns these patterns)
 *   2. Debugging/trace output (explain() shows related roots)
 *   3. Corpus generation hints (training data includes relationship context)
 *
 * The model should LEARN these relationships from data, not have them hardcoded.
 * Nothing here overrides engine.reason() — reasoning should emerge from training.
 *
 * Relationship types:
 *   implies    — A naturally leads to B (سفر → شبك: travel implies roaming)
 *   requires   — A cannot happen without B (دفع → حسب: payment requires account)
 *   enables    — A makes B possible (فتح → عمل: opening enables working)
 *   follows    — B typically comes after A (فحص → علج: diagnosis before treatment)
 *   contradicts — A and B conflict (فتح ↔ إلغ: open contradicts cancel)
 */

export type RelationType =
  | "implies"
  | "requires"
  | "enables"
  | "follows"
  | "contradicts";

export interface RootRelation {
  from: string; // source root (arabic)
  to: string; // target root (arabic)
  type: RelationType;
  weight: number; // 0.0 - 1.0, strength of the relationship
  context?: string; // optional: when does this apply?
}

/**
 * The relationship graph.
 * Built from Arabic semantic structure + domain knowledge.
 * This is what models should learn — we seed it explicitly for now.
 */
export const ROOT_RELATIONS: RootRelation[] = [
  // ── Travel cluster ──────────────────────────────────────────────────
  { from: "سفر", to: "شبك", type: "implies", weight: 0.8, context: "telecom" },
  { from: "سفر", to: "خرج", type: "implies", weight: 0.9 },
  { from: "سفر", to: "حجز", type: "implies", weight: 0.7 },
  { from: "سفر", to: "وصل", type: "follows", weight: 0.8 },
  { from: "سفر", to: "دفع", type: "requires", weight: 0.6, context: "booking" },

  // ── Financial cluster ───────────────────────────────────────────────
  { from: "دفع", to: "حسب", type: "requires", weight: 0.9 },
  { from: "دفع", to: "رصد", type: "follows", weight: 0.7 },
  { from: "ثمن", to: "دفع", type: "implies", weight: 0.8 },
  {
    from: "ثمن",
    to: "حكم",
    type: "implies",
    weight: 0.6,
    context: "complaint",
  },
  { from: "حسب", to: "رصد", type: "enables", weight: 0.8 },

  // ── Service management cluster ──────────────────────────────────────
  { from: "إلغ", to: "قرر", type: "requires", weight: 0.8 },
  { from: "إلغ", to: "فتح", type: "contradicts", weight: 0.9 },
  { from: "فتح", to: "عمل", type: "enables", weight: 0.8 },
  { from: "فتح", to: "إلغ", type: "contradicts", weight: 0.9 },

  // ── Technical support cluster ───────────────────────────────────────
  { from: "عطل", to: "عون", type: "implies", weight: 0.9 },
  { from: "عطل", to: "فحص", type: "implies", weight: 0.8 },
  { from: "عطل", to: "صلح", type: "follows", weight: 0.7 },
  { from: "فحص", to: "علج", type: "follows", weight: 0.8 },
  { from: "فحص", to: "عرف", type: "enables", weight: 0.7 },

  // ── Communication cluster ──────────────────────────────────────────
  {
    from: "كتب",
    to: "رسل",
    type: "implies",
    weight: 0.6,
    context: "messaging",
  },
  { from: "رسل", to: "وصل", type: "follows", weight: 0.8 },
  { from: "سأل", to: "جوب", type: "implies", weight: 0.9 },
  { from: "سأل", to: "عرف", type: "implies", weight: 0.7 },

  // ── Medical cluster ─────────────────────────────────────────────────
  { from: "مرض", to: "علج", type: "implies", weight: 0.9 },
  { from: "مرض", to: "فحص", type: "implies", weight: 0.8 },
  { from: "مرض", to: "دوء", type: "implies", weight: 0.7 },
  { from: "علج", to: "شفي", type: "follows", weight: 0.7 },

  // ── Knowledge/learning cluster ──────────────────────────────────────
  { from: "علم", to: "درس", type: "implies", weight: 0.8 },
  { from: "درس", to: "فهم", type: "follows", weight: 0.7 },
  { from: "قرأ", to: "فهم", type: "enables", weight: 0.7 },
  { from: "علم", to: "عرف", type: "enables", weight: 0.8 },

  // ── Security cluster ───────────────────────────────────────────────
  { from: "سرق", to: "حظر", type: "implies", weight: 0.9, context: "security" },
  { from: "سرق", to: "بلغ", type: "implies", weight: 0.8 },
  { from: "فقد", to: "حظر", type: "implies", weight: 0.8, context: "device" },
  { from: "حظر", to: "بدل", type: "follows", weight: 0.7 },

  // ── Ordering/delivery cluster ──────────────────────────────────────
  { from: "طلب", to: "دفع", type: "requires", weight: 0.7 },
  { from: "طلب", to: "وصل", type: "follows", weight: 0.8 },
  { from: "شحن", to: "وصل", type: "follows", weight: 0.7 },
  { from: "وصل", to: "سلم", type: "follows", weight: 0.8 },

  // ── Work/employment cluster ────────────────────────────────────────
  { from: "عمل", to: "كسب", type: "enables", weight: 0.7 },
  { from: "عمل", to: "جهد", type: "requires", weight: 0.6 },
  { from: "وظف", to: "عمل", type: "enables", weight: 0.9 },

  // ── Decision/governance cluster ────────────────────────────────────
  { from: "قرر", to: "حكم", type: "implies", weight: 0.7 },
  { from: "حكم", to: "نفذ", type: "follows", weight: 0.8 },
  { from: "شور", to: "قرر", type: "follows", weight: 0.8 },
];

// ─── Lookup Helpers ────────────────────────────────────────────────────────

/** Get all relationships from a given root */
export function relationsFrom(root: string): RootRelation[] {
  return ROOT_RELATIONS.filter((r) => r.from === root);
}

/** Get all relationships to a given root */
export function relationsTo(root: string): RootRelation[] {
  return ROOT_RELATIONS.filter((r) => r.to === root);
}

/** Get related roots (outgoing) with optional type filter */
export function relatedRoots(
  root: string,
  type?: RelationType,
): Array<{ root: string; type: RelationType; weight: number }> {
  return ROOT_RELATIONS.filter(
    (r) => r.from === root && (!type || r.type === type),
  ).map((r) => ({ root: r.to, type: r.type, weight: r.weight }));
}

/** Check if two roots are related (in either direction) */
export function areRelated(a: string, b: string): RootRelation | undefined {
  return ROOT_RELATIONS.find(
    (r) => (r.from === a && r.to === b) || (r.from === b && r.to === a),
  );
}

/** Get the full chain: root → implied roots → their implied roots (BFS, max depth) */
export function implicationChain(
  root: string,
  maxDepth: number = 3,
): Array<{ root: string; depth: number; path: string[] }> {
  const visited = new Set<string>([root]);
  const result: Array<{ root: string; depth: number; path: string[] }> = [];
  let frontier = [{ root, depth: 0, path: [root] }];

  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      if (node.depth >= maxDepth) continue;
      const implied = ROOT_RELATIONS.filter(
        (r) =>
          r.from === node.root &&
          (r.type === "implies" || r.type === "follows") &&
          !visited.has(r.to),
      );
      for (const rel of implied) {
        visited.add(rel.to);
        const entry = {
          root: rel.to,
          depth: node.depth + 1,
          path: [...node.path, rel.to],
        };
        result.push(entry);
        next.push(entry);
      }
    }
    frontier = next;
  }

  return result;
}
