import type { Pos } from './vocabPos';
import { glossesOverlap, glossTokens, stripAnnotation } from './jlptContent';

/**
 * JMdict part-of-speech tags → the closed vocab `pos` set (scripts/lib/vocabPos.ts).
 * Pure; used by scripts/fetch-jmdict-pos.ts (description → code) and
 * scripts/fill-vocab-pos.ts (code → Pos, row → JMdict entries). Never guesses: a tag it
 * has no closed-set value for (auxiliary, archaic verb classes …) yields null and
 * the row is reported instead of labelled.
 */

/** One trimmed JMdict entry as vendored in scripts/sources/jmdict-pos.json. */
export interface JmdictEntry {
  seq: number;
  /** Kanji spellings. */
  k: string[];
  /** Kana readings. */
  r: string[];
  /** Senses in JMdict order: tag codes (inherited from the previous sense when JMdict leaves them out) and glosses. */
  s: { p: string[]; g: string }[];
}

/**
 * JMdict's entity descriptions (as jamdict stores them) → the entity codes JMdict and
 * jmdict-simplified use. Archaic yodan/nidan verb classes collapse to `v4` / `v2`.
 */
const DESCRIPTION_CODES: Record<string, string> = {
  'noun (common) (futsuumeishi)': 'n',
  'noun or participle which takes the aux. verb suru': 'vs',
  'expressions (phrases, clauses, etc.)': 'exp',
  "nouns which may take the genitive case particle 'no'": 'adj-no',
  'adjectival nouns or quasi-adjectives (keiyodoshi)': 'adj-na',
  'transitive verb': 'vt',
  'intransitive verb': 'vi',
  'Ichidan verb': 'v1',
  'Ichidan verb - kureru special class': 'v1-s',
  'Ichidan verb - zuru verb (alternative form of -jiru verbs)': 'vz',
  'adverb (fukushi)': 'adv',
  "adverb taking the 'to' particle": 'adv-to',
  "Godan verb with 'ru' ending": 'v5r',
  "Godan verb with 'ru' ending (irregular verb)": 'v5r-i',
  "Godan verb with 'su' ending": 'v5s',
  "Godan verb with 'ku' ending": 'v5k',
  'Godan verb - Iku/Yuku special class': 'v5k-s',
  "Godan verb with 'u' ending": 'v5u',
  "Godan verb with 'u' ending (special class)": 'v5u-s',
  "Godan verb with 'mu' ending": 'v5m',
  "Godan verb with 'tsu' ending": 'v5t',
  "Godan verb with 'gu' ending": 'v5g',
  "Godan verb with 'bu' ending": 'v5b',
  "Godan verb with 'nu' ending": 'v5n',
  'Godan verb - -aru special class': 'v5aru',
  'suru verb - special class': 'vs-s',
  'suru verb - included': 'vs-i',
  'su verb - precursor to the modern suru': 'vs-c',
  'Kuru verb - special class': 'vk',
  'irregular ru verb, plain form ends with -ri': 'vr',
  'irregular nu verb': 'vn',
  'verb unspecified': 'v-unspec',
  'adjective (keiyoushi)': 'adj-i',
  'adjective (keiyoushi) - yoi/ii class': 'adj-ix',
  "'ku' adjective (archaic)": 'adj-ku',
  "'shiku' adjective (archaic)": 'adj-shiku',
  'archaic/formal form of na-adjective': 'adj-nari',
  "'taru' adjective": 'adj-t',
  'noun or verb acting prenominally': 'adj-f',
  'pre-noun adjectival (rentaishi)': 'adj-pn',
  'noun, used as a suffix': 'n-suf',
  'noun, used as a prefix': 'n-pref',
  'interjection (kandoushi)': 'int',
  suffix: 'suf',
  prefix: 'pref',
  pronoun: 'pn',
  counter: 'ctr',
  particle: 'prt',
  conjunction: 'conj',
  'auxiliary verb': 'aux-v',
  'auxiliary adjective': 'aux-adj',
  auxiliary: 'aux',
  copula: 'cop',
  numeric: 'num',
  unclassified: 'unc',
};

/** A jamdict pos description → its JMdict code. Throws on one it doesn't know. */
export function posCode(description: string): string {
  const code = DESCRIPTION_CODES[description];
  if (code) return code;
  if (/^Yodan verb .*\(archaic\)$/.test(description)) return 'v4';
  if (/^Nidan verb .*\(archaic\)$/.test(description)) return 'v2';
  throw new Error(`unknown JMdict pos "${description}"`);
}

const ICHIDAN = new Set(['v1', 'v1-s']);
const IRREGULAR = new Set(['vs-i', 'vs-s', 'vk']);
const GODAN = /^v5/;

/**
 * One sense's tags → a closed-set value, or null when JMdict says something the set has no
 * word for. Precedence follows how the N5/N4 rows are labelled: a conjugating class wins
 * (verb, i-adjective), then determiner, function words, expression, interjection,
 * na-adjective, noun, adverb, suffix.
 * `vs` alone (勉強 n+vs) stays a noun: the closed set labels the noun, not 勉強する.
 */
export function mapSenseTags(tags: readonly string[]): Pos | null {
  const has = (t: string) => tags.includes(t);
  if (tags.some((t) => GODAN.test(t))) return 'verb-godan';
  if (tags.some((t) => ICHIDAN.has(t))) return 'verb-ichidan';
  if (tags.some((t) => IRREGULAR.has(t))) return 'verb-irregular';
  // Archaic / unclassified verb classes and auxiliaries: no honest closed-set value.
  if (tags.some((t) => t === 'vz' || t === 'vn' || t === 'vr' || t === 'vs-c' || t === 'v-unspec' || t === 'v2' || t === 'v4'))
    return null;
  if (has('adj-i') || has('adj-ix')) return 'i-adjective';
  if (has('adj-pn')) return 'determiner';
  if (has('pn')) return 'pronoun';
  if (has('prt')) return 'particle';
  if (has('conj')) return 'conjunction';
  if (has('exp')) return 'expression';
  if (has('int')) return 'interjection';
  // Content words JMdict tags several ways (元気 adj-na+n, 今日 n+adv): a na-adjective
  // before a noun before an adverb — the order that best reproduces the hand-labelled N5/N4
  // rows (tag order in the source is not reliable).
  if (has('adj-na')) return 'na-adjective';
  if (has('n') || has('adj-no') || has('num')) return 'noun';
  if (has('adv') || has('adv-to')) return 'adverb';
  // ゆっくり adv+vs is an adverb; a bare `vs` (rare) is the noun of a する verb.
  if (has('vs')) return 'noun';
  if (has('suf') || has('n-suf') || has('ctr')) return 'suffix';
  // 再, 超, 不: bound forms that attach to a following word (再開発, 超特急, 不便).
  if (has('pref') || has('n-pref')) return 'prefix';
  return null;
}

/**
 * Question words. JMdict tags them as pronouns, adverbs or nouns (誰 pn, どうして adv,
 * 何時 n); the closed set, like the N5/N4 rows, gives them their own value.
 */
export const INTERROGATIVES: ReadonlySet<string> = new Set([
  '誰', 'だれ', 'どなた', '何', 'なに', 'なん', 'どこ', '何処', 'どちら', 'どっち', 'どれ', 'どの', 'どんな',
  'いつ', '何時', 'いくつ', '幾つ', 'いくら', '幾ら', 'どう', 'どうして', 'なぜ', '何故', 'いかが', '如何',
  'どのくらい', 'どれくらい', 'どのように', 'どうやって', '何歳', '何曜日', '何人', '何で', 'なんで',
]);

const QUESTION_GLOSS = /^(what|who|whom|whose|where|when|which|why|how)\b/i;

const kataToHira = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** A vocab row's head word / reading for dictionary lookup: annotations, 〜 and trailing punctuation removed. */
export function lookupForm(text: string): string {
  return stripAnnotation(text).replace(/[〜～~]/g, '').replace(/[。、！？…]+$/u, '').trim();
}

/** Index of entries by written form (kanji spellings and readings) for row lookup. */
export interface EntryIndex {
  bySeq: Map<number, JmdictEntry>;
  byForm: Map<string, JmdictEntry[]>;
}

export function indexEntries(entries: readonly JmdictEntry[]): EntryIndex {
  const bySeq = new Map<number, JmdictEntry>();
  const byForm = new Map<string, JmdictEntry[]>();
  const add = (form: string, e: JmdictEntry) => {
    const key = kataToHira(form);
    const list = byForm.get(key) ?? [];
    if (!list.includes(e)) list.push(e);
    byForm.set(key, list);
  };
  for (const e of entries) {
    bySeq.set(e.seq, e);
    for (const f of [...e.k, ...e.r]) add(f, e);
  }
  return { bySeq, byForm };
}

/**
 * Entries one word part (with its reading) can be: a kanji spelling whose entry has the
 * reading, or a kana word whose entry has it as a reading. `seqs` (from the vendored JLPT
 * list, which keys each list word to its JMdict entry) narrows the choice when one of them
 * fits.
 */
export function candidateEntries(word: string, reading: string, index: EntryIndex, seqs: readonly number[] = []): JmdictEntry[] {
  const w = lookupForm(word);
  const r = kataToHira(lookupForm(reading));
  if (!w) return [];
  const fits = (index.byForm.get(kataToHira(w)) ?? []).filter((e) =>
    e.r.some((x) => kataToHira(x) === r) || (!r && e.r.some((x) => kataToHira(x) === kataToHira(w))),
  );
  const listed = fits.filter((e) => seqs.includes(e.seq));
  if (listed.length) return listed;
  const bySeq = seqs.map((s) => index.bySeq.get(s)).filter((e): e is JmdictEntry => !!e);
  // A list seq whose entry spells the word differently (respelled 何時も → いつも) still names the entry.
  if (!fits.length && bySeq.length) return bySeq;
  return fits;
}

/**
 * The sense a row teaches: the first whose glosses share a content word with the row's
 * meaning (吹く "to play (a wind instrument)" is sense 3), else the first sense. A shared
 * whole word beats a shared stem, so キロ "Kilogram" is the noun sense "kilogram", not the
 * prefix sense "kilo-".
 */
export function chooseSense(entry: JmdictEntry, meaning: string): JmdictEntry['s'][number] | undefined {
  const words = new Set(glossTokens(meaning));
  return (
    entry.s.find((s) => glossTokens(s.g).some((t) => words.has(t))) ??
    entry.s.find((s) => glossesOverlap(s.g, meaning)) ??
    entry.s[0]
  );
}

export type PosMatch =
  | { status: 'matched'; pos: string; seqs: number[] }
  | { status: 'ambiguous'; options: Pos[]; seqs: number[] }
  | { status: 'unmatched'; reason: string; seqs: number[] };

const DERIVED: { ending: string; tag: string; pos: Pos }[] = [
  { ending: 'する', tag: 'vs', pos: 'verb-irregular' },
  { ending: 'な', tag: 'adj-na', pos: 'na-adjective' },
];

/** X-する whose X JMdict tags `vs`, X-な whose X it tags `adj-na` (in any sense). */
function derivedForm(head: string, reading: string, index: EntryIndex): PosMatch | null {
  for (const { ending, tag, pos } of DERIVED) {
    if (!head.endsWith(ending) || head.length <= ending.length || !reading.endsWith(ending)) continue;
    const stems = candidateEntries(head.slice(0, -ending.length), reading.slice(0, -ending.length), index);
    const tagged = stems.filter((e) => e.s.some((s) => s.p.includes(tag)));
    if (tagged.length) return { status: 'matched', pos, seqs: tagged.map((e) => e.seq) };
  }
  return null;
}

/** One word part (no ／) → its closed-set value. */
export function matchPart(word: string, reading: string, meaning: string, index: EntryIndex, seqs: readonly number[] = []): PosMatch {
  const head = lookupForm(word);
  if (INTERROGATIVES.has(head) && QUESTION_GLOSS.test(meaning.trim())) return { status: 'matched', pos: 'interrogative', seqs: [] };
  let entries = candidateEntries(word, reading, index, seqs);
  // 帰国する / 温暖な: JMdict lists the noun with a `vs` tag, the na-adjective with `adj-na`,
  // not the する verb or the な form.
  if (!entries.length) {
    const derived = derivedForm(head, lookupForm(reading), index);
    if (derived) return derived;
  }
  // Homographs (かける "to hang" / 掛ける / 駆ける): keep the entries whose glosses fit the row.
  const fitting = entries.filter((e) => e.s.some((s) => glossesOverlap(s.g, meaning)));
  if (fitting.length) entries = fitting;
  const ids = entries.map((e) => e.seq);
  if (!entries.length) return { status: 'unmatched', reason: 'no JMdict entry', seqs: ids };
  const values = new Set<Pos>();
  const unmapped: string[] = [];
  for (const e of entries) {
    const sense = chooseSense(e, meaning);
    const pos = sense ? mapSenseTags(sense.p) : null;
    if (pos) values.add(pos);
    else unmapped.push(sense ? sense.p.join(',') || '(none)' : '(no sense)');
  }
  if (values.size === 1) return { status: 'matched', pos: [...values][0], seqs: ids };
  if (values.size > 1) return { status: 'ambiguous', options: [...values].sort(), seqs: ids };
  return { status: 'unmatched', reason: `tags ${[...new Set(unmapped)].join(' | ')}`, seqs: ids };
}

/**
 * A row (／ pairs split part by part, as N5/N4 store them) → its `pos` value joined with
 * ` / `, collapsed to one value when every part agrees. Any part ambiguous or unmatched
 * makes the whole row so.
 */
export function matchRow(
  row: { word: string; reading: string; meaning: string },
  index: EntryIndex,
  seqsFor: (word: string, reading: string) => readonly number[] = () => [],
): PosMatch {
  const words = row.word.split('／');
  const readings = row.reading.split('／');
  const parts = words.map((w, i) => {
    const r = readings.length === words.length ? readings[i] : readings[0];
    return matchPart(w, r, row.meaning, index, seqsFor(lookupForm(w), lookupForm(r)));
  });
  const seqs = parts.flatMap((p) => p.seqs);
  const bad = parts.find((p) => p.status !== 'matched');
  if (bad) return { ...bad, seqs };
  const values = parts.map((p) => (p as Extract<PosMatch, { status: 'matched' }>).pos);
  const pos = values.every((v) => v === values[0]) ? values[0] : values.join(' / ');
  return { status: 'matched', pos, seqs };
}
