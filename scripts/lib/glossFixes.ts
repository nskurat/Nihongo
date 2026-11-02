/**
 * Gloss fixes for single vocab rows: wrong glosses from the list import, and N4 grammar
 * phrases filed in N5 vocab marked as previews. Uid-keyed and guarded by the word and the
 * old value, so a stale entry never lands on the wrong row. Used by scripts/fix-glosses.ts.
 */

type Json = Record<string, unknown>;
export type LessonFile = Record<string, Json[]>;

export interface GlossFix {
  uid: string;
  word: string;
  from: string;
  to: string;
  /** Replacement example, when the old one belongs to a different sense. */
  example?: { fromJp: string; jp: string; en: string };
}

export const GLOSS_FIXES: Record<'n5' | 'n3', GlossFix[]> = {
  n5: [
    { uid: 'n5-vocab-20-12', word: 'そっち', from: 'over there', to: 'there (near you), that way' },
    { uid: 'n5-vocab-25-7', word: 'もし〜たら', from: 'if 〜', to: 'if 〜 (preview: the たら conditional is taught in N4 Lesson 9)' },
    {
      uid: 'n5-vocab-25-8',
      word: 'いくら〜ても',
      from: 'however 〜, even if 〜',
      to: 'however much 〜, even if 〜 (preview: 〜ても is taught in N4 Lesson 9)',
    },
  ],
  n3: [
    { uid: 'n3-vocab-24-106', word: '仕舞い', from: 'sisters', to: 'end, close' },
    { uid: 'n3-vocab-18-94', word: '屯', from: '1000 ton', to: 'ton (unit of weight; usually written トン)' },
    { uid: 'n3-vocab-24-126', word: '然う', from: 'so', to: 'so, like that (old kanji spelling of そう)' },
    { uid: 'n3-vocab-20-124', word: '仕舞った', from: 'Damn it!', to: 'Oh no!, Damn it! (on noticing a mistake)' },
    {
      uid: 'n3-vocab-14-18',
      word: 'マッカーサー',
      from: 'Stuart McArthur',
      to: "Stuart McArthur (maker of the 'upside-down' world map)",
      example: {
        fromJp: '歴史の授業でマッカーサーについて学ぶ。',
        jp: 'マッカーサーの世界地図は、南が上になっている。',
        en: "McArthur's world map has south at the top.",
      },
    },
  ],
};

export interface GlossReport {
  changed: string[];
  skipped: string[];
}

/** Applies the fixes to a vocab file. Idempotent: rows already fixed are left alone. */
export function applyGlossFixes(file: LessonFile, fixes: readonly GlossFix[], report: GlossReport): void {
  const byUid = new Map(Object.values(file).flat().map((r) => [r.uid, r]));
  for (const fix of fixes) {
    const row = byUid.get(fix.uid);
    if (!row || row.word !== fix.word) {
      report.skipped.push(`${fix.uid}: expected ${fix.word}, found ${row ? String(row.word) : 'no row'}`);
      continue;
    }
    if (row.meaning === fix.from) {
      row.meaning = fix.to;
      report.changed.push(`${fix.uid} ${fix.from} → ${fix.to}`);
    } else if (row.meaning !== fix.to) {
      report.skipped.push(`${fix.uid}: meaning is "${String(row.meaning)}"`);
    }
    if (fix.example && row.exampleJp === fix.example.fromJp) {
      row.exampleJp = fix.example.jp;
      row.exampleEn = fix.example.en;
      report.changed.push(`${fix.uid} example`);
    }
  }
}
