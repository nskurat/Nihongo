import { enTokens, phraseText } from '../english';
import { grammarPatternKeys } from '../keys/grammarKeys';
import { kanjiReadingKeys } from '../keys/kanjiReadingKeys';
import { defaultClassOf } from '../keys/wordClass';
import { foldLong, isKana, kanjiChars, key } from '../normalize';
import type { GrammarShard, KanjiShard, ShardFile, VocabExtra, VocabShard } from '../shard';
import type { DocType, Level, SearchDocument } from '../types';

/**
 * In-memory document: display fields plus every search key, rebuilt from a shard row.
 * `toSearchDocument` gives the logical shape of the data contract (§1.1).
 */
export interface Doc {
  uid: string;
  type: DocType;
  level: Level;
  lesson: number;
  /** Position inside the lesson (last uid segment), the final tie-break. */
  pos: number;
  title: string;
  reading?: string;
  meaning: string;
  onyomi?: string[];
  kunyomi?: string[];
  structure?: string;
  tags?: string[];
  surface: string[];
  readings: string[];
  /** Kanji kun stems (まよ for まよ・う): exact, but not under the single-kana guard. */
  stems: string[];
  lemma: string[];
  alias: string[];
  hint: string[];
  /** Grammar structure keys (tier 7). */
  structureKeys: string[];
  /** Kanji compounds that are not vocab rows (tier 7). */
  compounds: string[];
  en: string[];
  summaryEn: string[];
  /** ` word word ` lower-case meaning, for English phrase matching. */
  phrase: string;
  dupKey?: string;
  /** Vocab word-class set (keys/wordClass.ts); '' for grammar and kanji. */
  cls: string;
  /** Grammar keys allowed to match inside a longer query. */
  patternKeys: string[];
}

function parseUid(uid: string): { level: Level; type: DocType; lesson: number; pos: number } {
  const [lv, type, lesson, pos] = uid.split('-');
  return { level: lv.toUpperCase() as Level, type: type as DocType, lesson: Number(lesson), pos: Number(pos) };
}

const uniq = (xs: string[]): string[] => [...new Set(xs.filter(Boolean))];

export function decodeShard(shard: ShardFile): Doc[] {
  switch (shard.shard) {
    case 'grammar':
      return decodeGrammar(shard);
    case 'kanji':
      return decodeKanji(shard);
    default:
      return decodeVocab(shard);
  }
}

function decodeGrammar(shard: GrammarShard): Doc[] {
  return shard.docs.map(([uid, title, meaning, tagIdx, structure, titleKeys, structureKeys, summary]) => ({
    uid,
    ...parseUid(uid),
    title,
    meaning,
    structure: structure || undefined,
    tags: tagIdx.map((i) => shard.tags[i]),
    surface: titleKeys,
    readings: [],
    stems: [],
    lemma: [],
    alias: [],
    hint: [],
    structureKeys,
    compounds: [],
    en: enTokens(meaning),
    summaryEn: summary ? summary.split(' ') : [],
    phrase: phraseText(meaning),
    cls: '',
    patternKeys: grammarPatternKeys(title),
  }));
}

function decodeVocab(shard: VocabShard): Doc[] {
  return shard.docs.map((row) => {
    const [uid, word, reading, meaning] = row;
    const x: VocabExtra = row[4] ?? {};
    const surface = x.s ?? uniq([key(word)]);
    const readings = x.r ?? uniq([key(reading)]);
    return {
      uid,
      ...parseUid(uid),
      title: word,
      reading,
      meaning,
      surface,
      readings,
      stems: [],
      lemma: x.l ?? [],
      alias: x.a ?? [],
      hint: x.h ?? [],
      structureKeys: [],
      compounds: [],
      en: enTokens(meaning),
      summaryEn: [],
      phrase: phraseText(meaning),
      dupKey: `${surface[0] ?? ''}|${readings[0] ?? ''}`,
      cls: x.c ?? defaultClassOf(surface, readings),
      patternKeys: [],
    };
  });
}

function decodeKanji(shard: KanjiShard): Doc[] {
  return shard.docs.map((row) => {
    const [uid, kanji, meaning, onyomi, kunyomi] = row;
    const readings: string[] = [];
    const stems: string[] = [];
    for (const r of [...onyomi, ...kunyomi]) {
      const k = kanjiReadingKeys(r);
      if (!k) continue;
      readings.push(k.full);
      if (k.stem) stems.push(k.stem);
    }
    return {
      uid,
      ...parseUid(uid),
      title: kanji,
      meaning,
      onyomi,
      kunyomi,
      surface: [kanji],
      readings: uniq(readings),
      stems: uniq(stems).filter((s) => !readings.includes(s)),
      lemma: [],
      alias: [],
      hint: [],
      structureKeys: [],
      compounds: row[5] ?? [],
      en: enTokens(meaning),
      summaryEn: [],
      phrase: phraseText(meaning),
      cls: '',
      patternKeys: [],
    };
  });
}

/** Readings that take part in the long-vowel-folded tier. */
export function foldableReadings(d: Doc): string[] {
  if (d.type === 'grammar') return [];
  return uniq([...d.readings, ...d.lemma.filter(isKana)]);
}

/** The logical `SearchDocument` (data contract, §1.1) of an in-memory doc. */
export function toSearchDocument(d: Doc): SearchDocument {
  const doc: SearchDocument = {
    uid: d.uid,
    type: d.type,
    level: d.level,
    lesson: d.lesson,
    title: d.title,
    meaning: d.meaning,
    keys: {
      surface: d.surface,
      reading: uniq([...d.readings, ...d.stems]),
      lemma: d.lemma,
      alias: d.alias,
      hint: uniq([...d.hint, ...d.structureKeys, ...d.compounds]),
      folded: uniq(foldableReadings(d).map(foldLong)),
      en: uniq([...d.en, ...d.summaryEn]),
    },
  };
  if (d.reading !== undefined) doc.reading = d.reading;
  if (d.onyomi) doc.onyomi = d.onyomi;
  if (d.kunyomi) doc.kunyomi = d.kunyomi;
  if (d.structure) doc.structure = d.structure;
  if (d.tags) doc.tags = d.tags;
  if (d.type === 'vocab') doc.keys.kanjiChars = kanjiChars(d.surface.join(''));
  if (d.dupKey) doc.dupKey = d.dupKey;
  return doc;
}
