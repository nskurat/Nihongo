/**
 * Data-quality fixes that global search depends on (docs/search/04-data.md §7 #1, #3, #8).
 * Pure tables + an idempotent `apply` used by scripts/fix-search-data.ts. Uids never change.
 */

type Json = Record<string, unknown>;
export type LessonFile = Record<string, Json[]>;

/** §7 #1: vocab readings that are wrong for the word (uid-keyed, guarded by the old value). */
export const VOCAB_READING_FIXES: { uid: string; word: string; from: string; to: string; romaji?: string }[] = [
  // Teacher review F9: the readings drop part of the phrase (が, します).
  { uid: 'n4-vocab-9-2', word: '気が付きます', from: 'きつきます', to: 'きがつきます', romaji: 'kigatsukimasu' },
  { uid: 'n4-vocab-16-6', word: '親切にします', from: 'しんせつに', to: 'しんせつにします', romaji: 'shinsetsu ni shimasu' },
];

/**
 * §7 #3: slash pairs whose reading covers only one half and whose word carries a reading
 * gloss instead. After the fix word and reading pair up part by part like every other
 * `／` row (`犬／猫` いぬ／ねこ).
 */
export const SLASH_PAIR_FIXES: {
  uid: string;
  from: { word: string; reading: string };
  to: { word: string; reading: string; romaji: string };
}[] = [
  {
    uid: 'n4-vocab-6-9',
    from: { word: '本社（ほんしゃ）／支店', reading: 'してん' },
    to: { word: '本社／支店', reading: 'ほんしゃ／してん', romaji: 'honsha / shiten' },
  },
  {
    uid: 'n4-vocab-9-5',
    from: { word: '細い（ほそい）／太い', reading: 'ふとい' },
    to: { word: '細い／太い', reading: 'ほそい／ふとい', romaji: 'hosoi / futoi' },
  },
];

/**
 * §7 #8: N5 kun readings stored as a bare stem (分 わ, 行 い). Each stem is replaced by
 * the full KANJIDIC reading(s) a learner meets at N5–N4 — the verb or adjective the
 * stem belongs to. Conservative: stems that are themselves real readings (日 か counter,
 * 一 ひと, 真 ま, 円 まる, 生 き, 千 ち) are left alone.
 */
export const N5_KUN_OKURIGANA: Record<string, Record<string, string[]>> = {
  学: { まな: ['まな・ぶ'] },
  会: { あ: ['あ・う'] },
  分: { わ: ['わ・かる', 'わ・ける'] },
  行: { い: ['い・く'], おこな: ['おこな・う'] },
  来: { く: ['く・る'], きた: ['きた・る'] },
  休: { やす: ['やす・む'] },
  去: { さ: ['さ・る'] },
  自: { みずか: ['みずか・ら'] },
  転: { ころ: ['ころ・ぶ'] },
  動: { うご: ['うご・く'] },
  後: { うし: ['うし・ろ'] },
  生: { い: ['い・きる'], う: ['う・まれる'] },
  半: { なか: ['なか・ば'] },
};

export interface FixReport {
  changed: string[];
  skipped: string[];
}

/** Example sentences that only repeat the word (the validator's "meaning is identical to exampleEn"). */
export const VOCAB_EXAMPLE_FIXES: { uid: string; word: string; fromJp: string; exampleJp: string; exampleEn: string }[] = [
  { uid: 'n5-vocab-17-10', word: 'お大事に', fromJp: 'お大事に。', exampleJp: 'かぜですか。どうぞ お大事に。', exampleEn: 'A cold? Please take care of yourself.' },
];

/**
 * Regression R16: JMdict part-of-speech markers (`(n)`, `(a)`, `(col)`, `(exp)`…) left in a
 * few N2/N1 glosses. They mean nothing to a learner and match English searches for "a".
 * Numbered senses `(1)` and usage notes such as `(male)` or `(hon)` stay.
 */
const POS_MARKER = /\((?:n|a|v\d?|vt|vi|adj(?:-[a-z]+)?|adv|col|exp|uk|n-adv|vs|int|pn|prt|conj|aux)\)\s*/g;

/** An empty language tag left in front of the gloss (`(pt:) playing cards (pt: carta)`). */
const EMPTY_LANG_TAG = /^\([a-z]{2}:\)\s*/;

export function stripPosMarkers(meaning: string): string {
  return meaning.replace(POS_MARKER, '').replace(EMPTY_LANG_TAG, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();
}

/** Applies `stripPosMarkers` to every vocab meaning. Idempotent. */
export function applyMeaningMarkerFixes(file: LessonFile, report: FixReport): void {
  for (const row of rowsOf(file)) {
    if (typeof row.meaning !== 'string') continue;
    const after = stripPosMarkers(row.meaning);
    if (after !== row.meaning) {
      report.changed.push(`${String(row.uid)} ${row.meaning} → ${after}`);
      row.meaning = after;
    }
  }
}

function rowsOf(file: LessonFile): Json[] {
  return Object.values(file).flat();
}

/** Applies the vocab fixes in place. Idempotent: an already-fixed row is left untouched. */
export function applyVocabFixes(file: LessonFile, report: FixReport): void {
  const byUid = new Map(rowsOf(file).map((r) => [r.uid as string, r]));
  for (const fix of VOCAB_EXAMPLE_FIXES) {
    const row = byUid.get(fix.uid);
    if (row?.word === fix.word && row.exampleJp === fix.fromJp) {
      row.exampleJp = fix.exampleJp;
      row.exampleEn = fix.exampleEn;
      report.changed.push(`${fix.uid} ${fix.word}: example ${fix.exampleJp}`);
    }
  }
  for (const fix of VOCAB_READING_FIXES) {
    const row = byUid.get(fix.uid);
    if (!row) continue;
    if (row.word === fix.word && row.reading === fix.from) {
      row.reading = fix.to;
      if (fix.romaji && 'romaji' in row) row.romaji = fix.romaji;
      report.changed.push(`${fix.uid} ${fix.word} ${fix.from} → ${fix.to}`);
    } else if (row.reading !== fix.to) {
      report.skipped.push(`${fix.uid}: expected ${fix.word}【${fix.from}】, found ${String(row.word)}【${String(row.reading)}】`);
    }
  }
  for (const fix of SLASH_PAIR_FIXES) {
    const row = byUid.get(fix.uid);
    if (!row) continue;
    if (row.word === fix.from.word && row.reading === fix.from.reading) {
      row.word = fix.to.word;
      row.reading = fix.to.reading;
      if ('romaji' in row) row.romaji = fix.to.romaji;
      report.changed.push(`${fix.uid} ${fix.from.word}【${fix.from.reading}】 → ${fix.to.word}【${fix.to.reading}】`);
    } else if (row.word !== fix.to.word) {
      report.skipped.push(`${fix.uid}: expected ${fix.from.word}, found ${String(row.word)}`);
    }
  }
}

/** Replaces bare N5 kun stems by their full readings, keeping order and dropping repeats. */
/**
 * Native counting forms N5 learners use daily (ひとつ, ふたつ …), missing beside the bare
 * stems (一 ひと). KANJIDIC lists them; where it has two (み・つ / みっ・つ), the everyday
 * one. Bare prefix readings (一 ひと, 小 お, 目 ま) stay: every level writes kun readings
 * without KANJIDIC's hyphen markers.
 */
export const N5_KUN_ADDITIONS: Record<string, string[]> = {
  一: ['ひと・つ'], 二: ['ふた・つ'], 三: ['みっ・つ'], 四: ['よっ・つ'], 五: ['いつ・つ'],
  六: ['むっ・つ'], 七: ['なな・つ'], 八: ['やっ・つ'], 九: ['ここの・つ'],
};

export function applyKunFixes(file: LessonFile, report: FixReport): void {
  for (const row of rowsOf(file)) {
    const table = N5_KUN_OKURIGANA[row.kanji as string] ?? {};
    const extra = N5_KUN_ADDITIONS[row.kanji as string] ?? [];
    if (!Array.isArray(row.kunyomi)) continue;
    const before = row.kunyomi as string[];
    const after: string[] = [];
    for (const r of before) for (const x of table[r] ?? [r]) if (!after.includes(x)) after.push(x);
    for (const x of extra) if (!after.includes(x)) after.push(x);
    if (after.join('|') !== before.join('|')) {
      row.kunyomi = after;
      report.changed.push(`${String(row.uid)} ${String(row.kanji)} ${before.join('、')} → ${after.join('、')}`);
    }
  }
}

/**
 * Grammar titles use the wave dash 〜 for "something goes here" (423 of 424 N5 titles);
 * an ASCII ~ or full-width ～ is the same mark typed differently. Display-only: search
 * already normalises all three.
 */
export function applyTitleTildeFixes(file: LessonFile, report: FixReport): void {
  for (const row of rowsOf(file)) {
    if (typeof row.title !== 'string' || !/[~～]/.test(row.title)) continue;
    const before = row.title;
    row.title = before.replace(/[~～]/g, '〜');
    report.changed.push(`${String(row.uid)} ${before} → ${String(row.title)}`);
  }
}
