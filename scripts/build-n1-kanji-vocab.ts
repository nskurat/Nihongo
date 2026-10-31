import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type ExistingVocab,
  type SourceKanji,
  type SourceWord,
  assignVocabLessons,
  buildCoveredWordIndex,
  buildKanjiItem,
  buildVocabItem,
  compareKanjiForTeaching,
  compareWordsByKana,
  groupByLesson,
  hasUsableGloss,
  headword,
  isWordCovered,
  pickCompounds,
  splitEvenly,
} from './lib/n1-kanji-vocab';

/**
 * Generates grammar-app/src/data/n1/kanji.json and vocab.json from the vendored
 * JLPT lists in scripts/sources/ (Waller's N1 lists, KANJIDIC, JMdict). Offline and
 * deterministic: rerunning it on unchanged inputs rewrites identical files.
 *
 *   npx tsx scripts/build-n1-kanji-vocab.ts [--dry-run]
 *
 * Coverage: our study path is cumulative, so every N1-list kanji/word that our
 * N5/N4/N3 kanji or vocab files already teach is skipped (and listed in the output).
 * Rerun after any change to those files.
 *
 * Distribution over N1's 32 lessons:
 *  - kanji by frequency rank (no rank last; ties by strokes, then codepoint), split evenly;
 *  - each word goes to the lesson of the earliest-taught N1 kanji it contains, capped at
 *    VOCAB_CAP_FACTOR x the average so frequent early kanji don't swallow the list
 *    (overflow goes to the word's next N1 kanji's lesson, else the emptiest later lesson);
 *    words without an N1 kanji fill the emptiest lessons. Within a lesson, by kana.
 *
 * Vocab rows carry no example sentences: the lists have none and we don't invent them.
 */

const N1_LESSONS = 32; // grammar-app/src/utils/levels.ts LESSON_RANGES.N1
const VOCAB_CAP_FACTOR = 1.25;
const DATA = 'grammar-app/src/data';
const LOWER_LEVELS = ['n5', 'n4', 'n3'];

const dryRun = process.argv.includes('--dry-run');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(path), 'utf8')) as T;

const sourceKanji = readJson<Record<string, SourceKanji>>('scripts/sources/jlpt-kanji.json');
const sourceWords = readJson<SourceWord[]>('scripts/sources/jlpt-vocab.json');

const lowerKanji = new Set<string>();
const lowerVocab: ExistingVocab[] = [];
for (const level of LOWER_LEVELS) {
  for (const items of Object.values(readJson<Record<string, Array<{ kanji: string }>>>(`${DATA}/${level}/kanji.json`))) {
    items.forEach((item) => lowerKanji.add(item.kanji));
  }
  for (const items of Object.values(readJson<Record<string, ExistingVocab[]>>(`${DATA}/${level}/vocab.json`))) {
    lowerVocab.push(...items);
  }
}

// ---- kanji ----
const n1KanjiAll = Object.entries(sourceKanji).filter(([, k]) => k.level === 'N1');
const skippedKanji = n1KanjiAll.filter(([ch]) => lowerKanji.has(ch)).map(([ch]) => ch);
const teachKanji = n1KanjiAll.filter(([ch]) => !lowerKanji.has(ch)).sort(compareKanjiForTeaching);

const kanjiGroups = splitEvenly(teachKanji, N1_LESSONS);
const kanjiLesson = new Map<string, number>();
const kanjiOut: Record<string, ReturnType<typeof buildKanjiItem>[]> = {};
let noCompounds = 0;
kanjiGroups.forEach((group, i) => {
  const lesson = i + 1;
  kanjiOut[String(lesson)] = group.map(([ch, source], j) => {
    kanjiLesson.set(ch, lesson);
    const compounds = pickCompounds(ch, sourceWords);
    if (compounds.length === 0) noCompounds += 1;
    return buildKanjiItem(ch, source, lesson, j + 1, compounds);
  });
});

// ---- vocab ----
const coveredIndex = buildCoveredWordIndex(lowerVocab);
const seenWords = new Set<string>();
const n1Words: SourceWord[] = [];
const skippedWords: SourceWord[] = [];
const noGloss: SourceWord[] = [];
let duplicateWords = 0;
for (const word of sourceWords.filter((w) => w.level === 'N1').sort(compareWordsByKana)) {
  const key = `${headword(word)}|${word.kana}`;
  if (seenWords.has(key)) {
    duplicateWords += 1;
    continue;
  }
  seenWords.add(key);
  if (!hasUsableGloss(word)) {
    noGloss.push(word);
    continue;
  }
  (isWordCovered(word, coveredIndex) ? skippedWords : n1Words).push(word);
}

const cap = Math.ceil((n1Words.length / N1_LESSONS) * VOCAB_CAP_FACTOR);
const wordLessons = assignVocabLessons(n1Words, kanjiLesson, { lessonCount: N1_LESSONS, cap });
const grouped = groupByLesson(n1Words, wordLessons, N1_LESSONS);
const vocabOut: Record<string, ReturnType<typeof buildVocabItem>[]> = {};
for (const [lesson, words] of Object.entries(grouped)) {
  vocabOut[lesson] = words.map((word, j) => buildVocabItem(word, Number(lesson), j + 1));
}

// ---- report ----
const sizes = (out: Record<string, unknown[]>) => Object.values(out).map((items) => items.length);
const kanjiSizes = sizes(kanjiOut);
const vocabSizes = sizes(vocabOut);
console.log(`N1 kanji: ${teachKanji.length} of ${n1KanjiAll.length} (${skippedKanji.length} already in N5-N3 files)`);
console.log(`  per lesson ${Math.min(...kanjiSizes)}-${Math.max(...kanjiSizes)}; ${noCompounds} with no list word as a compound`);
console.log(`  skipped: ${skippedKanji.join(' ') || '(none)'}`);
console.log(
  `N1 vocab: ${n1Words.length} (${skippedWords.length} already in N5-N3 files, ${duplicateWords} duplicate list rows)`
);
console.log(`  per lesson ${Math.min(...vocabSizes)}-${Math.max(...vocabSizes)} (cap ${cap}): ${vocabSizes.join(' ')}`);
console.log(`  skipped: ${skippedWords.map(headword).join(' ') || '(none)'}`);
console.log(`  dropped (no usable gloss in the list): ${noGloss.map((w) => `${headword(w)}【${w.kana}】`).join(' ') || '(none)'}`);

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  writeFileSync(resolve(`${DATA}/n1/kanji.json`), `${JSON.stringify(kanjiOut, null, 2)}\n`);
  writeFileSync(resolve(`${DATA}/n1/vocab.json`), `${JSON.stringify(vocabOut, null, 2)}\n`);
  console.log(`\nWrote ${DATA}/n1/kanji.json and ${DATA}/n1/vocab.json.`);
}
