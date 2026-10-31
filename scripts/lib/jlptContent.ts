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
  /** Waller's own spelling when fetch-jlpt-sources.ts replaced a rare one (何時も → いつも). */
  listKanji?: string;
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

/** KANJIDIC lists a radical's own name as a meaning ("branch radical (no. 65)"); not a gloss. */
export const RADICAL_MEANING_RE = /radical \(no\.\s*\d+\)/i;

/** KANJIDIC meanings → the short display meaning used across the app (radical names dropped). */
export function displayMeaning(meanings: string[], max = 4): string {
  const usable = meanings.filter((m) => !RADICAL_MEANING_RE.test(m));
  return (usable.length > 0 ? usable : meanings).slice(0, max).join(', ');
}

const isAffix = (r: string): boolean => r.startsWith('-') || r.endsWith('-');

/**
 * Kunyomi as shown on a card: okurigana marked with "・" (KANJIDIC and our older
 * textbook rows use "."), prefix/suffix forms ("-び", "こ-") dropped, and KANJIDIC's
 * katakana unit readings (粉 デシメートル, 志 シリング) dropped. Order kept, no repeats.
 */
export function cleanKunyomi(kunyomi: string[]): string[] {
  const out: string[] = [];
  for (const raw of kunyomi) {
    const r = raw.replace(/\./g, '・');
    if (isAffix(r) || !/^[ぁ-ゖー]+(・[ぁ-ゖー]+)?$/.test(r) || out.includes(r)) continue;
    out.push(r);
  }
  return out;
}

/** Onyomi as shown on a card: suffix-only forms (応 "-ノウ", 縁 "-ネン") dropped. */
export function cleanOnyomi(onyomi: string[]): string[] {
  return onyomi.filter((r) => !isAffix(r));
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

const GLOSS_STOPWORDS = new Set(
  ('to a an the be is are of in on at for or and as with by it its one ones e g eg ie esp etc ' +
    'something oneself thing things person people used uk adv int conj abbr hon hum ' +
    'polite humble honorific expression form word fam col vulg same equivalent').split(' ')
);

function glossTokens(gloss: string): string[] {
  const text = gloss.toLowerCase().replace(/\[[^\]]*\]/g, ' ');
  return (text.match(/[a-z]+/g) ?? []).filter((t) => t.length > 1 && !GLOSS_STOPWORDS.has(t));
}

const sameStem = (a: string, b: string): boolean => {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short)) return true; // drown/drowned, mere/merely
  let i = 0;
  while (i < short.length && short[i] === long[i]) i += 1;
  return i >= 5 || (i >= 4 && short.length >= 6); // injure/injury, someone/somebody
};

/**
 * Whether two English glosses plausibly describe the same word: they share a content
 * word (stopwords and [usage notes] ignored, simple stem match). Used to tell a kana
 * spelling of the same word (其れ / それ "that") from a homophone (肺 / はい "yes").
 */
export function glossesOverlap(a: string, b: string): boolean {
  const tb = glossTokens(b);
  return glossTokens(a).some((x) => tb.some((y) => sameStem(x, y)));
}

const GODAN_MASU: Record<string, string> = {
  う: 'います', く: 'きます', ぐ: 'ぎます', す: 'します', つ: 'ちます',
  ぬ: 'にます', ぶ: 'びます', む: 'みます', る: 'ります',
};

/**
 * Possible polite (-ます) forms of a dictionary-form verb, as our N5/N4 textbook rows
 * write verbs (書く → 書きます; 見る → 見ます or 見ります, since the verb class is unknown).
 */
export function masuForms(word: string): string[] {
  if (word === '来る' || word === 'くる') return [word === 'くる' ? 'きます' : '来ます'];
  if (word.endsWith('する')) return [`${word.slice(0, -2)}します`];
  const stem = word.slice(0, -1);
  const last = word.slice(-1);
  if (!stem || !GODAN_MASU[last]) return [];
  return last === 'る' ? [`${stem}ます`, `${stem}ります`] : [`${stem}${GODAN_MASU[last]}`];
}

/** What a coverage check needs to know about the rows already taught. */
export interface CoverageIndex {
  /** Every written form (annotations stripped, "／" pairs split). */
  forms: Set<string>;
  /** Glosses of the rows written in kana only, by that kana form. */
  kanaGlosses: Map<string, string[]>;
}

export function buildCoverageIndex(rows: { word: string; meaning?: string }[]): CoverageIndex {
  const forms = new Set<string>();
  const kanaGlosses = new Map<string, string[]>();
  for (const row of rows) {
    const rowForms = stripAnnotation(row.word).split(/[／/]/).map((f) => f.replace(/[〜～\s。]/g, '')).filter(Boolean);
    for (const form of rowForms) {
      forms.add(form);
      if (!/\p{Script=Han}/u.test(form)) kanaGlosses.set(form, [...(kanaGlosses.get(form) ?? []), row.meaning ?? '']);
    }
  }
  return { forms, kanaGlosses };
}

/**
 * Whether a list word is already taught somewhere: its written form appears (also as
 * a textbook -ます form), or it is a kanji spelling of a word we write in kana — same
 * reading and an overlapping gloss (其れ = それ, but 肺 ≠ はい "yes").
 */
export function isWordCovered(word: SourceWord, index: CoverageIndex): boolean {
  const head = word.kanji || word.kana;
  if (index.forms.has(head) || masuForms(head).some((f) => index.forms.has(f))) return true;
  if (!word.kanji) return false;
  return (index.kanaGlosses.get(word.kana) ?? []).some((g) => glossesOverlap(g, word.meaning));
}

/** Frequency order: most frequent first, unranked last, then strokes, then codepoint. */
export function byFrequency(a: [string, SourceKanji], b: [string, SourceKanji]): number {
  const fa = a[1].freq ?? Number.MAX_SAFE_INTEGER;
  const fb = b[1].freq ?? Number.MAX_SAFE_INTEGER;
  return fa - fb || a[1].strokes - b[1].strokes || a[0].codePointAt(0)! - b[0].codePointAt(0)!;
}

/** List words by level + headword + kana, and also under Waller's original spelling. */
export function buildSourceIndex(words: SourceWord[]): Map<string, SourceWord> {
  const index = new Map<string, SourceWord>();
  const add = (key: string, w: SourceWord) => {
    if (!index.has(key)) index.set(key, w);
  };
  for (const w of words) add(`${w.level}|${w.kanji || w.kana}|${w.kana}`, w);
  for (const w of words) if (w.listKanji) add(`${w.level}|${w.listKanji}|${w.kana}`, w);
  return index;
}

/**
 * Rows our scripts appended (they carry no example sentence) are copies of a list word,
 * so they follow the list's current spelling and gloss; uid and lesson stay put. Returns
 * the new word/meaning, or null when the row is textbook content or already current.
 */
export function refreshAppendedRow(
  row: { level: string; word: string; reading: string; meaning: string; exampleJp?: unknown },
  index: Map<string, SourceWord>
): { word: string; meaning: string } | null {
  if (row.exampleJp) return null;
  const w = index.get(`${row.level}|${row.word}|${row.reading}`);
  if (!w) return null;
  const word = w.kanji || w.kana;
  return word === row.word && w.meaning === row.meaning ? null : { word, meaning: w.meaning };
}

/** "year end," / ",for (10 days),next (year)" → comma-separated with no empty parts. */
export function tidyGloss(gloss: string): string {
  return gloss
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}
