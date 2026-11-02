import { stripAnnotation } from './jlptContent';

/**
 * The N5 and N4 restructures (2026-11): grammar and vocab leave the Minna no Nihongo lesson
 * order for this app's own 25-lesson sequence (docs/content/n5-restructure.md,
 * docs/content/n4-restructure.md). Pure helpers used by scripts/restructure-n5.ts and
 * scripts/restructure-n4.ts; tested in grammar-app/src/__tests__/scripts/n5Restructure.test.ts.
 * Both levels have 25 lessons.
 */

export type Row = Record<string, unknown> & { uid: string; lesson: number };
export type LessonFile = Record<string, Row[]>;
export type UidMap = Record<string, string>;

/** One authored grammar point from scripts/batches/n{5,4}-grammar/*.json. */
export interface GrammarSpec {
  replaces: string[];
  title: string;
  structure: string;
  meaning: string;
  explanation: string;
  summary: string;
  note?: string;
  details: string;
  tags: string[];
  examples: { jp: string; en: string }[];
}

export const LESSONS = 25;

/** "1:6 2:1 …" (old position → new lesson), one string per old lesson → old uid → new lesson. */
export function parseAssignments(level: string, section: string, assign: Record<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [oldLesson, pairs] of Object.entries(assign)) {
    for (const pair of pairs.trim().split(/\s+/)) {
      const [pos, lesson] = pair.split(':').map(Number);
      if (!Number.isInteger(pos) || !Number.isInteger(lesson) || lesson < 1 || lesson > LESSONS)
        throw new Error(`bad assignment "${pair}" in old lesson ${oldLesson}`);
      const uid = `${level}-${section}-${oldLesson}-${pos}`;
      if (out.has(uid)) throw new Error(`${uid} assigned twice`);
      out.set(uid, lesson);
    }
  }
  return out;
}

const position = (uid: string): [number, number] => {
  const m = /-(\d+)-(\d+)$/.exec(uid);
  if (!m) throw new Error(`not a positional uid: ${uid}`);
  return [Number(m[1]), Number(m[2])];
};

/** Old reading order: lesson, then position. */
export const byOldPosition = (a: Row, b: Row): number => {
  const [al, ap] = position(a.uid);
  const [bl, bp] = position(b.uid);
  return al - bl || ap - bp;
};

/**
 * Rebuilds a lesson file from rows and their new lessons. Within a lesson, rows for which
 * `first` is true come first (the core words that carry example sentences), each group in
 * old order. Returns the file and old uid → new uid.
 */
export function regroup(
  rows: Row[],
  lessonOf: (row: Row) => number,
  prefix: string,
  first: (row: Row) => boolean = () => false
): { file: LessonFile; map: UidMap } {
  const file: LessonFile = {};
  const map: UidMap = {};
  for (let l = 1; l <= LESSONS; l++) file[l] = [];
  const sorted = [...rows].sort((a, b) => Number(first(b)) - Number(first(a)) || byOldPosition(a, b));
  for (const row of sorted) {
    const lesson = lessonOf(row);
    const uid = `${prefix}-${lesson}-${file[lesson].length + 1}`;
    map[row.uid] = uid;
    file[lesson].push({ ...row, uid, lesson });
  }
  return { file, map };
}

/**
 * Kanji follow the vocab: each goes to the first lesson whose words use it (as in
 * scripts/fill-n5-n4-gaps.ts), or, when none do or that lesson is full, to the emptiest
 * lesson at or after it. `cap` keeps lessons balanced.
 */
export function placeKanji(kanji: Row[], vocab: LessonFile, cap: number): Map<string, number> {
  const counts = Array.from({ length: LESSONS + 1 }, () => 0);
  const out = new Map<string, number>();
  for (const row of [...kanji].sort(byOldPosition)) {
    const k = String(row.kanji);
    const uses: number[] = [];
    for (let l = 1; l <= LESSONS; l++) {
      if ((vocab[l] ?? []).some((v) => stripAnnotation(String(v.word)).includes(k))) uses.push(l);
    }
    const open = uses.find((l) => counts[l] < cap);
    let lesson = open;
    if (lesson === undefined) {
      const from = uses[0] ?? 1;
      lesson = from;
      for (let l = from; l <= LESSONS; l++) if (counts[l] < counts[lesson]) lesson = l;
    }
    counts[lesson] += 1;
    out.set(row.uid, lesson);
  }
  return out;
}

/** Field order of a grammar row, matching the other levels' files. */
export function grammarRow(spec: GrammarSpec, lesson: number, n: number, level: 'n5' | 'n4' = 'n5'): Row {
  return {
    uid: `${level}-grammar-${lesson}-${n}`,
    level: level.toUpperCase(),
    section: 'grammar',
    lesson,
    title: spec.title,
    structure: spec.structure,
    meaning: spec.meaning,
    explanation: spec.explanation,
    examples: spec.examples,
    summary: spec.summary,
    ...(spec.note ? { note: spec.note } : {}),
    details: spec.details,
    tags: spec.tags,
  };
}

/** Builds the new grammar file; every old uid must be replaced exactly once. */
export function buildGrammar(
  lessons: Record<string, GrammarSpec[]>,
  oldUids: readonly string[],
  level: 'n5' | 'n4' = 'n5'
): { file: LessonFile; map: UidMap } {
  const file: LessonFile = {};
  const map: UidMap = {};
  for (let l = 1; l <= LESSONS; l++) {
    file[l] = (lessons[l] ?? []).map((spec, i) => {
      const row = grammarRow(spec, l, i + 1, level);
      for (const old of spec.replaces) {
        if (map[old]) throw new Error(`${old} is replaced twice`);
        map[old] = row.uid;
      }
      return row;
    });
  }
  const missing = oldUids.filter((u) => !map[u]);
  const unknown = Object.keys(map).filter((u) => !oldUids.includes(u));
  if (missing.length || unknown.length) throw new Error(`grammar map: missing ${missing.join(', ')}; unknown ${unknown.join(', ')}`);
  return { file, map };
}

/**
 * Compact text form of a uid map for the app bundle: "old>new" suffix pairs joined by
 * commas, with the shared "<level>-<section>-" prefix dropped.
 */
export function packUidMap(map: UidMap, prefix: string): string {
  const strip = (u: string) => {
    if (!u.startsWith(prefix)) throw new Error(`${u} lacks ${prefix}`);
    return u.slice(prefix.length);
  };
  return Object.entries(map)
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => `${strip(a)}>${strip(b)}`)
    .join(',');
}

/** uid → [expected word, exampleJp, exampleEn] (scripts/batches/n{5,4}-vocab-examples.json). */
export type ExampleBatch = Record<string, [string, string, string]>;

/**
 * Writes the new example sentences into a vocab file. Each target must exist and carry the
 * expected word (so a stale batch never lands on the wrong row); only exampleJp/exampleEn
 * change. Returns the number of rows whose examples changed.
 */
export function applyVocabExamples(file: LessonFile, batch: ExampleBatch): number {
  const byUid = new Map(Object.values(file).flat().map((r) => [r.uid, r]));
  let changed = 0;
  for (const [uid, [word, jp, en]] of Object.entries(batch)) {
    const row = byUid.get(uid);
    if (!row) throw new Error(`${uid}: no such row`);
    if (row.word !== word) throw new Error(`${uid}: expected ${word}, found ${String(row.word)}`);
    if (row.exampleJp === jp && row.exampleEn === en) continue;
    row.exampleJp = jp;
    row.exampleEn = en;
    changed++;
  }
  return changed;
}
