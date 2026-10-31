/**
 * Data-quality fixes that global search depends on (docs/search/04-data.md §7 #1, #3, #8).
 * Pure tables + an idempotent `apply` used by scripts/fix-search-data.ts. Uids never change.
 */

type Json = Record<string, unknown>;
export type LessonFile = Record<string, Json[]>;

/** §7 #1: vocab readings that are wrong for the word (uid-keyed, guarded by the old value). */
export const VOCAB_READING_FIXES: { uid: string; word: string; from: string; to: string; romaji?: string }[] = [
  // Waller's N3 list spells the colloquial pronunciation; the dictionary reading is いう.
  { uid: 'n3-vocab-23-124', word: '言う', from: 'ゆう', to: 'いう' },
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

function rowsOf(file: LessonFile): Json[] {
  return Object.values(file).flat();
}

/** Applies the vocab fixes in place. Idempotent: an already-fixed row is left untouched. */
export function applyVocabFixes(file: LessonFile, report: FixReport): void {
  const byUid = new Map(rowsOf(file).map((r) => [r.uid as string, r]));
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
export function applyKunFixes(file: LessonFile, report: FixReport): void {
  for (const row of rowsOf(file)) {
    const table = N5_KUN_OKURIGANA[row.kanji as string];
    if (!table || !Array.isArray(row.kunyomi)) continue;
    const before = row.kunyomi as string[];
    const after: string[] = [];
    for (const r of before) for (const x of table[r] ?? [r]) if (!after.includes(x)) after.push(x);
    if (after.join('|') !== before.join('|')) {
      row.kunyomi = after;
      report.changed.push(`${String(row.uid)} ${String(row.kanji)} ${before.join('、')} → ${after.join('、')}`);
    }
  }
}
