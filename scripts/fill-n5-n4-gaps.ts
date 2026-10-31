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
 * Adds the N5- and N4-list kanji and words (scripts/sources/) that no N5–N3 file teaches.
 *
 *   npx tsx scripts/fill-n5-n4-gaps.ts [--dry-run]
 *
 * Existing items are never moved or renumbered — new ones are appended to a lesson, so
 * every uid stays put. Placement mirrors the N3 review:
 *  - kanji → the first lesson of its level whose vocab uses it, else the lesson with the
 *    fewest kanji (capped so lessons stay balanced);
 *  - words → the lesson that teaches their earliest kanji at that level, else the lesson
 *    with the fewest words.
 * Also fills `null` compound readings/meanings in existing kanji where the compound is a
 * list word, normalises existing kanji readings (kun okurigana as "・", no prefix/suffix
 * forms), and keeps previously appended words in step with the list's spelling and gloss
 * (uids unchanged). No example sentences are invented. Deterministic and idempotent.
 */

type Level = 'N5' | 'N4';
type Json = Record<string, unknown>;
interface KanjiItem extends Json {
  kanji: string;
  compounds?: { word: string; reading: string | null; meaning: string | null }[];
}
interface VocabItem extends Json {
  word: string;
  reading: string;
  meaning: string;
}
type LessonFile<T> = Record<string, T[]>;

const DRY = process.argv.includes('--dry-run');
const DATA = 'grammar-app/src/data';
const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf-8')) as T;
const srcKanji = read<Record<string, SourceKanji>>('scripts/sources/jlpt-kanji.json');
const srcVocab = read<SourceWord[]>('scripts/sources/jlpt-vocab.json');

const files = Object.fromEntries(
  (['n5', 'n4', 'n3'] as const).map((lv) => [
    lv,
    {
      kanji: read<LessonFile<KanjiItem>>(`${DATA}/${lv}/kanji.json`),
      vocab: read<LessonFile<VocabItem>>(`${DATA}/${lv}/vocab.json`),
    },
  ])
);
const allKanji = () => new Set(Object.values(files).flatMap((f) => Object.values(f.kanji).flat().map((k) => k.kanji)));
const coverage = () => buildCoverageIndex(Object.values(files).flatMap((f) => Object.values(f.vocab).flat()));

// Appended rows (no example sentence) follow the list's current spelling and gloss.
const sourceIndex = buildSourceIndex(srcVocab);
const refreshed: string[] = [];
for (const [lv, f] of Object.entries(files)) {
  for (const row of Object.values(f.vocab).flat()) {
    const update = refreshAppendedRow(row as VocabItem & { level: string }, sourceIndex);
    if (!update) continue;
    if (lv !== 'n3') refreshed.push(`${row.word}→${update.word}`);
    Object.assign(row, update);
  }
}

const gloss = new Map(srcVocab.filter((w) => w.kanji).map((w) => [w.kanji, w]));

function fill(level: Level): void {
  const lv = level.toLowerCase() as 'n5' | 'n4';
  const { kanji: kanjiFile, vocab: vocabFile } = files[lv];
  const lessons = Object.keys(kanjiFile).map(Number).sort((a, b) => a - b);
  const listUpTo = (['N5', 'N4'] as const).slice(0, level === 'N5' ? 1 : 2);
  const listCompounds = srcVocab
    .filter((w) => w.kanji && (listUpTo as readonly string[]).includes(w.level))
    .map((w): Compound => ({ word: w.kanji, reading: w.kana, meaning: w.meaning }));

  // ---- kanji
  for (const item of Object.values(kanjiFile).flat()) {
    item.onyomi = cleanOnyomi(item.onyomi as string[]);
    item.kunyomi = cleanKunyomi(item.kunyomi as string[]);
  }
  const taught = allKanji();
  const missing = Object.entries(srcKanji).filter(([k, s]) => s.level === level && !taught.has(k)).sort(byFrequency).map(([k]) => k);
  const total = lessons.reduce((n, l) => n + kanjiFile[l].length, 0) + missing.length;
  const cap = Math.ceil(total / lessons.length) + 2;
  const counts = Object.fromEntries(lessons.map((l) => [l, kanjiFile[l].length]));
  for (const k of missing) {
    const uses = lessons.filter((l) => (vocabFile[l] ?? []).some((v) => stripAnnotation(v.word).includes(k)));
    const l = pickLesson(counts, uses, cap);
    counts[l] += 1;
    const s = srcKanji[k];
    const compounds = pickCompounds(k, [...listCompounds, ...(vocabFile[l] ?? []).map((v) => ({ word: stripAnnotation(v.word), reading: v.reading, meaning: v.meaning }))]);
    kanjiFile[l].push({
      uid: `${lv}-kanji-${l}-${kanjiFile[l].length + 1}`,
      level, section: 'kanji', lesson: l, kanji: k,
      onyomi: cleanOnyomi(s.onyomi), kunyomi: cleanKunyomi(s.kunyomi), meaning: displayMeaning(s.meanings),
      strokes: s.strokes, radical: s.radical,
      ...(compounds.length ? { compounds } : {}),
      strokeOrderLink: strokeOrderLink(k),
    });
  }

  // null compound fields in existing kanji → list gloss where the compound is a list word
  let filled = 0;
  for (const item of Object.values(kanjiFile).flat()) {
    for (const c of item.compounds ?? []) {
      const w = gloss.get(stripAnnotation(c.word));
      if (!w) continue;
      if (c.reading === null) { c.reading = w.kana; filled += 1; }
      if (c.meaning === null) { c.meaning = w.meaning; filled += 1; }
    }
  }

  // ---- vocab
  const kanjiLesson = new Map<string, number>();
  for (const l of lessons) for (const k of kanjiFile[l]) if (!kanjiLesson.has(k.kanji)) kanjiLesson.set(k.kanji, l);
  const index = coverage();
  const seen = new Set<string>();
  const newWords = srcVocab.filter((w) => {
    const key = `${w.kanji}|${w.kana}`;
    if (w.level !== level || seen.has(key) || isWordCovered(w, index)) return false;
    seen.add(key);
    return true;
  });
  const vCounts = Object.fromEntries(lessons.map((l) => [l, (vocabFile[l] ?? []).length]));
  const adds: Record<number, SourceWord[]> = {};
  for (const w of newWords) {
    const at = kanjiOf(w.kanji).map((k) => kanjiLesson.get(k)).filter((l): l is number => l !== undefined);
    const l = at.length ? Math.min(...at) : pickLesson(vCounts, [], Infinity);
    vCounts[l] += 1;
    (adds[l] ??= []).push(w);
  }
  for (const l of lessons) {
    const list = (vocabFile[l] ??= []);
    for (const w of (adds[l] ?? []).sort((a, b) => a.kana.localeCompare(b.kana, 'ja'))) {
      list.push({
        uid: `${lv}-vocab-${l}-${list.length + 1}`,
        level, section: 'vocab', lesson: l,
        word: w.kanji || w.kana, reading: w.kana, meaning: w.meaning,
      });
    }
  }

  const kc = lessons.map((l) => kanjiFile[l].length);
  const vc = lessons.map((l) => vocabFile[l].length);
  console.log(`${level} kanji: +${missing.length} ${missing.join('')} (per lesson ${Math.min(...kc)}–${Math.max(...kc)}); ${filled} null compound fields filled`);
  console.log(`${level} vocab: +${newWords.length} (per lesson ${Math.min(...vc)}–${Math.max(...vc)}, total ${vc.reduce((a, b) => a + b, 0)})`);
  if (!DRY) {
    writeFileSync(`${DATA}/${lv}/kanji.json`, `${JSON.stringify(kanjiFile, null, 2)}\n`);
    writeFileSync(`${DATA}/${lv}/vocab.json`, `${JSON.stringify(vocabFile, null, 2)}\n`);
  }
}

console.log(`appended N5/N4 rows refreshed from the list: ${refreshed.length} ${refreshed.join(' ')}`);
// N5 first, so N4 sees the words N5 just took.
fill('N5');
fill('N4');
