import { DEINFLECT_RULES, IRREGULAR_WORDS, L, type Label, type WordType } from './deinflectRules';

export interface Deinflection {
  /** Candidate dictionary form. Not checked against the data here. */
  lemma: string;
  /** Steps from the lemma outward: 食べられない → [potential/passive, negative]. */
  steps: Label[];
  /** The class the lemma must have (v1, v5, vk, vs, adj-i, noun, plain). */
  type: WordType;
  /** Reached through する/来る/行く/ある/いい: common, ranks first among ties. */
  irregular: boolean;
}

export const MAX_DEPTH = 3;

const KANJI_RUN = /^[一-鿿㐀-䶿々]{2,}$/;
const KATAKANA_RUN = /^[ァ-ヺー]+$/;
const IRREGULAR_LEMMA = /(する|くる|来る)$|^(ある|いい|行く|いく)$/;

/** Rules that delete a whole word ending ('' target) need a real stem in front. */
function stemAllowed(stem: string, label: Label): boolean {
  if (label === L.suru) return KANJI_RUN.test(stem) || KATAKANA_RUN.test(stem); // 勉強する, コピーする — not 話する
  return [...stem].length >= 2; // 静かだ, 学生です, 食べるなら — not まだ → ま
}

/**
 * All candidate lemmas of a (normalised) query, shortest paths first, deduplicated by
 * lemma and type. Over-generates on purpose; the caller keeps only lemmas that exist in the index
 * with a compatible word class. Pure.
 */
export function deinflect(word: string): Deinflection[] {
  const out: Deinflection[] = [];
  const seen = new Set<string>();
  type Node = { w: string; steps: Label[]; type: WordType | null };
  let frontier: Node[] = [{ w: word, steps: [], type: null }];

  const emit = (node: Node, lemma: string, label: Label | null, type: WordType, next: Node[]) => {
    // Dedupe by lemma AND type: 来られる is 来る as vk, not as an ichidan 来る.
    const id = `${lemma}|${type}`;
    if (!lemma || lemma === word || seen.has(id)) return;
    seen.add(id);
    const steps = label ? [label, ...node.steps] : node.steps;
    out.push({ lemma, steps, type, irregular: IRREGULAR_LEMMA.test(lemma) });
    next.push({ w: lemma, steps, type });
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
        if (!stem && rule.to.length <= 1) continue; // a bare suffix is not a word (ます → る)
        if (!rule.to && !stemAllowed(stem, rule.label)) continue;
        // いい inflects on よい only: いく / いかった are not forms of いい (R5); いいです is.
        if (stem + rule.to === 'いい' && !node.w.startsWith('いい') && !rule.from.startsWith('よ')) continue;
        // After a stripped auxiliary the te-form itself is not a step worth showing.
        const label = node.type === 'aux' && rule.label === L.te ? null : rule.label;
        emit(node, stem + rule.to, label, rule.out, next);
      }
    }
    frontier = next;
  }
  return out;
}
