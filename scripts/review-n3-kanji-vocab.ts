import { readFileSync, writeFileSync } from 'node:fs';
import {
  buildCoverageIndex,
  buildSourceIndex,
  byFrequency,
  cleanKunyomi,
  cleanOnyomi,
  displayMeaning,
  isWordCovered,
  kanjiOf,
  pickCompounds,
  pickLesson,
  refreshAppendedRow,
  stripAnnotation,
  strokeOrderLink,
  type Compound,
  type SourceKanji,
  type SourceWord,
} from './lib/jlptContent';

/**
 * Brings N3 kanji and vocab in line with the JLPT N3 reference lists
 * (scripts/sources/, see its README for provenance).
 *
 *   npx tsx scripts/review-n3-kanji-vocab.ts [--dry-run]
 *
 * Kanji
 *  - Every existing N3 kanji gets its KANJIDIC meaning, stroke count and radical (the
 *    original import put the example sentence in `meaning` and left strokes 0 /
 *    radical ""), plus up to 4 compounds: N5–N3 list words first (most basic first), then the lesson's own vocab.
 *  - Slots holding a kanji already taught (a repeat inside N3, or one in our N4/N5 file)
 *    are reused in place for a missing N3-list kanji, preferring one that occurs in that
 *    lesson's vocab. Positions (and so uids) of every other item are unchanged.
 *  - Remaining missing N3-list kanji are appended: to the first lesson whose vocab uses
 *    them, else to the lesson with the fewest kanji, capped so lessons stay balanced.
 * Vocab
 *  - Every N3-list word not taught anywhere in N5–N3 is appended to the lesson of the
 *    earliest-taught N3 kanji it contains, else to the lesson with the fewest words.
 *    Existing (textbook) entries are untouched. No example sentences are invented.
 *
 * Deterministic and idempotent: a second run changes nothing.
 */

type Json = Record<string, unknown>;
type LessonFile<T> = Record<string, T[]>;
interface KanjiItem extends Json {
  uid: string;
  lesson: number;
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
}
interface VocabItem extends Json {
  uid: string;
  word: string;
  reading: string;
  meaning: string;
}

const DRY = process.argv.includes('--dry-run');
const DATA = 'grammar-app/src/data';
const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf-8')) as T;

const srcKanji = read<Record<string, SourceKanji>>('scripts/sources/jlpt-kanji.json');
const srcVocab = read<SourceWord[]>('scripts/sources/jlpt-vocab.json');

// Kanji outside the JLPT lists that the textbook lessons use: KANJIDIC values by hand.
const OFF_LIST: Record<string, Pick<SourceKanji, 'strokes' | 'radical' | 'meanings'>> = {
  謎: { strokes: 16, radical: '言 (speech)', meanings: ['riddle', 'puzzle', 'enigma'] },
};

const kanjiFile = read<LessonFile<KanjiItem>>(`${DATA}/n3/kanji.json`);
const vocabFile = read<LessonFile<VocabItem>>(`${DATA}/n3/vocab.json`);
const lessons = Object.keys(kanjiFile).map(Number).sort((a, b) => a - b);

const lowerKanji = new Set<string>();
const lowerVocab: VocabItem[] = [];
for (const lv of ['n5', 'n4']) {
  Object.values(read<LessonFile<KanjiItem>>(`${DATA}/${lv}/kanji.json`)).flat().forEach((k) => lowerKanji.add(k.kanji));
  lowerVocab.push(...Object.values(read<LessonFile<VocabItem>>(`${DATA}/${lv}/vocab.json`)).flat());
}

// ---- Kanji -----------------------------------------------------------------------

const vocabLessonsOf = (kanji: string): number[] =>
  lessons.filter((l) => (vocabFile[l] ?? []).some((v) => stripAnnotation(v.word).includes(kanji)));

const freeSlots: { lesson: number; index: number; was: string }[] = [];
const seenN3 = new Set<string>();
for (const l of lessons) {
  kanjiFile[l].forEach((item, index) => {
    if (lowerKanji.has(item.kanji) || seenN3.has(item.kanji)) freeSlots.push({ lesson: l, index, was: item.kanji });
    seenN3.add(item.kanji);
  });
}
const keptN3 = new Set(
  lessons.flatMap((l) => kanjiFile[l].filter((_, i) => !freeSlots.some((s) => s.lesson === l && s.index === i)).map((k) => k.kanji))
);
const missing = Object.entries(srcKanji)
  .filter(([k, s]) => s.level === 'N3' && !lowerKanji.has(k) && !keptN3.has(k))
  .sort(byFrequency)
  .map(([k]) => k);
const unplaced = new Set(missing);

function newKanjiItem(kanji: string, lesson: number): KanjiItem {
  const s = srcKanji[kanji];
  return {
    uid: '', level: 'N3', section: 'kanji', lesson, kanji,
    onyomi: cleanOnyomi(s.onyomi), kunyomi: cleanKunyomi(s.kunyomi), meaning: '', strokes: 0, radical: '',
  };
}

const replaced: string[] = [];
for (const slot of freeSlots) {
  const pick =
    missing.find((k) => unplaced.has(k) && vocabLessonsOf(k).includes(slot.lesson)) ??
    missing.find((k) => unplaced.has(k) && vocabLessonsOf(k).length === 0) ??
    missing.find((k) => unplaced.has(k));
  if (!pick) {
    kanjiFile[slot.lesson].splice(slot.index, 1); // nothing left to place; drop the repeat
    continue;
  }
  unplaced.delete(pick);
  kanjiFile[slot.lesson][slot.index] = newKanjiItem(pick, slot.lesson);
  replaced.push(`${slot.lesson}[${slot.index + 1}] ${slot.was} → ${pick}`);
}

const total = lessons.reduce((n, l) => n + kanjiFile[l].length, 0) + unplaced.size;
const cap = Math.ceil(total / lessons.length) + 2;
const counts = Object.fromEntries(lessons.map((l) => [l, kanjiFile[l].length]));
const appended: Record<number, string[]> = {};
for (const k of missing.filter((m) => unplaced.has(m))) {
  const l = pickLesson(counts, vocabLessonsOf(k), cap);
  counts[l] += 1;
  (appended[l] ??= []).push(k);
}
for (const l of lessons) for (const k of appended[l] ?? []) kanjiFile[l].push(newKanjiItem(k, l));

// Lesson-of-first-teaching for every N3 kanji, used for compounds and vocab placement.
const kanjiLesson = new Map<string, number>();
for (const l of lessons) for (const k of kanjiFile[l]) if (!kanjiLesson.has(k.kanji)) kanjiLesson.set(k.kanji, l);

const listCompounds = (['N5', 'N4', 'N3'] as const).flatMap((lv) =>
  srcVocab.filter((w) => w.level === lv && w.kanji).map((w): Compound => ({ word: w.kanji, reading: w.kana, meaning: w.meaning }))
);
const asCompound = (v: VocabItem): Compound => ({ word: stripAnnotation(v.word), reading: v.reading, meaning: v.meaning });

for (const l of lessons) {
  kanjiFile[l] = kanjiFile[l].map((item, i) => {
    const s = srcKanji[item.kanji] ?? OFF_LIST[item.kanji];
    const compounds = pickCompounds(item.kanji, [...listCompounds, ...(vocabFile[l] ?? []).map(asCompound)]);
    const { exampleJp, exampleEn } = item;
    return {
      uid: `n3-kanji-${l}-${i + 1}`,
      level: 'N3',
      section: 'kanji',
      lesson: l,
      kanji: item.kanji,
      onyomi: cleanOnyomi(item.onyomi),
      kunyomi: cleanKunyomi(item.kunyomi),
      meaning: displayMeaning(s.meanings),
      strokes: s.strokes,
      radical: s.radical,
      ...(exampleJp ? { exampleJp, exampleEn } : {}),
      ...(compounds.length ? { compounds } : {}),
      strokeOrderLink: strokeOrderLink(item.kanji),
    };
  });
}

// ---- Vocab -----------------------------------------------------------------------

// Rows appended earlier (no example sentence) follow the list's current spelling and gloss.
const sourceIndex = buildSourceIndex(srcVocab);
const refreshedRows: string[] = [];
for (const v of lessons.flatMap((l) => vocabFile[l] ?? [])) {
  const update = refreshAppendedRow(v as VocabItem & { level: string }, sourceIndex);
  if (!update) continue;
  refreshedRows.push(update.word === v.word ? `${v.word}【${v.reading}】(gloss)` : `${v.word}→${update.word}`);
  Object.assign(v, update);
}

const forms = buildCoverageIndex([...lowerVocab, ...lessons.flatMap((l) => vocabFile[l] ?? [])]);
const seenWord = new Set<string>();
const newWords = srcVocab.filter((w) => {
  const key = `${w.kanji}|${w.kana}`;
  if (w.level !== 'N3' || seenWord.has(key) || isWordCovered(w, forms)) return false;
  seenWord.add(key);
  return true;
});
const vocabCounts = Object.fromEntries(lessons.map((l) => [l, (vocabFile[l] ?? []).length]));
const vocabAdds: Record<number, SourceWord[]> = {};
for (const w of newWords) {
  const taught = kanjiOf(w.kanji).map((k) => kanjiLesson.get(k)).filter((l): l is number => l !== undefined);
  const l = taught.length ? Math.min(...taught) : pickLesson(vocabCounts, [], Infinity);
  vocabCounts[l] += 1;
  (vocabAdds[l] ??= []).push(w);
}
for (const l of lessons) {
  const adds = (vocabAdds[l] ?? []).sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));
  const list = (vocabFile[l] ??= []);
  for (const w of adds) {
    list.push({
      uid: `n3-vocab-${l}-${list.length + 1}`,
      level: 'N3',
      section: 'vocab',
      lesson: l,
      word: w.kanji || w.kana,
      reading: w.kana,
      meaning: w.meaning,
    });
  }
}

// Earlier source snapshots had blank glosses for a few words; refill them.
const glossOf = new Map(srcVocab.map((w) => [`${w.kanji || w.kana}|${w.kana}`, w.meaning]));
let refilled = 0;
for (const l of lessons) {
  for (const v of vocabFile[l]) {
    const gloss = glossOf.get(`${v.word}|${v.reading}`);
    if (!v.meaning.trim() && gloss) { v.meaning = gloss; refilled += 1; }
  }
}

// ---- Report + write --------------------------------------------------------------

const kCounts = lessons.map((l) => kanjiFile[l].length);
const vCounts = lessons.map((l) => vocabFile[l].length);
console.log(`kanji: ${replaced.length} repeats replaced, ${missing.length - replaced.length} appended`);
replaced.forEach((r) => console.log(`  replaced ${r}`));
console.log(`kanji per lesson ${Math.min(...kCounts)}–${Math.max(...kCounts)}, total ${kCounts.reduce((a, b) => a + b, 0)}`);
console.log(`appended rows refreshed from the list: ${refreshedRows.length} ${refreshedRows.join(' ')}`);
console.log(`vocab: ${newWords.length} N3-list words appended, ${refilled} blank glosses refilled; per lesson ${Math.min(...vCounts)}–${Math.max(...vCounts)}, total ${vCounts.reduce((a, b) => a + b, 0)}`);
const offList = lessons.flatMap((l) => kanjiFile[l]).filter((k) => srcKanji[k.kanji]?.level !== 'N3').map((k) => `${k.kanji}(${srcKanji[k.kanji]?.level ?? '—'})`);
console.log(`kept non-N3-list kanji (textbook context): ${offList.length} ${offList.join(' ')}`);

if (!DRY) {
  writeFileSync(`${DATA}/n3/kanji.json`, `${JSON.stringify(kanjiFile, null, 2)}\n`);
  writeFileSync(`${DATA}/n3/vocab.json`, `${JSON.stringify(vocabFile, null, 2)}\n`);
}
