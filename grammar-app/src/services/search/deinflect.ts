import { DEINFLECT_RULES, IRREGULAR_WORDS, type Label, type WordType } from './deinflectRules';

export interface Deinflection {
  /** Candidate dictionary form. Not checked against the data here. */
  lemma: string;
  /** Steps from the lemma outward: 食べられない → [potential/passive, negative]. */
  steps: Label[];
  /** The type the lemma would have (v1, v5, vk, vs, adj-i, noun). */
  type: WordType;
}

export const MAX_DEPTH = 3;

/**
 * All candidate lemmas of a (normalised) query, shortest paths first, deduplicated by
 * lemma. Over-generates on purpose (かえって → かえる, かえう, かえつ…): the caller keeps
 * only lemmas that exist in the index. Pure.
 */
export function deinflect(word: string): Deinflection[] {
  const out: Deinflection[] = [];
  const seen = new Set<string>([word]);
  type Node = { w: string; steps: Label[]; type: WordType | null };
  let frontier: Node[] = [{ w: word, steps: [], type: null }];

  const emit = (node: Node, lemma: string, label: Label, type: WordType, next: Node[]) => {
    if (!lemma || seen.has(lemma)) return;
    seen.add(lemma);
    const c: Node = { w: lemma, steps: [label, ...node.steps], type };
    out.push({ lemma, steps: c.steps, type });
    next.push(c);
  };

  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      if (node.type === null) {
        for (const irr of IRREGULAR_WORDS[node.w] ?? []) emit(node, irr.lemma, irr.label, 'v5', next);
      }
      for (const rule of DEINFLECT_RULES) {
        if (node.type !== null && !rule.in.includes(node.type)) continue;
        if (!node.w.endsWith(rule.from) || node.w.length < rule.from.length) continue;
        const stem = node.w.slice(0, node.w.length - rule.from.length);
        if (!stem && !rule.to) continue;
        // A bare suffix is not a word (`ます` alone → `る`).
        if (!stem && rule.to.length <= 1) continue;
        emit(node, stem + rule.to, rule.label, rule.out, next);
      }
    }
    frontier = next;
  }
  return out;
}
