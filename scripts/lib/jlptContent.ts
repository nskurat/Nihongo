/**
 * Pure, side-effect-free helpers shared by the JLPT kanji/vocab content scripts.
 * Unit-tested in grammar-app/src/utils/__tests__/jlptContent.test.ts.
 */

export interface SourceKanji {
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  strokes: number;
  freq: number | null;
  radical: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
}

export interface SourceWord {
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  jmdictSeq: number;
  kanji: string;
  kana: string;
  meaning: string;
}

export interface Compound {
  word: string;
  reading: string;
  meaning: string;
}

/** "迷う [道に〜]" → "迷う"; also strips (…), （…） and ［…］ annotations. */
export function stripAnnotation(word: string): string {
  return word.replace(/\s*[[［(（][^\]］)）]*[\]］)）]\s*/g, '').trim();
}

/** The kanji characters of a word, in order (々 and kana excluded). */
export function kanjiOf(word: string): string[] {
  return Array.from(word).filter((ch) => /[一-鿿]/.test(ch));
}

/** KANJIDIC meanings → the short display meaning used across the app. */
export function displayMeaning(meanings: string[], max = 4): string {
  return meanings.slice(0, max).join(', ');
}

/** Prefix/suffix readings like "-び" or "こ-" clutter a reference card. */
export function cleanKunyomi(kunyomi: string[]): string[] {
  return kunyomi.filter((r) => !r.startsWith('-') && !r.endsWith('-'));
}

export function strokeOrderLink(kanji: string): string {
  return `https://jisho.org/search/${encodeURIComponent(`${kanji}#kanji`)}`;
}

/** Up to `max` distinct compounds containing `kanji`, in candidate order. */
export function pickCompounds(kanji: string, candidates: Compound[], max = 4): Compound[] {
  const out: Compound[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c.word.includes(kanji) || seen.has(c.word)) continue;
    seen.add(c.word);
    out.push(c);
    if (out.length === max) break;
  }
  return out;
}

/**
 * Picks the lesson for a new item: the first preferred lesson still under `cap`, else
 * the lesson with the fewest items (ties → lowest lesson number). Mutates nothing.
 */
export function pickLesson(
  counts: Record<number, number>,
  preferred: number[],
  cap: number
): number {
  const fit = preferred.find((l) => (counts[l] ?? 0) < cap);
  if (fit !== undefined) return fit;
  const lessons = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return lessons.reduce((best, l) => (counts[l] < counts[best] ? l : best), lessons[0]);
}

/**
 * Whether a list word is already taught somewhere: its written form appears, or —
 * for a word our data writes in kana — its reading appears as a word form.
 */
export function isWordCovered(word: SourceWord, forms: Set<string>): boolean {
  return forms.has(word.kanji || word.kana) || forms.has(word.kana);
}

/** Frequency order: most frequent first, unranked last, then strokes, then codepoint. */
export function byFrequency(a: [string, SourceKanji], b: [string, SourceKanji]): number {
  const fa = a[1].freq ?? Number.MAX_SAFE_INTEGER;
  const fb = b[1].freq ?? Number.MAX_SAFE_INTEGER;
  return fa - fb || a[1].strokes - b[1].strokes || a[0].codePointAt(0)! - b[0].codePointAt(0)!;
}
