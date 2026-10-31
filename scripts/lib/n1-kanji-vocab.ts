/**
 * Pure, side-effect-free helpers for scripts/build-n1-kanji-vocab.ts. No node:fs here:
 * the build script does all I/O, so this module can be unit-tested from
 * grammar-app/src/__tests__/scripts/buildN1KanjiVocab.test.ts (vitest's root is grammar-app/).
 */

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

/** One entry of scripts/sources/jlpt-kanji.json (keyed by the kanji itself). */
export interface SourceKanji {
  level: JlptLevel;
  strokes: number;
  freq: number | null;
  radical: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
}

/** One entry of scripts/sources/jlpt-vocab.json. `kanji` is '' for kana-only words. */
export interface SourceWord {
  level: JlptLevel;
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

export interface BuiltKanji {
  uid: string;
  level: 'N1';
  section: 'kanji';
  lesson: number;
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
  meaning: string;
  strokes: number;
  radical: string;
  compounds?: Compound[];
  strokeOrderLink: string;
}

export interface BuiltVocab {
  uid: string;
  level: 'N1';
  section: 'vocab';
  lesson: number;
  word: string;
  reading: string;
  meaning: string;
}

/** Minimal shape of an item in our existing data/{n5,n4,n3}/vocab.json files. */
export interface ExistingVocab {
  word: string;
  reading: string;
}

const codepointCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The plain word forms an existing vocab row stands for. Our N5/N4 rows are
 * textbook-style ("迷う [道に〜]", "[お]花見", "近い／遠い", "〜ぐらい", "本社（ほんしゃ）／支店"),
 * so bracketed annotations are dropped, "／" pairs are split, and 〜, spaces and
 * a trailing 。 are removed.
 */
export function normalizeVocabForms(raw: string): string[] {
  const stripped = raw.replace(/[[［(（][^\]］)）]*[\]］)）]/g, '');
  return stripped
    .split(/[／/]/)
    .map((form) => form.replace(/[〜～\s。]/g, ''))
    .filter((form) => form.length > 0);
}

/**
 * Whether the list row has a gloss we can show. A few rows have none, and three N1
 * suffix rows (〜歳, 〜ヶ月, 〜畳) carry a spreadsheet's "#NAME?" in place of one.
 */
export function hasUsableGloss(word: SourceWord): boolean {
  const meaning = word.meaning.trim();
  return meaning.length > 0 && !meaning.startsWith('#');
}

/** The headword shown for a source word: its kanji form, or its kana when it has none. */
export function headword(word: SourceWord): string {
  return word.kanji || word.kana;
}

/**
 * Whether one of our lower-level vocab rows already teaches this word: matched on
 * the word form, or - for kana-only words - also on the reading of a row whose own
 * form is kana (a kana-only N1 word never counts as covered by a kanji row that
 * merely shares its reading, e.g. N1 はし vs. 箸).
 */
export function buildCoveredWordIndex(existing: ExistingVocab[]): {
  forms: Set<string>;
  kanaReadings: Set<string>;
} {
  const forms = new Set<string>();
  const kanaReadings = new Set<string>();
  for (const row of existing) {
    const rowForms = normalizeVocabForms(row.word);
    rowForms.forEach((form) => forms.add(form));
    if (rowForms.every((form) => !/\p{Script=Han}/u.test(form))) {
      normalizeVocabForms(row.reading).forEach((reading) => kanaReadings.add(reading));
    }
  }
  return { forms, kanaReadings };
}

export function isWordCovered(
  word: SourceWord,
  index: { forms: Set<string>; kanaReadings: Set<string> }
): boolean {
  if (word.kanji) return index.forms.has(word.kanji);
  return index.forms.has(word.kana) || index.kanaReadings.has(word.kana);
}

/** KANJIDIC lists the radical's own name as a meaning ("one radical (no. 1)"); not a gloss. */
const RADICAL_MEANING_RE = /radical \(no\.\s*\d+\)/i;

/**
 * The kanji's gloss: its first KANJIDIC meanings joined with ", " - four of them when
 * that stays within 40 characters, otherwise three.
 */
export function kanjiMeaning(meanings: string[]): string {
  const usable = meanings.filter((m) => !RADICAL_MEANING_RE.test(m));
  const list = usable.length > 0 ? usable : meanings;
  const four = list.slice(0, 4).join(', ');
  return four.length <= 40 ? four : list.slice(0, 3).join(', ');
}

/** Drops KANJIDIC prefix/suffix forms ("ひと-", "-がわ"), which aren't standalone readings. */
export function cleanKunyomi(kunyomi: string[]): string[] {
  return kunyomi.filter((k) => !k.startsWith('-') && !k.endsWith('-'));
}

export function strokeOrderLink(kanji: string): string {
  return `https://jisho.org/search/${encodeURIComponent(`${kanji}#kanji`)}`;
}

/** Most frequent first; kanji with no frequency rank last; ties by strokes, then codepoint. */
export function compareKanjiForTeaching(
  [aChar, a]: [string, SourceKanji],
  [bChar, b]: [string, SourceKanji]
): number {
  if (a.freq !== b.freq) {
    if (a.freq === null) return 1;
    if (b.freq === null) return -1;
    return a.freq - b.freq;
  }
  if (a.strokes !== b.strokes) return a.strokes - b.strokes;
  return codepointCompare(aChar, bChar);
}

/** Splits items into `parts` consecutive groups whose sizes differ by at most one (larger first). */
export function splitEvenly<T>(items: T[], parts: number): T[][] {
  const base = Math.floor(items.length / parts);
  const extra = items.length % parts;
  const groups: T[][] = [];
  let start = 0;
  for (let i = 0; i < parts; i += 1) {
    const size = base + (i < extra ? 1 : 0);
    groups.push(items.slice(start, start + size));
    start += size;
  }
  return groups;
}

const COMPOUND_LEVEL_PREFERENCE: JlptLevel[] = ['N1', 'N2', 'N3', 'N4', 'N5'];

/**
 * Up to `max` real list words written with the kanji, preferring N1 words, then N2,
 * N3, N4, N5; within a level shorter words first, then by kana. Never invented: an
 * empty result means no list word uses the kanji.
 */
export function pickCompounds(kanji: string, words: SourceWord[], max = 4): Compound[] {
  const seen = new Set<string>();
  return words
    .filter((w) => w.kanji.includes(kanji) && hasUsableGloss(w))
    .sort(
      (a, b) =>
        COMPOUND_LEVEL_PREFERENCE.indexOf(a.level) - COMPOUND_LEVEL_PREFERENCE.indexOf(b.level) ||
        a.kanji.length - b.kanji.length ||
        codepointCompare(a.kana, b.kana) ||
        a.jmdictSeq - b.jmdictSeq
    )
    .filter((w) => {
      const key = `${w.kanji}|${w.kana}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max)
    .map((w) => ({ word: w.kanji, reading: w.kana, meaning: w.meaning }));
}

/** Stable within-lesson order for vocab: by kana, then headword, then JMdict id. */
export function compareWordsByKana(a: SourceWord, b: SourceWord): number {
  return (
    codepointCompare(a.kana, b.kana) || codepointCompare(headword(a), headword(b)) || a.jmdictSeq - b.jmdictSeq
  );
}

export interface VocabAssignmentOptions {
  lessonCount: number;
  /** Most words a lesson takes before further words spill elsewhere. */
  cap: number;
}

/**
 * Lessons (1-based) for each word, in input order.
 *
 * A word goes to the lesson of the earliest-taught kanji of `kanjiLesson` it contains.
 * If that lesson is full (`cap`), it goes to the lesson of its next-earliest such kanji
 * that has room, and failing that to the least-filled lesson after its anchor (so the
 * kanji is always taught by then). Words with none of those kanji are placed last, each
 * into the least-filled lesson (ties: lowest lesson number). Words are taken in input
 * order, so callers pass them pre-sorted.
 */
export function assignVocabLessons(
  words: SourceWord[],
  kanjiLesson: Map<string, number>,
  { lessonCount, cap }: VocabAssignmentOptions
): number[] {
  const counts = new Array<number>(lessonCount + 1).fill(0);
  const result = new Array<number>(words.length).fill(0);
  const leastFilled = (from: number): number => {
    let best = from;
    for (let lesson = from + 1; lesson <= lessonCount; lesson += 1) {
      if (counts[lesson] < counts[best]) best = lesson;
    }
    return best;
  };

  const anchored: number[] = [];
  const unanchored: number[] = [];
  const candidates = words.map((word) =>
    [...new Set([...word.kanji].map((ch) => kanjiLesson.get(ch)).filter((l): l is number => l !== undefined))].sort(
      (a, b) => a - b
    )
  );
  words.forEach((_, i) => (candidates[i].length > 0 ? anchored : unanchored).push(i));

  // Fill earliest anchors first so a lesson's own words claim its room before spill-overs.
  anchored.sort((a, b) => candidates[a][0] - candidates[b][0] || a - b);
  for (const i of anchored) {
    const roomy = candidates[i].find((lesson) => counts[lesson] < cap);
    const lesson = roomy ?? leastFilled(candidates[i][0]);
    result[i] = lesson;
    counts[lesson] += 1;
  }
  for (const i of unanchored) {
    const lesson = leastFilled(1);
    result[i] = lesson;
    counts[lesson] += 1;
  }
  return result;
}

/** Groups items into `{ "1": [...], "2": [...] }` with each lesson's items in the given order. */
export function groupByLesson<T>(items: T[], lessons: number[], lessonCount: number): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (let lesson = 1; lesson <= lessonCount; lesson += 1) out[String(lesson)] = [];
  items.forEach((item, i) => out[String(lessons[i])].push(item));
  return out;
}

export function buildKanjiItem(
  kanji: string,
  source: SourceKanji,
  lesson: number,
  position: number,
  compounds: Compound[]
): BuiltKanji {
  return {
    uid: `n1-kanji-${lesson}-${position}`,
    level: 'N1',
    section: 'kanji',
    lesson,
    kanji,
    onyomi: source.onyomi,
    kunyomi: cleanKunyomi(source.kunyomi),
    meaning: kanjiMeaning(source.meanings),
    strokes: source.strokes,
    radical: source.radical,
    ...(compounds.length > 0 ? { compounds } : {}),
    strokeOrderLink: strokeOrderLink(kanji),
  };
}

export function buildVocabItem(word: SourceWord, lesson: number, position: number): BuiltVocab {
  return {
    uid: `n1-vocab-${lesson}-${position}`,
    level: 'N1',
    section: 'vocab',
    lesson,
    word: headword(word),
    reading: word.kana,
    meaning: word.meaning,
  };
}
