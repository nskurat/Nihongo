import { key } from '../normalize';

/**
 * Cleaned search keys of a vocab `word` or `reading` (docs/search/04-data.md §2.2,
 * teacher §3). The display string is never changed; these keys are what gets matched.
 */
export interface VariantPart {
  /** Keys of this `／` part: with and without optional text (`[お]花見` → 花見, お花見). */
  variants: string[];
  /** Leading/trailing 〜 marks an affix (`〜中`). */
  affix: boolean;
}

export interface VocabVariants {
  parts: VariantPart[];
  /** All variants of all parts, deduplicated, in order. */
  variants: string[];
  /** Collocation hints from `[…〜…]` brackets, tilde removed (`迷う [道に〜]` → 道に). */
  hints: string[];
}

const READING_GLOSS = /([一-鿿々])[(（]([ぁ-ゖ]+)[)）]/g;
const HINT_BRACKET = /\s*\[([^\]]*[~～〜][^\]]*)\]\s*/g;
const OPTIONAL = /\[([^\]]*)\]|[(（]([^)）]*)[)）]/;
const MAX_FORMS = 6;

function expandOptional(s: string): string[] {
  let forms = [s];
  for (let guard = 0; guard < 4 && forms.some((f) => OPTIONAL.test(f)); guard++) {
    forms = forms.flatMap((f) => {
      const m = OPTIONAL.exec(f);
      if (!m) return [f];
      const inner = m[1] ?? m[2] ?? '';
      const before = f.slice(0, m.index);
      const after = f.slice(m.index + m[0].length);
      return [before + after, before + inner + after];
    });
    if (forms.length > MAX_FORMS) forms = forms.slice(0, MAX_FORMS);
  }
  return forms;
}

export function vocabVariants(raw: string): VocabVariants {
  const hints: string[] = [];
  const parts: VariantPart[] = [];
  const s = raw.normalize('NFKC').replace(READING_GLOSS, '$1');
  for (const piece of s.split(/[／/]/)) {
    const p = piece.replace(HINT_BRACKET, (_, inner: string) => {
      for (const h of inner.split(/[／/]/)) {
        const k = key(h);
        if (k && !hints.includes(k)) hints.push(k);
      }
      return '';
    });
    const trimmed = p.trim();
    const affix = /^[~～〜]|[~～〜]$/.test(trimmed);
    const variants: string[] = [];
    for (const f of expandOptional(trimmed)) {
      const k = key(f);
      if (k && !variants.includes(k)) variants.push(k);
    }
    if (variants.length) parts.push({ variants, affix });
  }
  const all: string[] = [];
  for (const part of parts) for (const v of part.variants) if (!all.includes(v)) all.push(v);
  return { parts, variants: all, hints };
}

/**
 * A kana set phrase → its casual short form, which learners type and hear as often
 * (おはようございます → おはよう, ごちそうさまでした → ごちそうさま, おやすみなさい → おやすみ).
 * Lets the N5 phrase rank with an exact hit on the short form (regression leftover).
 */
export function casualPhraseAlias(surface: string): string | null {
  const m = /^([ぁ-ゖー]{2,})(ございます|でした|なさい)$/.exec(surface);
  return m ? m[1] : null;
}

/** お/ご/御 + kanji noun → the form without the prefix (`お酒` → 酒). Kana-initial おいしい never matches. */
export function honorificAlias(surface: string): string | null {
  return /^[おご御][一-鿿]/.test(surface) ? surface.slice(1) : null;
}
